import { pushStatusUpdate } from "@/lib/line";
import { createAdminClient } from "@/lib/supabase/admin";
import { logSystemAction } from "@/lib/action-log";
import type {
  CompletionPackageStatus,
  DesignAssignmentMode,
  DesignExecutor,
  DesignStatus,
  FulfillmentMode,
  FulfillmentStatus,
  JobStatus,
  PaymentStatus,
  PaymentTerm,
  QuoteStatus,
  ProductionStatus,
  WorkflowState,
} from "@/lib/types";

type AdminClient = ReturnType<typeof createAdminClient>;

type QuoteWorkflowRecord = {
  id: string;
  lead_id: string;
  public_token: string;
  status?: QuoteStatus;
  payment_terms: PaymentTerm;
  payment_status: PaymentStatus;
  jobs?: Array<{ id: string }> | null;
  leads?: {
    conversation_id?: string | null;
  } | null;
};

type ApproveQuoteResult = {
  success: true;
  jobId: string | null;
  jobCreated: boolean;
  requiresPayment: boolean;
  message: string;
};

type JobOperationalDefaults = {
  status: JobStatus;
  productionStatus: ProductionStatus;
  fulfillmentStatus: FulfillmentStatus;
  completionPackageStatus: CompletionPackageStatus;
};

export function getQuoteApprovalState(
  paymentTerms: PaymentTerm,
  paymentStatus: PaymentStatus
): WorkflowState {
  return paymentUnlocksProduction(paymentTerms, paymentStatus)
    ? "IN_DESIGN"
    : "WAITING_PAYMENT";
}

export function getLeadOperationalDefaults(
  fulfillmentMode: FulfillmentMode | null | undefined
): {
  fulfillment_mode: FulfillmentMode;
  design_assignment_mode: DesignAssignmentMode;
  design_executor: DesignExecutor;
  design_status: DesignStatus;
} {
  return {
    fulfillment_mode: fulfillmentMode ?? "delivery",
    design_assignment_mode: "manual",
    design_executor: "unassigned",
    design_status: "not_started",
  };
}

export function getJobOperationalDefaults(
  status: JobStatus
): JobOperationalDefaults {
  if (status === "COMPLETED") {
    return {
      status,
      productionStatus: "done",
      fulfillmentStatus: "delivered",
      completionPackageStatus: "pending",
    };
  }

  if (status === "READY_FOR_FULFILLMENT") {
    return {
      status,
      productionStatus: "done",
      fulfillmentStatus: "ready",
      completionPackageStatus: "not_required",
    };
  }

  if (status === "IN_PRODUCTION") {
    return {
      status,
      productionStatus: "in_progress",
      fulfillmentStatus: "not_ready",
      completionPackageStatus: "not_required",
    };
  }

  return {
    status,
    productionStatus: "queued",
    fulfillmentStatus: "not_ready",
    completionPackageStatus: "not_required",
  };
}

export function paymentUnlocksProduction(
  paymentTerms: PaymentTerm,
  paymentStatus: PaymentStatus
): boolean {
  if (paymentTerms === "credit") {
    return true;
  }

  if (paymentTerms === "deposit") {
    return paymentStatus === "partial" || paymentStatus === "paid";
  }

  return paymentStatus === "paid";
}

export async function createJobForApprovedQuote(
  supabase: AdminClient,
  quote: QuoteWorkflowRecord
) {
  const { data: existingJob } = await supabase
    .from("jobs")
    .select("id")
    .eq("quote_id", quote.id)
    .limit(1)
    .single();

  if (existingJob) {
    return { created: false, jobId: existingJob.id };
  }

  const { data: job } = await supabase
    .from("jobs")
    .insert({
      quote_id: quote.id,
      lead_id: quote.lead_id,
      status: "IN_DESIGN",
      production_status: "queued",
      fulfillment_status: "not_ready",
      completion_package_status: "not_required",
    })
    .select("id")
    .single();

  if (!job) {
    throw new Error("Failed to create job");
  }

  await supabase.from("job_timeline").insert({
    job_id: job.id,
    status: "IN_DESIGN",
    note: "Job created from approved quote and moved to design",
  });

  await logSystemAction(supabase, {
    entityType: "job",
    entityId: job.id,
    actionType: "job.created",
    serviceName: "quote-workflow",
    payload: { quote_id: quote.id, lead_id: quote.lead_id },
  });

  if (quote.leads?.conversation_id) {
    await supabase
      .from("conversations")
      .update({ state: "IN_DESIGN" })
      .eq("id", quote.leads.conversation_id);
  }

  await supabase
    .from("leads")
    .update({
      status: "approved",
      design_status: "not_started",
      design_assignment_mode: "manual",
      design_executor: "unassigned",
    })
    .eq("id", quote.lead_id);

  try {
    if (quote.leads?.conversation_id) {
      const { data: conv } = await supabase
        .from("conversations")
        .select("line_user_id")
        .eq("id", quote.leads.conversation_id)
        .single();

      if (conv) {
        await pushStatusUpdate(conv.line_user_id, "IN_DESIGN", quote.public_token);
      }
    }
  } catch (error) {
    console.error("Failed to notify customer:", error);
  }

  return { created: true, jobId: job.id };
}

export async function approveQuote(
  supabase: AdminClient,
  quote: QuoteWorkflowRecord
): Promise<ApproveQuoteResult> {
  const nextPaymentStatus =
    quote.payment_terms === "credit" ? "not_required" : quote.payment_status;
  const existingJobs = Array.isArray(quote.jobs) ? quote.jobs : [];
  const nextWorkflowState = getQuoteApprovalState(
    quote.payment_terms,
    nextPaymentStatus
  );

  if (quote.status !== "approved") {
    await supabase
      .from("quotes")
      .update({ status: "approved", payment_status: nextPaymentStatus })
      .eq("id", quote.id);

    await supabase
      .from("leads")
      .update({ status: "approved" })
      .eq("id", quote.lead_id);
  }

  if (paymentUnlocksProduction(quote.payment_terms, nextPaymentStatus)) {
    const jobResult = await createJobForApprovedQuote(supabase, {
      ...quote,
      payment_status: nextPaymentStatus,
      status: "approved",
    });

    return {
      success: true,
      jobId: jobResult.jobId,
      jobCreated: jobResult.created,
      requiresPayment: false,
      message: jobResult.created
        ? "Quote approved, job created"
        : "Quote already approved",
    };
  }

  if (quote.leads?.conversation_id) {
    await supabase
      .from("conversations")
      .update({ state: nextWorkflowState })
      .eq("id", quote.leads.conversation_id);
  }

  return {
    success: true,
    jobId: existingJobs[0]?.id ?? null,
    jobCreated: false,
    requiresPayment: true,
    message:
      quote.payment_terms === "deposit"
        ? "อนุมัติแล้ว รอรับมัดจำก่อนเริ่มผลิต"
        : "อนุมัติแล้ว รอชำระเงินก่อนเริ่มผลิต",
  };
}
