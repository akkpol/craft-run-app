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

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;

  let body: { paymentTerms?: PaymentTerm; paymentStatus?: PaymentStatus };
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
    .select("*, leads(conversation_id, billing_entity_type)")
    .eq("id", id)
    .single();

  if (error || !quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  const paymentTerms = body.paymentTerms || quote.payment_terms;
  let paymentStatus = body.paymentStatus || quote.payment_status;

  if (paymentTerms === "credit" && paymentStatus === "unpaid") {
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

  await supabase
    .from("quotes")
    .update({
      payment_terms: paymentTerms,
      payment_status: paymentStatus,
      payment_profile_snapshot: paymentProfileSnapshot,
    })
    .eq("id", id);

  await syncQuotePaymentRecord(supabase, {
    quoteId: quote.id,
    leadId: quote.lead_id,
    quoteStatus: quote.status,
    total: Number(quote.total || 0),
    paymentTerms,
    paymentStatus,
    paymentProfileSnapshot,
  });

  let jobCreated = false;
  let jobId: string | null = null;
  let paymentConfirmedId: string | null = null;
  const nextWorkflowState = getQuoteApprovalState(paymentTerms, paymentStatus);

  const paymentMarkedReceived =
    paymentStatus === "paid" || paymentStatus === "partial";
  if (paymentMarkedReceived) {
    const { data: order } = await supabase
      .from("commercial_orders")
      .select(
        "id, selected_receiver_entity_id, payment_receiver_locked_at"
      )
      .eq("quote_id", id)
      .maybeSingle();

    if (order?.selected_receiver_entity_id) {
      const { data: existingConfirmed } = await supabase
        .from("payments")
        .select("id")
        .eq("order_id", order.id)
        .eq("status", "CONFIRMED")
        .order("paid_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingConfirmed?.id) {
        paymentConfirmedId = existingConfirmed.id;
      } else {
        const now = new Date().toISOString();
        const { data: insertedPayment, error: paymentInsertError } =
          await supabase
            .from("payments")
            .insert({
              order_id: order.id,
              receiver_entity_id: order.selected_receiver_entity_id,
              amount: Number(quote.total || 0),
              status: "CONFIRMED",
              paid_at: now,
            })
            .select("id")
            .single();

        if (paymentInsertError) {
          console.error(
            "[quotes/commercial] Failed to insert payment row:",
            paymentInsertError.message
          );
        } else if (insertedPayment) {
          paymentConfirmedId = insertedPayment.id;
          if (!order.payment_receiver_locked_at) {
            await supabase
              .from("commercial_orders")
              .update({ payment_receiver_locked_at: now, updated_at: now })
              .eq("id", order.id);
          }
          await logHumanAction(supabase, {
            entityType: "quote",
            entityId: id,
            actionType: "commercial.payment_confirmed",
            actorLabel: "Admin",
            payload: {
              payment_id: insertedPayment.id,
              order_id: order.id,
              receiver_entity_id: order.selected_receiver_entity_id,
              amount: Number(quote.total || 0),
              auto_created_from_quote_status: paymentStatus,
            },
          });
        }
      }
    }
  }

  if (quote.leads?.conversation_id && quote.status === "approved") {
    await supabase
      .from("conversations")
      .update({ state: nextWorkflowState })
      .eq("id", quote.leads.conversation_id);
  }

  if (quote.status === "approved" && paymentUnlocksProduction(paymentTerms, paymentStatus)) {
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
