import { createAdminClient } from "@/lib/supabase/admin";
import type {
  DesignStatus,
  JobStatus,
  PaymentStatus,
  PaymentTerm,
  WorkflowState,
} from "@/lib/types";
import { signJobMediaAssetPaths } from "@/lib/production-media";

export type SnapshotCustomer = {
  display_name: string | null;
  phone: string | null;
} | null;

export type SnapshotConversation = {
  id: string;
  line_user_id: string;
  state: WorkflowState;
  last_message_at: string;
  created_at: string;
};

export type SnapshotLead = {
  id: string;
  conversation_id: string | null;
  superseded_by_lead_id?: string | null;
  superseded_at?: string | null;
  supersede_reason?: string | null;
  product_type: string;
  width_mm: number;
  height_mm: number;
  qty: number;
  status: string;
  created_at: string;
  due_date?: string | null;
  note_from_form?: string | null;
  note_from_chat?: string | null;
  reference_info?: string | null;
  ai_image_prompt?: string | null;
  ai_image_status?: string | null;
  ai_generated_images?: string[] | null;
  design_status?: DesignStatus | null;
  assigned_designer?: string | null;
  fulfillment_mode?: string | null;
  hold_reason?: string | null;
  human_review_reason?: string | null;
  customers?: SnapshotCustomer;
};

export type SnapshotQuoteJobRef = {
  id: string;
  status: JobStatus;
  assigned_to?: string | null;
} | null;

export type SnapshotQuote = {
  id: string;
  lead_id: string;
  status: string;
  total: number;
  public_token: string;
  created_at: string;
  payment_terms: PaymentTerm;
  payment_status: PaymentStatus;
  leads?: (SnapshotLead & { customers?: SnapshotCustomer }) | null;
  quote_items?: Array<{
    id: string;
    label: string;
    qty: number;
    unit_price: number;
    line_total: number;
  }> | null;
  jobs?: SnapshotQuoteJobRef[] | null;
};

export type SnapshotProductionLink = {
  id: string;
  job_id: string;
  status: "active" | "revoked";
  expires_at: string | null;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SnapshotProductionAsset = {
  id: string;
  storage_path: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  width_px: number | null;
  height_px: number | null;
  deleted_at: string | null;
  expires_at: string | null;
  created_at: string;
  signed_url?: string | null;
};

export type SnapshotProductionEvent = {
  id: string;
  job_id: string;
  production_link_id: string;
  production_link_url?: string | null;
  event_type: "proof" | "ready_for_production" | "completed";
  note: string | null;
  submitted_by_label: string | null;
  review_status: "pending" | "approved" | "rejected" | "sent";
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  sent_to_customer_at: string | null;
  created_at: string;
  job_media_assets?: SnapshotProductionAsset[] | null;
  jobs?: {
    id: string;
    status: JobStatus;
    created_at: string;
    quotes?: (SnapshotQuote & {
      leads?: (SnapshotLead & { customers?: SnapshotCustomer }) | null;
    }) | null;
  } | null;
  job_production_links?: SnapshotProductionLink | null;
};

export type SnapshotJob = {
  id: string;
  lead_id: string;
  production_link_url?: string | null;
  status: JobStatus;
  assigned_to: string | null;
  production_status?: string | null;
  fulfillment_status?: string | null;
  completion_package_status?: string | null;
  completed_at?: string | null;
  cancel_reason?: string | null;
  created_at: string;
  quotes?: (SnapshotQuote & {
    leads?: (SnapshotLead & { customers?: SnapshotCustomer }) | null;
  }) | null;
  job_timeline?: Array<{
    id?: string;
    status: string;
    note?: string | null;
    created_at?: string;
  }> | null;
  job_production_links?: SnapshotProductionLink[] | null;
  job_media_events?: SnapshotProductionEvent[] | null;
};

export type SnapshotEscalation = {
  id: string;
  conversation_id: string;
  reason: string;
  status: string;
  created_at: string;
  conversations?: SnapshotConversation | null;
};

export type BackofficeSnapshot = {
  leads: SnapshotLead[];
  quotes: SnapshotQuote[];
  jobs: SnapshotJob[];
  productionReviewQueue: SnapshotProductionEvent[];
  escalations: SnapshotEscalation[];
  recentConversations: SnapshotConversation[];
  conversations: SnapshotConversation[];
};

const ACTIVE_JOB_STATUSES = new Set([
  "IN_DESIGN",
  "IN_PRODUCTION",
  "READY_FOR_FULFILLMENT",
]);

function mergeConversations(
  primary: SnapshotConversation[],
  secondary: SnapshotConversation[]
): SnapshotConversation[] {
  const merged = new Map<string, SnapshotConversation>();

  for (const conversation of [...primary, ...secondary]) {
    if (!conversation?.id) {
      continue;
    }

    if (!merged.has(conversation.id)) {
      merged.set(conversation.id, conversation);
    }
  }

  return Array.from(merged.values()).sort((left, right) => {
    const leftTime = new Date(left.last_message_at || left.created_at).getTime();
    const rightTime = new Date(right.last_message_at || right.created_at).getTime();
    return rightTime - leftTime;
  });
}

export async function fetchBackofficeSnapshot(): Promise<BackofficeSnapshot> {
  const supabase = createAdminClient();

  const [
    leadsRes,
    quotesRes,
    jobsRes,
    productionReviewQueueRes,
    escalationsRes,
    recentConversationsRes,
  ] =
    await Promise.all([
      supabase
        .from("leads")
        .select("*, customers(*)")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("quotes")
        .select("*, leads(*, customers(*)), quote_items(*), jobs(id, status, assigned_to)")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("jobs")
        .select(
          "*, quotes(*, leads(*, customers(*))), job_timeline(*), job_production_links(*), job_media_events(id, job_id, production_link_id, event_type, note, submitted_by_label, review_status, review_note, reviewed_by, reviewed_at, sent_to_customer_at, created_at)"
        )
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("job_media_events")
        .select(
          "id, job_id, production_link_id, event_type, note, submitted_by_label, review_status, review_note, reviewed_by, reviewed_at, sent_to_customer_at, created_at, job_media_assets(*), job_production_links(*), jobs(id, status, created_at, quotes(*, leads(*, customers(*))))"
        )
        .in("review_status", ["pending", "approved"])
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("escalations")
        .select("*, conversations(*)")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("conversations")
        .select("*")
        .order("last_message_at", { ascending: false })
        .limit(20),
    ]);

  const leads = (leadsRes.data || []) as SnapshotLead[];
  const quotes = (quotesRes.data || []) as SnapshotQuote[];
  let jobs = (jobsRes.data || []) as SnapshotJob[];
  if (jobsRes.error) {
    const fallbackJobsRes = await supabase
      .from("jobs")
      .select("*, quotes(*, leads(*, customers(*))), job_timeline(*)")
      .order("created_at", { ascending: false })
      .limit(50);

    jobs = (fallbackJobsRes.data || []) as SnapshotJob[];
  }

  const productionReviewQueue = productionReviewQueueRes.error
    ? []
    : ((productionReviewQueueRes.data || []) as unknown as SnapshotProductionEvent[]);
  const escalations = (escalationsRes.data || []) as SnapshotEscalation[];
  const recentConversations =
    (recentConversationsRes.data || []) as SnapshotConversation[];

  const productionAssetPaths = productionReviewQueue.flatMap((event) =>
    (event.job_media_assets || [])
      .filter((asset) => !asset.deleted_at)
      .map((asset) => asset.storage_path)
  );
  const signedAssetUrls =
    productionAssetPaths.length > 0
      ? await signJobMediaAssetPaths(supabase, productionAssetPaths)
      : {};

  const hydratedProductionReviewQueue = productionReviewQueue.map((event) => ({
    ...event,
    job_media_assets: (event.job_media_assets || []).map((asset) => ({
      ...asset,
      signed_url: signedAssetUrls[asset.storage_path] || null,
    })),
  }));

  const relatedConversationIds = new Set<string>();

  for (const lead of leads) {
    if (lead.conversation_id) {
      relatedConversationIds.add(lead.conversation_id);
    }
  }

  for (const quote of quotes) {
    if (quote.leads?.conversation_id) {
      relatedConversationIds.add(quote.leads.conversation_id);
    }
  }

  for (const job of jobs) {
    if (job.quotes?.leads?.conversation_id) {
      relatedConversationIds.add(job.quotes.leads.conversation_id);
    }
  }

  for (const escalation of escalations) {
    if (escalation.conversation_id) {
      relatedConversationIds.add(escalation.conversation_id);
    }
  }

  for (const conversation of recentConversations) {
    relatedConversationIds.delete(conversation.id);
  }

  let relatedConversations: SnapshotConversation[] = [];

  if (relatedConversationIds.size > 0) {
    const { data } = await supabase
      .from("conversations")
      .select("*")
      .in("id", Array.from(relatedConversationIds));

    relatedConversations = (data || []) as SnapshotConversation[];
  }

  return {
    leads,
    quotes,
    jobs,
    productionReviewQueue: hydratedProductionReviewQueue,
    escalations,
    recentConversations,
    conversations: mergeConversations(recentConversations, relatedConversations),
  };
}

export function getBackofficeKpis(snapshot: BackofficeSnapshot) {
  const activeLeads = snapshot.leads.filter((lead) => !lead.superseded_at);
  const quotesWaitingApproval = snapshot.quotes.filter(
    (quote) => quote.status === "sent"
  ).length;
  const activeJobsCount = snapshot.jobs.filter((job) =>
    ACTIVE_JOB_STATUSES.has(job.status)
  ).length;
  const blockedCount = snapshot.conversations.filter((conversation) =>
    ["WAITING_PAYMENT", "ON_HOLD_CUSTOMER_INPUT", "HUMAN_REVIEW_REQUIRED"].includes(
      conversation.state
    )
  ).length;

  return {
    leadsCount: activeLeads.length,
    quotesWaitingApproval,
    activeJobsCount,
    escalationsCount: snapshot.escalations.length,
    blockedCount,
  };
}
