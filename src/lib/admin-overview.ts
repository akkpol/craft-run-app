import { createAdminClient } from "./supabase/admin";
import { signLeadMediaAssetPaths } from "./customer-media";
import { getLeadAiDisplayPrompt, getLeadDesignRoutingSummary } from "./lead-ai-prompt";
import { buildProductionLinkUrl } from "./production-links";
import { getShareableProductionToken, isExpired } from "./production-media";
import {
  clampOverviewPage,
  paginateOverviewRows,
} from "./admin-overview-pagination";
import type {
  JobStatus,
  PaymentStatus,
  PaymentTerm,
  WorkflowState,
} from "./types";
import type {
  SnapshotConversation,
  SnapshotCustomer,
  SnapshotEscalation,
  SnapshotJob,
  SnapshotLead,
  SnapshotProductionEvent,
  SnapshotProductionLink,
  SnapshotQuote,
} from "./backoffice-snapshot";

export const ADMIN_OVERVIEW_PAGE_SIZE = 25;

export const ADMIN_OVERVIEW_FILTER_KEYS = [
  "all",
  "escalation",
  "blocked",
  "waiting-customer",
  "quote",
  "production-review",
  "running-job",
] as const;

const ACTIVE_JOB_STATUSES: JobStatus[] = [
  "IN_DESIGN",
  "IN_PRODUCTION",
  "READY_FOR_FULFILLMENT",
  "ON_HOLD_CUSTOMER_INPUT",
  "HUMAN_REVIEW_REQUIRED",
];

type ConversationBundle = {
  lead: SnapshotLead | null;
  quote: SnapshotQuote | null;
  job: SnapshotJob | null;
};

export type OverviewFilterKey = (typeof ADMIN_OVERVIEW_FILTER_KEYS)[number];
export type OverviewRowFilterKey = Exclude<OverviewFilterKey, "all">;

export type OverviewCounts = Record<OverviewFilterKey, number>;

type BaseOverviewRow = {
  id: string;
  filterKey: OverviewRowFilterKey;
  sortAt: string;
  customerLabel: string;
  productLabel: string;
  documentRequestType: string | null;
  billingEntityType: string | null;
  billingName: string | null;
  lineFriendshipStatus: boolean | null;
  liffContextType: string | null;
  liffAppLanguage: string | null;
};

export type AdminOverviewRow =
  | (BaseOverviewRow & {
      kind: "escalation";
      filterKey: "escalation";
      createdAt: string;
      reason: string;
      conversationId: string | null;
      conversationState: WorkflowState | null;
      quoteStatus: string | null;
      paymentStatus: PaymentStatus | null;
    })
  | (BaseOverviewRow & {
      kind: "conversation";
      filterKey: "blocked" | "waiting-customer";
      messageAt: string;
      conversationId: string;
      conversationState: WorkflowState;
      note: string | null;
      quoteStatus: string | null;
      paymentStatus: PaymentStatus | null;
      jobStatus: JobStatus | null;
    })
  | (BaseOverviewRow & {
      kind: "quote";
      filterKey: "quote";
      createdAt: string;
      quoteId: string;
      total: number;
      publicToken: string;
      quoteStatus: string;
      paymentTerms: PaymentTerm;
      paymentStatus: PaymentStatus;
      hasJob: boolean;
    })
  | (BaseOverviewRow & {
      kind: "production-review";
      filterKey: "production-review";
      createdAt: string;
      eventId: string;
      eventType: SnapshotProductionEvent["event_type"];
      assetCount: number;
      note: string | null;
      submittedByLabel: string | null;
      reviewStatus: SnapshotProductionEvent["review_status"];
      sentToCustomerAt: string | null;
      productionLinkUrl: string | null;
      statusToken: string | null;
    })
  | (BaseOverviewRow & {
      kind: "running-job";
      filterKey: "running-job";
      createdAt: string;
      jobId: string;
      leadId: string;
      publicToken: string | null;
      pendingReviewCount: number;
      assignedTo: string | null;
      uploadedReferenceCount: number;
      previewImageCount: number;
      previewImageUrl: string | null;
      promptText: string;
      promptRoutingLabel: string | null;
      aiImageStatus: string | null;
      jobStatus: JobStatus;
      productionStatus: string | null;
      productionLinkUrl: string | null;
    });

export type AdminOverviewPage = {
  filter: OverviewFilterKey;
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  counts: OverviewCounts;
  rows: AdminOverviewRow[];
};

function rangeEnd(offset: number, limit: number) {
  return offset + limit - 1;
}

function customerLabel(value: SnapshotCustomer | undefined, fallback = "ลูกค้า") {
  return value?.display_name || fallback;
}

function productLabel(value: string | null | undefined, fallback = "ยังไม่มี lead ผูก") {
  return value || fallback;
}

function formatLineUserLabel(lineUserId: string | null | undefined) {
  return lineUserId ? `LINE ${lineUserId.slice(0, 12)}...` : "ลูกค้า";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function buildLeadContextMeta(lead: SnapshotLead | null | undefined) {
  const customer = lead?.customers || null;
  const lastLiffContext = asRecord(customer?.last_liff_context);
  const liffContext = asRecord(lastLiffContext?.context);

  return {
    documentRequestType: lead?.requested_document_type || null,
    billingEntityType: lead?.billing_entity_type || null,
    billingName: lead?.billing_name || null,
    lineFriendshipStatus:
      typeof customer?.line_friendship_status === "boolean"
        ? customer.line_friendship_status
        : null,
    liffContextType: asString(liffContext?.type),
    liffAppLanguage: asString(lastLiffContext?.appLanguage),
  };
}

function buildActiveProductionLinkUrl(
  baseUrl: string,
  links: SnapshotProductionLink[] | null | undefined
) {
  const activeLink = (links || []).find(
    (link) => link.status === "active" && !isExpired(link.expires_at)
  );

  return activeLink
    ? buildProductionLinkUrl(baseUrl, getShareableProductionToken(activeLink.id))
    : null;
}

function buildLinkedProductionLinkUrl(
  baseUrl: string,
  link: SnapshotProductionLink | null | undefined
) {
  if (!link || link.status !== "active" || isExpired(link.expires_at)) {
    return null;
  }

  return buildProductionLinkUrl(baseUrl, getShareableProductionToken(link.id));
}

function getLeadPreviewImageUrl(lead: SnapshotLead | null | undefined) {
  return Array.isArray(lead?.ai_generated_images)
    ? lead.ai_generated_images[0] || null
    : null;
}

export function isOverviewFilterKey(value: string): value is OverviewFilterKey {
  return (ADMIN_OVERVIEW_FILTER_KEYS as readonly string[]).includes(value);
}

async function fetchConversationBundles(
  conversationIds: string[]
): Promise<Map<string, ConversationBundle>> {
  const supabase = createAdminClient();
  const dedupedConversationIds = [...new Set(conversationIds.filter(Boolean))];

  if (dedupedConversationIds.length === 0) {
    return new Map();
  }

  const { data: leadsData } = await supabase
    .from("leads")
    .select(
      "id, conversation_id, product_type, hold_reason, note_from_chat, requested_document_type, billing_entity_type, billing_name, customers(display_name, line_friendship_status, last_liff_context)"
    )
    .in("conversation_id", dedupedConversationIds);

  const leads = (leadsData || []) as unknown as SnapshotLead[];
  const leadIds = leads.map((lead) => lead.id);
  const leadById = new Map(leads.map((lead) => [lead.id, lead]));
  const leadByConversationId = new Map(
    leads
      .filter((lead) => lead.conversation_id)
      .map((lead) => [lead.conversation_id as string, lead])
  );

  let quotes: SnapshotQuote[] = [];
  let jobs: SnapshotJob[] = [];

  if (leadIds.length > 0) {
    const [{ data: quotesData }, { data: jobsData }] = await Promise.all([
      supabase
        .from("quotes")
        .select(
          "id, lead_id, status, total, public_token, created_at, payment_terms, payment_status, leads(id, conversation_id, product_type, requested_document_type, billing_entity_type, billing_name, customers(display_name, line_friendship_status, last_liff_context))"
        )
        .in("lead_id", leadIds)
        .order("created_at", { ascending: false }),
      supabase
        .from("jobs")
        .select("id, lead_id, status, created_at")
        .in("lead_id", leadIds)
        .order("created_at", { ascending: false }),
    ]);

    quotes = (quotesData || []) as unknown as SnapshotQuote[];
    jobs = (jobsData || []) as unknown as SnapshotJob[];
  }

  const quoteByConversationId = new Map<string, SnapshotQuote>();
  for (const quote of quotes) {
    const conversationId = quote.leads?.conversation_id;
    if (conversationId && !quoteByConversationId.has(conversationId)) {
      quoteByConversationId.set(conversationId, quote);
    }
  }

  const jobByConversationId = new Map<string, SnapshotJob>();
  for (const job of jobs) {
    const lead = leadById.get(job.lead_id);
    const conversationId = lead?.conversation_id;
    if (conversationId && !jobByConversationId.has(conversationId)) {
      jobByConversationId.set(conversationId, job);
    }
  }

  return new Map(
    dedupedConversationIds.map((conversationId) => [
      conversationId,
      {
        lead: leadByConversationId.get(conversationId) || null,
        quote: quoteByConversationId.get(conversationId) || null,
        job: jobByConversationId.get(conversationId) || null,
      },
    ])
  );
}

async function fetchEscalations(
  limit: number,
  offset = 0
) {
  if (limit <= 0) {
    return [] as SnapshotEscalation[];
  }

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("escalations")
    .select("id, conversation_id, reason, status, created_at, conversations(id, line_user_id, state, last_message_at, created_at)")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .range(offset, rangeEnd(offset, limit));

  return (data || []) as unknown as SnapshotEscalation[];
}

async function fetchConversationsByStates(
  states: WorkflowState[],
  limit: number,
  offset = 0
) {
  if (limit <= 0) {
    return [] as SnapshotConversation[];
  }

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("conversations")
    .select("id, line_user_id, state, last_message_at, created_at")
    .in("state", states)
    .order("last_message_at", { ascending: false })
    .range(offset, rangeEnd(offset, limit));

  return (data || []) as SnapshotConversation[];
}

async function fetchStalledQuotesWindow(limit: number) {
  if (limit <= 0) {
    return [] as SnapshotQuote[];
  }

  const supabase = createAdminClient();
  const quoteSelect = "id, lead_id, status, total, public_token, created_at, payment_terms, payment_status, leads(id, conversation_id, product_type, requested_document_type, billing_entity_type, billing_name, customers(display_name, line_friendship_status, last_liff_context)), jobs!left(id, status, assigned_to)";
  const [{ data: sentData }, { data: approvedData }] = await Promise.all([
    supabase
      .from("quotes")
      .select(quoteSelect)
      .eq("status", "sent")
      .order("created_at", { ascending: false })
      .range(0, limit - 1),
    supabase
      .from("quotes")
      .select(quoteSelect)
      .eq("status", "approved")
      .is("jobs.id", null)
      .order("created_at", { ascending: false })
      .range(0, limit - 1),
  ]);

  return [
    ...((sentData || []) as unknown as SnapshotQuote[]),
    ...((approvedData || []) as unknown as SnapshotQuote[]),
  ]
    .sort(
      (left, right) =>
        new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
    );
}

async function fetchPendingProductionReviews(
  limit: number,
  offset = 0
) {
  if (limit <= 0) {
    return [] as SnapshotProductionEvent[];
  }

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("job_media_events")
    .select(
      "id, job_id, production_link_id, event_type, note, submitted_by_label, review_status, sent_to_customer_at, created_at, job_media_assets(id), job_production_links(id, status, expires_at, last_used_at, created_at, updated_at, job_id), jobs(id, status, created_at, quotes(public_token, leads(product_type, requested_document_type, billing_entity_type, billing_name, customers(display_name, line_friendship_status, last_liff_context))))"
    )
    .eq("review_status", "pending")
    .order("created_at", { ascending: false })
    .range(offset, rangeEnd(offset, limit));

  return (data || []) as unknown as SnapshotProductionEvent[];
}

async function fetchRunningJobs(
  limit: number,
  offset = 0
) {
  if (limit <= 0) {
    return [] as SnapshotJob[];
  }

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("jobs")
    .select(
      "id, lead_id, status, assigned_to, production_status, created_at, quotes(public_token, leads(id, product_type, width_mm, height_mm, qty, note_from_form, reference_info, requested_document_type, billing_entity_type, billing_name, design_brief, ai_image_prompt, ai_prompt_snapshot, ai_image_status, ai_generated_images, lead_media_assets(id, lead_id, storage_path, storage_provider, storage_bucket, original_file_name, mime_type, file_size_bytes, created_at), customers(display_name, line_friendship_status, last_liff_context))), job_production_links(id, job_id, status, expires_at, last_used_at, created_at, updated_at), job_media_events(id, review_status)"
    )
    .in("status", ACTIVE_JOB_STATUSES)
    .order("created_at", { ascending: false })
    .range(offset, rangeEnd(offset, limit));

  const jobs = (data || []) as unknown as SnapshotJob[];
  const leadAssets = jobs.flatMap(
    (job) => job.quotes?.leads?.lead_media_assets || []
  );
  const signedLeadAssetUrls =
    leadAssets.length > 0
      ? await signLeadMediaAssetPaths(supabase, leadAssets)
      : {};

  return jobs.map((job) => {
    const lead = job.quotes?.leads || null;

    if (!lead || !job.quotes) {
      return job;
    }

    return {
      ...job,
      quotes: {
        ...job.quotes,
        leads: {
          ...lead,
          lead_media_assets: (lead.lead_media_assets || []).map((asset) => ({
            ...asset,
            signed_url: signedLeadAssetUrls[asset.storage_path] || null,
          })),
        },
      },
    };
  });
}

async function fetchOverviewCounts(): Promise<OverviewCounts> {
  const supabase = createAdminClient();

  const [
    escalationRes,
    blockedRes,
    waitingCustomerRes,
    sentQuotesRes,
    approvedNoJobQuotesRes,
    pendingReviewRes,
    runningJobsRes,
  ] = await Promise.all([
    supabase
      .from("escalations")
      .select("id", { count: "exact", head: true })
      .eq("status", "open"),
    supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .in("state", ["WAITING_PAYMENT", "HUMAN_REVIEW_REQUIRED"]),
    supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("state", "ON_HOLD_CUSTOMER_INPUT"),
    supabase
      .from("quotes")
      .select("id", { count: "exact", head: true })
      .eq("status", "sent"),
    supabase
      .from("quotes")
      .select("id, jobs!left(id)", { count: "exact", head: true })
      .eq("status", "approved")
      .is("jobs.id", null),
    supabase
      .from("job_media_events")
      .select("id", { count: "exact", head: true })
      .eq("review_status", "pending"),
    supabase
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .in("status", ACTIVE_JOB_STATUSES),
  ]);

  const counts: OverviewCounts = {
    all: 0,
    escalation: escalationRes.count || 0,
    blocked: blockedRes.count || 0,
    "waiting-customer": waitingCustomerRes.count || 0,
    quote: (sentQuotesRes.count || 0) + (approvedNoJobQuotesRes.count || 0),
    "production-review": pendingReviewRes.count || 0,
    "running-job": runningJobsRes.count || 0,
  };

  counts.all =
    counts.escalation +
    counts.blocked +
    counts["waiting-customer"] +
    counts.quote +
    counts["production-review"] +
    counts["running-job"];

  return counts;
}

function buildEscalationRows(
  escalations: SnapshotEscalation[],
  bundles: Map<string, ConversationBundle>
): AdminOverviewRow[] {
  return escalations.map((escalation) => {
    const conversation = escalation.conversations || null;
    const bundle = escalation.conversation_id
      ? bundles.get(escalation.conversation_id)
      : null;
    const lead = bundle?.lead || null;
    const quote = bundle?.quote || null;

    return {
      ...buildLeadContextMeta(lead),
      kind: "escalation",
      id: escalation.id,
      filterKey: "escalation",
      sortAt: escalation.created_at,
      createdAt: escalation.created_at,
      customerLabel: lead
        ? customerLabel(lead.customers)
        : formatLineUserLabel(conversation?.line_user_id),
      productLabel: lead ? productLabel(lead.product_type) : "ยังไม่มี lead ผูก",
      reason: escalation.reason,
      conversationId: conversation?.id || null,
      conversationState: conversation?.state || null,
      quoteStatus: quote?.status || null,
      paymentStatus: quote?.payment_status || null,
    };
  });
}

function buildConversationRows(
  filterKey: "blocked" | "waiting-customer",
  conversations: SnapshotConversation[],
  bundles: Map<string, ConversationBundle>
): AdminOverviewRow[] {
  return conversations.map((conversation) => {
    const bundle = bundles.get(conversation.id);
    const lead = bundle?.lead || null;
    const quote = bundle?.quote || null;
    const job = bundle?.job || null;

    return {
      ...buildLeadContextMeta(lead),
      kind: "conversation",
      id: conversation.id,
      filterKey,
      sortAt: conversation.last_message_at || conversation.created_at,
      messageAt: conversation.last_message_at || conversation.created_at,
      conversationId: conversation.id,
      conversationState: conversation.state,
      customerLabel: lead
        ? customerLabel(lead.customers)
        : formatLineUserLabel(conversation.line_user_id),
      productLabel: lead ? productLabel(lead.product_type) : "ยังไม่มี lead ผูก",
      note: lead?.hold_reason || lead?.note_from_chat || null,
      quoteStatus: quote?.status || null,
      paymentStatus: quote?.payment_status || null,
      jobStatus: job?.status || null,
    };
  });
}

function buildQuoteRows(quotes: SnapshotQuote[]): AdminOverviewRow[] {
  return quotes.map((quote) => ({
    ...buildLeadContextMeta(quote.leads),
    kind: "quote",
    id: quote.id,
    quoteId: quote.id,
    filterKey: "quote",
    sortAt: quote.created_at,
    createdAt: quote.created_at,
    customerLabel: customerLabel(quote.leads?.customers),
    productLabel: productLabel(quote.leads?.product_type),
    total: quote.total,
    publicToken: quote.public_token,
    quoteStatus: quote.status,
    paymentTerms: quote.payment_terms,
    paymentStatus: quote.payment_status,
    hasJob: Array.isArray(quote.jobs) && quote.jobs.length > 0,
  }));
}

function buildProductionReviewRows(
  events: SnapshotProductionEvent[],
  baseUrl: string
): AdminOverviewRow[] {
  return events.map((event) => {
    const job = event.jobs as SnapshotProductionEvent["jobs"];
    const quote = job?.quotes || null;
    const lead = quote?.leads || null;

    return {
      ...buildLeadContextMeta(lead),
      kind: "production-review",
      id: event.id,
      eventId: event.id,
      filterKey: "production-review",
      sortAt: event.created_at,
      createdAt: event.created_at,
      customerLabel: customerLabel(lead?.customers),
      productLabel: productLabel(lead?.product_type),
      eventType: event.event_type,
      assetCount: event.job_media_assets?.length || 0,
      note: event.note,
      submittedByLabel: event.submitted_by_label,
      reviewStatus: event.review_status,
      sentToCustomerAt: event.sent_to_customer_at,
      productionLinkUrl: buildLinkedProductionLinkUrl(
        baseUrl,
        event.job_production_links || null
      ),
      statusToken: quote?.public_token || null,
    };
  });
}

function buildRunningJobRows(
  jobs: SnapshotJob[],
  baseUrl: string
): AdminOverviewRow[] {
  return jobs.map((job) => {
    const lead = job.quotes?.leads || null;
    const uploadedReferenceCount = lead?.lead_media_assets?.length || 0;
    const previewImageCount = Array.isArray(lead?.ai_generated_images)
      ? lead.ai_generated_images.length
      : 0;

    return {
      ...buildLeadContextMeta(lead),
      kind: "running-job",
      id: job.id,
      jobId: job.id,
      leadId: lead?.id || job.lead_id,
      filterKey: "running-job",
      sortAt: job.created_at,
      createdAt: job.created_at,
      customerLabel: customerLabel(lead?.customers),
      productLabel: productLabel(lead?.product_type),
      publicToken: job.quotes?.public_token || null,
      pendingReviewCount:
        job.job_media_events?.filter((event) => event.review_status === "pending")
          .length || 0,
      assignedTo: job.assigned_to,
      uploadedReferenceCount,
      previewImageCount,
      previewImageUrl: getLeadPreviewImageUrl(lead),
      promptText: lead ? getLeadAiDisplayPrompt(lead) : "",
      promptRoutingLabel:
        job.status === "IN_DESIGN" && lead
          ? getLeadDesignRoutingSummary(lead)
          : null,
      aiImageStatus: lead?.ai_image_status || null,
      jobStatus: job.status,
      productionStatus: job.production_status || null,
      productionLinkUrl: buildActiveProductionLinkUrl(
        baseUrl,
        job.job_production_links
      ),
    };
  });
}

async function fetchRowsForFilter(
  filter: OverviewFilterKey,
  page: number,
  pageSize: number,
  baseUrl: string
) {
  const offset = (page - 1) * pageSize;

  if (filter === "escalation") {
    const escalations = await fetchEscalations(pageSize, offset);
    const bundles = await fetchConversationBundles(
      escalations.map((item) => item.conversation_id)
    );
    return buildEscalationRows(escalations, bundles);
  }

  if (filter === "blocked") {
    const conversations = await fetchConversationsByStates(
      ["WAITING_PAYMENT", "HUMAN_REVIEW_REQUIRED"],
      pageSize,
      offset
    );
    const bundles = await fetchConversationBundles(
      conversations.map((item) => item.id)
    );
    return buildConversationRows("blocked", conversations, bundles);
  }

  if (filter === "waiting-customer") {
    const conversations = await fetchConversationsByStates(
      ["ON_HOLD_CUSTOMER_INPUT"],
      pageSize,
      offset
    );
    const bundles = await fetchConversationBundles(
      conversations.map((item) => item.id)
    );
    return buildConversationRows("waiting-customer", conversations, bundles);
  }

  if (filter === "quote") {
    const quotes = await fetchStalledQuotesWindow(offset + pageSize);
    return paginateOverviewRows(buildQuoteRows(quotes), page, pageSize);
  }

  if (filter === "production-review") {
    const events = await fetchPendingProductionReviews(pageSize, offset);
    return buildProductionReviewRows(events, baseUrl);
  }

  if (filter === "running-job") {
    const jobs = await fetchRunningJobs(pageSize, offset);
    return buildRunningJobRows(jobs, baseUrl);
  }

  const windowSize = offset + pageSize;
  const [escalations, blockedConversations, waitingCustomerConversations, quotes, events, jobs] =
    await Promise.all([
      fetchEscalations(windowSize),
      fetchConversationsByStates(
        ["WAITING_PAYMENT", "HUMAN_REVIEW_REQUIRED"],
        windowSize
      ),
      fetchConversationsByStates(["ON_HOLD_CUSTOMER_INPUT"], windowSize),
      fetchStalledQuotesWindow(windowSize),
      fetchPendingProductionReviews(windowSize),
      fetchRunningJobs(windowSize),
    ]);

  const bundles = await fetchConversationBundles([
    ...escalations.map((item) => item.conversation_id),
    ...blockedConversations.map((item) => item.id),
    ...waitingCustomerConversations.map((item) => item.id),
  ]);

  return paginateOverviewRows(
    [
      ...buildEscalationRows(escalations, bundles),
      ...buildConversationRows("blocked", blockedConversations, bundles),
      ...buildConversationRows(
        "waiting-customer",
        waitingCustomerConversations,
        bundles
      ),
      ...buildQuoteRows(quotes),
      ...buildProductionReviewRows(events, baseUrl),
      ...buildRunningJobRows(jobs, baseUrl),
    ],
    page,
    pageSize
  );
}

export async function fetchAdminOverviewPage(input: {
  filter: OverviewFilterKey;
  page: number;
  pageSize?: number;
  baseUrl: string;
}): Promise<AdminOverviewPage> {
  const pageSize = input.pageSize || ADMIN_OVERVIEW_PAGE_SIZE;
  const counts = await fetchOverviewCounts();
  const totalCount = input.filter === "all" ? counts.all : counts[input.filter];
  const page = clampOverviewPage(input.page, totalCount, pageSize);
  const rows = await fetchRowsForFilter(input.filter, page, pageSize, input.baseUrl);

  return {
    filter: input.filter,
    page,
    pageSize,
    totalCount,
    totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
    counts,
    rows,
  };
}