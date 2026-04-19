import { NextRequest, NextResponse } from "next/server";
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
    .select("*, leads(conversation_id)")
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

  await supabase
    .from("quotes")
    .update({ payment_terms: paymentTerms, payment_status: paymentStatus })
    .eq("id", id);

  let jobCreated = false;
  let jobId: string | null = null;
  const nextWorkflowState = getQuoteApprovalState(paymentTerms, paymentStatus);

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
      payment_terms: paymentTerms,
      payment_status: paymentStatus,
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
  });
}
