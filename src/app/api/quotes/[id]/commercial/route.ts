import { NextRequest, NextResponse } from "next/server";
import { getRuntimeAppConfig } from "@/lib/app-settings";
import { resolvePaymentProfileFromConfig } from "@/lib/payment-routing";
import { syncQuotePaymentRecord } from "@/lib/quote-payment-records";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createJobForApprovedQuote,
  getQuoteApprovalState,
  paymentUnlocksProduction,
} from "@/lib/quote-workflow";
import {
  isPaymentStatus,
  isPaymentTerm,
  type PaymentStatus,
  type PaymentTerm,
} from "@/lib/types";
import { logHumanAction } from "@/lib/action-log";
import { validatePaymentAmount } from "@/lib/commercial-validation";

type CommercialUpdateBody = {
  paymentTerms?: PaymentTerm;
  paymentStatus?: PaymentStatus;
  paymentAmount?: number | string;
  /** Optional withheld tax (50ทวิ) on this specific payment. Defaults to 0. */
  whtAmount?: number | string;
  /**
   * Optional quote-level WHT rate (0..0.20 → 0–20%). Persisted on quotes.wht_rate.
   * Typically 0.03 for Thai service work. Admin can set at deposit time then it
   * applies to all subsequent payments + document snapshots.
   */
  whtRate?: number | string;
  paymentIdempotencyKey?: string;
  idempotencyKey?: string;
};

type ConfirmCommercialPaymentRpcRow = {
  payment_id?: string | null;
  paymentId?: string | null;
  order_id?: string | null;
  orderId?: string | null;
  receiver_entity_id?: string | null;
  receiverEntityId?: string | null;
  payment_receiver_locked_at?: string | null;
  paymentReceiverLockedAt?: string | null;
  reused?: boolean | null;
};

function getRpcPaymentResult(data: unknown): ConfirmCommercialPaymentRpcRow | null {
  if (Array.isArray(data)) {
    return (data[0] as ConfirmCommercialPaymentRpcRow | undefined) || null;
  }

  if (data && typeof data === "object") {
    return data as ConfirmCommercialPaymentRpcRow;
  }

  return null;
}

function normalizeIdempotencyKey(body: CommercialUpdateBody) {
  return (body.paymentIdempotencyKey || body.idempotencyKey || "").trim();
}

function getPaymentAmount(
  paymentStatus: PaymentStatus,
  rawAmount: CommercialUpdateBody["paymentAmount"],
  quoteTotal: number
):
  | { ok: true; amount: number }
  | { ok: false; error: string; detail: string; status: number } {
  if (paymentStatus === "partial" && rawAmount === undefined) {
    return {
      ok: false,
      error: "PAYMENT_AMOUNT_REQUIRED",
      detail: "partial payment requires an explicit paymentAmount",
      status: 400,
    };
  }

  const amount = rawAmount === undefined ? quoteTotal : Number(rawAmount);

  if (!Number.isFinite(amount)) {
    return {
      ok: false,
      error: "PAYMENT_AMOUNT_INVALID",
      detail: "paymentAmount must be a finite number",
      status: 400,
    };
  }

  return { ok: true, amount };
}

function mapPaymentRpcError(message: string) {
  const knownErrors: Record<string, number> = {
    COMMERCIAL_ORDER_NOT_FOUND: 409,
    PAYMENT_IDEMPOTENCY_CONFLICT: 409,
    PAYMENT_IDEMPOTENCY_KEY_REQUIRED: 400,
    PAYMENT_AMOUNT_EXCEEDS_OUTSTANDING: 422,
    PAYMENT_RECEIVER_LOCKED: 409,
    PAYMENT_WHT_INVALID: 400,
    RECEIVER_ENTITY_INACTIVE: 422,
    RECEIVER_REQUIRED_BEFORE_PAYMENT: 409,
  };

  for (const [code, status] of Object.entries(knownErrors)) {
    if (message.includes(code)) {
      return { error: code, detail: message, status };
    }
  }

  return {
    error: "PAYMENT_CONFIRMATION_FAILED",
    detail: message || "Failed to confirm payment",
    status: 500,
  };
}

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;

  let body: CommercialUpdateBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.paymentTerms && !body.paymentStatus) {
    return NextResponse.json(
      { error: "Nothing to update" },
      { status: 400 }
    );
  }

  if (body.paymentTerms && !isPaymentTerm(body.paymentTerms)) {
    return NextResponse.json(
      { error: "Invalid paymentTerms" },
      { status: 400 }
    );
  }

  if (body.paymentStatus && !isPaymentStatus(body.paymentStatus)) {
    return NextResponse.json(
      { error: "Invalid paymentStatus" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { data: quote, error } = await supabase
    .from("quotes")
    .select("*, leads(conversation_id, billing_entity_type), jobs(id)")
    .eq("id", id)
    .single();

  if (error || !quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  const paymentTerms = body.paymentTerms || quote.payment_terms;
  let paymentStatus = body.paymentStatus || quote.payment_status;
  const existingJobs = Array.isArray(quote.jobs) ? quote.jobs : [];
  const hasExistingJob = existingJobs.length > 0;

  if (paymentTerms === "credit") {
    paymentStatus = "not_required";
  }

  if (paymentTerms !== "credit" && paymentStatus === "not_required") {
    paymentStatus = "unpaid";
  }

  const appConfig = await getRuntimeAppConfig();
  const paymentProfileSnapshot = resolvePaymentProfileFromConfig(appConfig, {
    total: quote.total,
    billingEntityType: quote.leads?.billing_entity_type || null,
    paymentTerms,
  });

  let jobCreated = false;
  let jobId: string | null = null;
  let paymentConfirmedId: string | null = null;
  let paymentConfirmation:
    | {
        orderId: string | null;
        receiverEntityId: string | null;
        paymentReceiverLockedAt: string | null;
        reused: boolean;
        amount: number;
        whtAmount: number;
      }
    | null = null;
  const nextWorkflowState = getQuoteApprovalState(paymentTerms, paymentStatus);
  const productionUnlocked =
    quote.status === "approved" &&
    paymentUnlocksProduction(paymentTerms, paymentStatus);

  const paymentMarkedReceived =
    paymentStatus === "paid" || paymentStatus === "partial";
  if (paymentMarkedReceived) {
    const idempotencyKey = normalizeIdempotencyKey(body);
    if (!idempotencyKey) {
      return NextResponse.json(
        {
          error: "PAYMENT_IDEMPOTENCY_KEY_REQUIRED",
          detail: "paymentIdempotencyKey is required when marking payment received",
        },
        { status: 400 }
      );
    }

    const amountResult = getPaymentAmount(
      paymentStatus,
      body.paymentAmount,
      Number(quote.total || 0)
    );
    if (!amountResult.ok) {
      return NextResponse.json(
        { error: amountResult.error, detail: amountResult.detail },
        { status: amountResult.status }
      );
    }

    const amountValidation = validatePaymentAmount({
      paymentTerms,
      paymentAmount: amountResult.amount,
      amountDue: Number(quote.total || 0),
    });
    if (!amountValidation.ok) {
      return NextResponse.json(
        { error: amountValidation.error, detail: amountValidation.detail },
        { status: 422 }
      );
    }

    // Withholding tax on this specific payment (50ทวิ). The RPC enforces
    // amount + wht_amount <= outstanding under the order row lock (L11)
    // so we just forward the validated numeric here.
    const whtRaw = body.whtAmount;
    const whtAmount =
      whtRaw === undefined || whtRaw === null || whtRaw === ""
        ? 0
        : Number(whtRaw);
    if (!Number.isFinite(whtAmount) || whtAmount < 0) {
      return NextResponse.json(
        {
          error: "PAYMENT_WHT_INVALID",
          detail: "whtAmount must be a finite non-negative number",
        },
        { status: 400 }
      );
    }

    const paidAt = new Date().toISOString();
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      "confirm_commercial_payment",
      {
        p_quote_id: id,
        p_amount: amountResult.amount,
        p_idempotency_key: idempotencyKey,
        p_paid_at: paidAt,
        p_wht_amount: whtAmount,
      }
    );

    if (rpcError) {
      const mapped = mapPaymentRpcError(rpcError.message || "");
      return NextResponse.json(
        { error: mapped.error, detail: mapped.detail },
        { status: mapped.status }
      );
    }

    const paymentResult = getRpcPaymentResult(rpcData);
    paymentConfirmedId =
      paymentResult?.payment_id || paymentResult?.paymentId || null;

    if (!paymentConfirmedId) {
      return NextResponse.json(
        {
          error: "PAYMENT_CONFIRMATION_FAILED",
          detail: "Payment confirmation did not return a payment id",
        },
        { status: 500 }
      );
    }

    paymentConfirmation = {
      orderId: paymentResult?.order_id || paymentResult?.orderId || null,
      receiverEntityId:
        paymentResult?.receiver_entity_id ||
        paymentResult?.receiverEntityId ||
        null,
      paymentReceiverLockedAt:
        paymentResult?.payment_receiver_locked_at ||
        paymentResult?.paymentReceiverLockedAt ||
        null,
      reused: Boolean(paymentResult?.reused),
      amount: amountResult.amount,
      whtAmount,
    };
  }

  const quoteUpdatePayload: Record<string, unknown> = {
    payment_terms: paymentTerms,
    payment_status: paymentStatus,
    payment_profile_snapshot: paymentProfileSnapshot,
  };
  if (body.whtRate !== undefined && body.whtRate !== null && body.whtRate !== "") {
    const rate = Number(body.whtRate);
    if (!Number.isFinite(rate) || rate < 0 || rate > 0.2) {
      return NextResponse.json(
        {
          error: "WHT_RATE_INVALID",
          detail: "whtRate must be a finite number between 0 and 0.20.",
        },
        { status: 400 }
      );
    }
    quoteUpdatePayload.wht_rate = rate;
  }
  const { error: quoteUpdateError } = await supabase
    .from("quotes")
    .update(quoteUpdatePayload)
    .eq("id", id);

  if (quoteUpdateError) {
    return NextResponse.json(
      { error: quoteUpdateError.message || "Failed to update quote payment state" },
      { status: 500 }
    );
  }

  await syncQuotePaymentRecord(supabase, {
    quoteId: quote.id,
    leadId: quote.lead_id,
    quoteStatus: quote.status,
    total: Number(quote.total || 0),
    paymentTerms,
    paymentStatus,
    paymentProfileSnapshot,
  });

  if (paymentConfirmation && paymentConfirmedId) {
    await logHumanAction(supabase, {
      entityType: "quote",
      entityId: id,
      actionType: "commercial.payment_confirmed",
      actorLabel: "Admin",
      payload: {
        payment_id: paymentConfirmedId,
        order_id: paymentConfirmation.orderId,
        receiver_entity_id: paymentConfirmation.receiverEntityId,
        amount: paymentConfirmation.amount,
        wht_amount: paymentConfirmation.whtAmount,
        payment_receiver_locked_at: paymentConfirmation.paymentReceiverLockedAt,
        reused: paymentConfirmation.reused,
        auto_created_from_quote_status: paymentStatus,
      },
    });
  }

  if (productionUnlocked) {
    if (hasExistingJob) {
      jobCreated = false;
      jobId = existingJobs[0]?.id ?? null;
    } else {
      const jobResult = await createJobForApprovedQuote(supabase, {
        id: quote.id,
        lead_id: quote.lead_id,
        public_token: quote.public_token,
        total: Number(quote.total || 0),
        status: quote.status,
        payment_terms: paymentTerms,
        payment_status: paymentStatus,
        payment_profile_snapshot: paymentProfileSnapshot,
        leads: quote.leads,
      });

      jobCreated = jobResult.created;
      jobId = jobResult.jobId;
    }
  } else if (
    quote.leads?.conversation_id &&
    quote.status === "approved" &&
    !hasExistingJob
  ) {
    await supabase
      .from("conversations")
      .update({ state: nextWorkflowState })
      .eq("id", quote.leads.conversation_id);
  }

  await logHumanAction(supabase, {
    entityType: "quote",
    entityId: id,
    actionType: "quote.payment_updated",
    actorLabel: "Admin",
    payload: {
      payment_terms: paymentTerms,
      payment_status: paymentStatus,
      workflow_state: nextWorkflowState,
      job_created: jobCreated,
      job_id: jobId,
    },
  });

  return NextResponse.json({
    success: true,
    paymentTerms,
    paymentStatus,
    jobCreated,
    jobId,
    paymentConfirmedId,
  });
}
