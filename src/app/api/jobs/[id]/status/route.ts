import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { pushStatusUpdate } from "@/lib/line";
import {
  isJobStatus,
  type JobStatus,
  type PaymentStatus,
  type PaymentTerm,
} from "@/lib/types";
import { paymentUnlocksProduction } from "@/lib/quote-workflow";
import { ALLOWED_JOB_TRANSITIONS } from "@/lib/workflow-transitions";
import { createOrReuseActiveProductionLink } from "@/lib/production-media";
import { logHumanAction } from "@/lib/action-log";
import {
  fetchCommercialAdminContextForQuoteIds,
  type CommercialAdminContext,
} from "@/lib/commercial-admin-context";
import { validateTransition } from "@/lib/workflow-policy";

function getLeadStatusForJobStatus(status: JobStatus): string {
  if (status === "COMPLETED") {
    return "completed";
  }

  if (status === "IN_PRODUCTION" || status === "READY_FOR_FULFILLMENT") {
    return "in_progress";
  }

  if (status === "CANCELLED") {
    return "cancelled";
  }

  return "approved";
}

function getConversationStateForJobStatus(status: JobStatus): JobStatus {
  return status;
}

// Next.js 16: async params
export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;

  let body: { status: string; note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.status || !isJobStatus(body.status)) {
    return NextResponse.json(
      { error: "Invalid status" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const nextStatus = body.status;

  const { data: existingJob, error: existingJobError } = await supabase
    .from("jobs")
    .select("status")
    .eq("id", id)
    .single();

  if (existingJobError || !existingJob || !isJobStatus(existingJob.status)) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (!ALLOWED_JOB_TRANSITIONS[existingJob.status].includes(nextStatus)) {
    return NextResponse.json(
      {
        error: `Invalid transition from ${existingJob.status} to ${nextStatus}`,
      },
      { status: 400 }
    );
  }

  const { data: currentJob, error: currentJobError } = await supabase
    .from("jobs")
    .select(
      "id, lead_id, status, quotes(id, public_token, payment_terms, payment_status, leads(conversation_id, design_status, fulfillment_mode, ai_image_prompt, ai_prompt_snapshot, requested_document_type))"
    )
    .eq("id", id)
    .single();

  if (currentJobError || !currentJob) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const quote = Array.isArray(currentJob.quotes)
    ? currentJob.quotes[0]
    : currentJob.quotes;
  const lead = Array.isArray(quote?.leads) ? quote.leads[0] : quote?.leads;

  if (nextStatus === "IN_PRODUCTION") {
    const paymentTerms = quote?.payment_terms as PaymentTerm | undefined;
    const paymentStatus = quote?.payment_status as PaymentStatus | undefined;
    const paymentReady =
      paymentTerms && paymentStatus
        ? paymentUnlocksProduction(paymentTerms, paymentStatus)
        : false;
    const commercialContext: CommercialAdminContext = quote?.id
      ? await fetchCommercialAdminContextForQuoteIds([quote.id])
      : { receiverEntities: [], orderByQuoteId: {} };
    const commercialOrder = quote?.id
      ? commercialContext.orderByQuoteId[quote.id] || null
      : null;
    const requestedDocumentType = lead?.requested_document_type || null;
    const requiredCommercialDocumentType = paymentReady
      ? requestedDocumentType === "tax_invoice"
        ? "tax_invoice"
        : requestedDocumentType === "receipt"
          ? "receipt"
          : null
      : null;
    const transitionValidation = validateTransition({
      entity: "job",
      action: "move_to_production",
      from_state: {
        job_status: currentJob.status,
        design_status: lead?.design_status || null,
        payment_terms: paymentTerms,
        payment_status: paymentStatus,
        required_document_type: requiredCommercialDocumentType,
        required_document_issued: Boolean(commercialOrder?.issuedDocumentId),
        commercial_review_required:
          Boolean(requiredCommercialDocumentType) &&
          (!commercialOrder?.selectedReceiverEntityId || !commercialOrder?.paymentReceiverLockedAt),
        payment_receiver_locked: Boolean(commercialOrder?.paymentReceiverLockedAt),
      },
    });

    if (transitionValidation.decision !== "allowed") {
      return NextResponse.json(
        {
          error: transitionValidation.reason,
          missingRequirements: transitionValidation.missing_requirements,
        },
        { status: 400 }
      );
    }
  }

  const jobUpdate: Record<string, string | null> = { status: nextStatus };
  let productionLinkUrl: string | null = null;

  if (nextStatus === "IN_DESIGN") {
    jobUpdate.production_status = "queued";
  }

  if (nextStatus === "IN_PRODUCTION") {
    jobUpdate.production_status = "in_progress";
    jobUpdate.fulfillment_status = "not_ready";

    const productionLink = await createOrReuseActiveProductionLink(supabase, id);
    productionLinkUrl = productionLink.url;
  }

  if (nextStatus === "READY_FOR_FULFILLMENT") {
    jobUpdate.production_status = "done";
    jobUpdate.fulfillment_status = "ready";
  }

  if (nextStatus === "COMPLETED") {
    jobUpdate.production_status = "done";
    jobUpdate.fulfillment_status =
      lead?.fulfillment_mode === "pickup" ? "picked_up" : "delivered";
    jobUpdate.completion_package_status = "sent";
    jobUpdate.completed_at = new Date().toISOString();
  }

  if (nextStatus === "CANCELLED") {
    jobUpdate.cancel_reason = body.note || "Cancelled by admin";
  }

  // 1. Update job status
  const { data: job, error } = await supabase
    .from("jobs")
    .update(jobUpdate)
    .eq("id", id)
    .select("*, quotes(public_token, leads(conversation_id))")
    .single();

  if (error || !job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // 2. Add timeline entry
  await supabase.from("job_timeline").insert({
    job_id: id,
    status: nextStatus,
    note: body.note || null,
  });

  // 3. Update conversation state
  const conversationId = job.quotes?.leads?.conversation_id;
  if (conversationId) {
    await supabase
      .from("conversations")
      .update({ state: getConversationStateForJobStatus(nextStatus) })
      .eq("id", conversationId);
  }

  // 4. Update lead status
  if (job.lead_id) {
    await supabase
      .from("leads")
      .update({
        status: getLeadStatusForJobStatus(nextStatus),
        hold_reason:
          nextStatus === "ON_HOLD_CUSTOMER_INPUT" ? body.note || null : null,
        human_review_reason:
          nextStatus === "HUMAN_REVIEW_REQUIRED" ? body.note || null : null,
        design_status:
          nextStatus === "IN_PRODUCTION" ? "approved" : undefined,
      })
      .eq("id", job.lead_id);
  }

  // 5. Notify customer
  try {
    if (conversationId && job.quotes?.public_token) {
      const { data: conv } = await supabase
        .from("conversations")
        .select("line_user_id")
        .eq("id", conversationId)
        .single();

      if (conv) {
        await pushStatusUpdate(
          conv.line_user_id,
          nextStatus,
          job.quotes.public_token
        );
      }
    }
  } catch (error) {
    console.error("Failed to notify customer:", error);
  }

  await logHumanAction(supabase, {
    entityType: "job",
    entityId: id,
    actionType: "job.status_changed",
    actorLabel: "Admin",
    note: body.note,
    payload: { from: existingJob.status, to: nextStatus, production_link_url: productionLinkUrl },
  });

  return NextResponse.json({
    success: true,
    status: nextStatus,
    productionLinkUrl,
  });
}
