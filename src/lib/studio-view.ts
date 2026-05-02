import {
  DESIGN_STATUS_LABELS,
  JOB_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_TERM_LABELS,
  PRODUCT_TYPES,
  WORKFLOW_STATE_LABELS,
  isJobStatus,
  isWorkflowState,
  type WorkflowState,
} from "@/lib/types";
import { hasLeadAiSeedPrompt } from "@/lib/lead-ai-prompt";
import { getQuoteApprovalState } from "@/lib/quote-workflow";
import type {
  BackofficeSnapshot,
  SnapshotConversation,
  SnapshotEscalation,
  SnapshotJob,
  SnapshotLead,
  SnapshotQuote,
} from "@/lib/backoffice-snapshot";

const STUDIO_AMOUNT_FORMATTER = new Intl.NumberFormat("en-US");

type StudioFilter = {
  id: "all" | "design" | "production" | "blocked" | "assigned";
  label: string;
  matches: (token: StudioToken) => boolean;
};

export const STUDIO_FILTERS: readonly StudioFilter[] = [
  {
    id: "all",
    label: "All",
    matches: () => true,
  },
  {
    id: "design",
    label: "Design",
    matches: (token: StudioToken) =>
      token.stationId === "design" || token.designStatus !== null,
  },
  {
    id: "production",
    label: "Production",
    matches: (token: StudioToken) =>
      token.stationId === "production" || token.stationId === "packing",
  },
  {
    id: "blocked",
    label: "Blocked",
    matches: (token: StudioToken) => token.priorityTone === "blocked",
  },
  {
    id: "assigned",
    label: "Assigned",
    matches: (token: StudioToken) => Boolean(token.ownerLabel),
  },
] as const;

export type StudioFilterId = (typeof STUDIO_FILTERS)[number]["id"];

export const STUDIO_STATIONS = [
  {
    id: "inbox",
    label: "Inbox / Sales",
    icon: "📥",
    roleLabel: "Sales",
    description: "เก็บ requirement และจัดคิวงานเข้าระบบ",
    states: [
      "NEW_MESSAGE",
      "COLLECTING_REQUIREMENTS",
      "REQUIREMENTS_REVIEW",
    ] as WorkflowState[],
    gridArea: "1 / 1 / 2 / 3",
  },
  {
    id: "quote",
    label: "Quote Desk",
    icon: "🧾",
    roleLabel: "Quoting",
    description: "ออกใบเสนอราคาและรอการตัดสินใจ",
    states: ["WAITING_QUOTE_APPROVAL"] as WorkflowState[],
    gridArea: "1 / 3 / 2 / 5",
  },
  {
    id: "cashier",
    label: "Cashier Gate",
    icon: "💳",
    roleLabel: "Cashier",
    description: "ปลดล็อกงานเมื่อ payment ผ่าน",
    states: ["WAITING_PAYMENT"] as WorkflowState[],
    gridArea: "1 / 5 / 2 / 7",
  },
  {
    id: "design",
    label: "Design Corner",
    icon: "🎨",
    roleLabel: "Design",
    description: "ส่งแบบ อนุมัติแบบ และวนแก้งาน",
    states: ["IN_DESIGN"] as WorkflowState[],
    gridArea: "2 / 2 / 3 / 4",
  },
  {
    id: "production",
    label: "Production Line",
    icon: "🖨️",
    roleLabel: "Production",
    description: "เริ่มผลิตเมื่อ payment และ design พร้อม",
    states: ["IN_PRODUCTION"] as WorkflowState[],
    gridArea: "2 / 4 / 3 / 6",
  },
  {
    id: "packing",
    label: "Packing Shelf",
    icon: "📦",
    roleLabel: "Dispatch",
    description: "แพ็ก เตรียมส่ง และปิดงาน",
    states: ["READY_FOR_FULFILLMENT"] as WorkflowState[],
    gridArea: "2 / 6 / 3 / 8",
  },
  {
    id: "hold",
    label: "Hold Couch",
    icon: "🛋️",
    roleLabel: "Waiting",
    description: "งานที่รอลูกค้าตอบหรือรอข้อมูลเพิ่ม",
    states: ["ON_HOLD_CUSTOMER_INPUT"] as WorkflowState[],
    gridArea: "3 / 2 / 4 / 4",
  },
  {
    id: "review",
    label: "Review Booth",
    icon: "🔎",
    roleLabel: "Review",
    description: "งานที่ต้องให้ทีมช่วยดูหรือปลดคอขวด",
    states: ["HUMAN_REVIEW_REQUIRED"] as WorkflowState[],
    gridArea: "3 / 4 / 4 / 6",
  },
  {
    id: "archive",
    label: "Archive Shelf",
    icon: "🗂️",
    roleLabel: "Archive",
    description: "งานที่เสร็จแล้วหรือปิดทิ้ง",
    states: ["COMPLETED", "CANCELLED"] as WorkflowState[],
    gridArea: "3 / 6 / 4 / 8",
  },
] as const;

export type StudioStationId = (typeof STUDIO_STATIONS)[number]["id"];
type StationDef = (typeof STUDIO_STATIONS)[number];

type StudioTokenKind = "conversation" | "quote" | "job";
type StudioPriorityTone = "neutral" | "active" | "blocked" | "done";

const STUDIO_TIMESTAMP_FORMATTER = new Intl.DateTimeFormat("th-TH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Bangkok",
});

function formatStudioTimestamp(value: string) {
  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return STUDIO_TIMESTAMP_FORMATTER.format(parsedDate);
}

export type StudioToken = {
  id: string;
  conversationId: string;
  stationId: StudioStationId;
  tokenKind: StudioTokenKind;
  state: WorkflowState;
  title: string;
  subtitle: string;
  ownerRole: string;
  ownerLabel: string | null;
  priorityTone: StudioPriorityTone;
  productLabel: string;
  customerName: string;
  paymentSummary: string | null;
  designStatus: string | null;
  note: string | null;
  amountLabel: string | null;
  createdAt: string;
  lastUpdatedAt: string;
  lastUpdatedLabel: string;
  availableActions: string[];
  conversation: SnapshotConversation;
  lead: SnapshotLead | null;
  quote: SnapshotQuote | null;
  job: SnapshotJob | null;
  escalation: SnapshotEscalation | null;
};

export type StudioStation = StationDef & {
  count: number;
  blockedCount: number;
  tokens: StudioToken[];
};

export type StudioViewModel = {
  stations: StudioStation[];
  tokens: StudioToken[];
  stationMap: Record<StudioStationId, StudioStation>;
  kpis: {
    inbox: number;
    waitingApproval: number;
    active: number;
    blocked: number;
  };
};

const STATE_TO_STATION = Object.fromEntries(
  STUDIO_STATIONS.flatMap((station) =>
    station.states.map((state) => [state, station.id])
  )
) as Record<WorkflowState, StudioStationId>;

function getStationIdForState(state: WorkflowState): StudioStationId {
  return STATE_TO_STATION[state];
}

function getCanonicalState(
  conversation: SnapshotConversation,
  lead: SnapshotLead | null,
  quote: SnapshotQuote | null,
  job: SnapshotJob | null
): WorkflowState {
  if (isWorkflowState(conversation.state)) {
    return conversation.state;
  }

  if (job && isJobStatus(job.status)) {
    return job.status;
  }

  if (quote?.status === "sent") {
    return "WAITING_QUOTE_APPROVAL";
  }

  if (quote?.status === "approved") {
    return getQuoteApprovalState(quote.payment_terms, quote.payment_status);
  }

  if (lead?.design_status && lead.design_status !== "approved") {
    return "IN_DESIGN";
  }

  return "NEW_MESSAGE";
}

function buildLeadMap(snapshot: BackofficeSnapshot) {
  const map = new Map<string, SnapshotLead>();
  for (const lead of snapshot.leads) {
    if (!lead.conversation_id || map.has(lead.conversation_id)) {
      continue;
    }
    map.set(lead.conversation_id, lead);
  }
  return map;
}

function buildQuoteMap(snapshot: BackofficeSnapshot) {
  const map = new Map<string, SnapshotQuote>();
  for (const quote of snapshot.quotes) {
    const conversationId = quote.leads?.conversation_id;
    if (!conversationId || map.has(conversationId)) {
      continue;
    }
    map.set(conversationId, quote);
  }
  return map;
}

function buildJobMap(snapshot: BackofficeSnapshot) {
  const map = new Map<string, SnapshotJob>();
  for (const job of snapshot.jobs) {
    const conversationId = job.quotes?.leads?.conversation_id;
    if (!conversationId || map.has(conversationId)) {
      continue;
    }
    map.set(conversationId, job);
  }
  return map;
}

function buildEscalationMap(snapshot: BackofficeSnapshot) {
  const map = new Map<string, SnapshotEscalation>();
  for (const escalation of snapshot.escalations) {
    if (!escalation.conversation_id || map.has(escalation.conversation_id)) {
      continue;
    }
    map.set(escalation.conversation_id, escalation);
  }
  return map;
}

function getCustomerName(
  lead: SnapshotLead | null,
  quote: SnapshotQuote | null,
  conversation: SnapshotConversation
): string {
  return (
    lead?.customers?.display_name ||
    quote?.leads?.customers?.display_name ||
    `${conversation.line_user_id.slice(0, 10)}...`
  );
}

function getProductLabel(lead: SnapshotLead | null): string {
  if (!lead?.product_type) {
    return "ยังไม่ระบุสินค้า";
  }

  return (
    PRODUCT_TYPES.find((product) => product.value === lead.product_type)?.label ||
    lead.product_type
  );
}

function getTokenKind(
  state: WorkflowState,
  quote: SnapshotQuote | null,
  job: SnapshotJob | null
): StudioTokenKind {
  if (
    job &&
    [
      "IN_DESIGN",
      "IN_PRODUCTION",
      "READY_FOR_FULFILLMENT",
      "ON_HOLD_CUSTOMER_INPUT",
      "HUMAN_REVIEW_REQUIRED",
      "COMPLETED",
      "CANCELLED",
    ].includes(state)
  ) {
    return "job";
  }

  if (quote && ["WAITING_QUOTE_APPROVAL", "WAITING_PAYMENT"].includes(state)) {
    return "quote";
  }

  return "conversation";
}

function getOwnerRole(station: StationDef): string {
  return station.roleLabel;
}

function getOwnerLabel(
  state: WorkflowState,
  lead: SnapshotLead | null,
  job: SnapshotJob | null
): string | null {
  if (state === "IN_DESIGN") {
    return lead?.assigned_designer || null;
  }

  if (
    ["IN_PRODUCTION", "READY_FOR_FULFILLMENT", "COMPLETED", "CANCELLED"].includes(
      state
    )
  ) {
    return job?.assigned_to || null;
  }

  return null;
}

function getPriorityTone(
  state: WorkflowState,
  escalation: SnapshotEscalation | null
): StudioPriorityTone {
  if (["COMPLETED", "CANCELLED"].includes(state)) {
    return "done";
  }

  if (
    escalation ||
    ["WAITING_PAYMENT", "ON_HOLD_CUSTOMER_INPUT", "HUMAN_REVIEW_REQUIRED"].includes(
      state
    )
  ) {
    return "blocked";
  }

  if (["IN_DESIGN", "IN_PRODUCTION", "READY_FOR_FULFILLMENT"].includes(state)) {
    return "active";
  }

  return "neutral";
}

function getPaymentSummary(quote: SnapshotQuote | null): string | null {
  if (!quote) {
    return null;
  }

  return `${PAYMENT_TERM_LABELS[quote.payment_terms]} · ${PAYMENT_STATUS_LABELS[quote.payment_status]}`;
}

function getNote(
  state: WorkflowState,
  lead: SnapshotLead | null,
  escalation: SnapshotEscalation | null
): string | null {
  if (escalation?.reason) {
    return escalation.reason;
  }

  if (state === "ON_HOLD_CUSTOMER_INPUT") {
    return lead?.hold_reason || null;
  }

  if (state === "HUMAN_REVIEW_REQUIRED") {
    return lead?.human_review_reason || null;
  }

  return lead?.note_from_form || lead?.note_from_chat || null;
}

function getAvailableActions(
  conversation: SnapshotConversation,
  lead: SnapshotLead | null,
  quote: SnapshotQuote | null,
  job: SnapshotJob | null
): string[] {
  const actions = new Set<string>();

  if (quote) {
    actions.add("quote_commercial");
  }

  if (lead) {
    actions.add("design_status");

    if (hasLeadAiSeedPrompt(lead)) {
      actions.add("ai_preview");
    }
  }

  if (job) {
    actions.add("job_status");
  }

  if (conversation) {
    actions.add("conversation_state");
  }

  return Array.from(actions);
}

export function buildStudioView(snapshot: BackofficeSnapshot): StudioViewModel {
  const leadMap = buildLeadMap(snapshot);
  const quoteMap = buildQuoteMap(snapshot);
  const jobMap = buildJobMap(snapshot);
  const escalationMap = buildEscalationMap(snapshot);

  const tokens = snapshot.conversations.map((conversation) => {
    const lead = leadMap.get(conversation.id) || null;
    const quote = quoteMap.get(conversation.id) || null;
    const job = jobMap.get(conversation.id) || null;
    const escalation = escalationMap.get(conversation.id) || null;
    const state = getCanonicalState(conversation, lead, quote, job);
    const stationId = getStationIdForState(state);
    const station = STUDIO_STATIONS.find((item) => item.id === stationId)!;
    const customerName = getCustomerName(lead, quote, conversation);
    const productLabel = getProductLabel(lead);
    const tokenKind = getTokenKind(state, quote, job);
    const ownerLabel = getOwnerLabel(state, lead, job);
    const note = getNote(state, lead, escalation);
    const paymentSummary = getPaymentSummary(quote);

    return {
      id: conversation.id,
      conversationId: conversation.id,
      stationId,
      tokenKind,
      state,
      title: customerName,
      subtitle: WORKFLOW_STATE_LABELS[state],
      ownerRole: getOwnerRole(station),
      ownerLabel,
      priorityTone: getPriorityTone(state, escalation),
      productLabel,
      customerName,
      paymentSummary,
      designStatus: lead?.design_status || null,
      note,
      amountLabel: quote
        ? `฿${STUDIO_AMOUNT_FORMATTER.format(Number(quote.total))}`
        : null,
      createdAt: conversation.created_at,
      lastUpdatedAt: conversation.last_message_at || conversation.created_at,
      lastUpdatedLabel: formatStudioTimestamp(
        conversation.last_message_at || conversation.created_at
      ),
      availableActions: getAvailableActions(conversation, lead, quote, job),
      conversation,
      lead,
      quote,
      job,
      escalation,
    } satisfies StudioToken;
  });

  const stations = STUDIO_STATIONS.map((station) => {
    const stationTokens = tokens.filter((token) => token.stationId === station.id);
    return {
      ...station,
      count: stationTokens.length,
      blockedCount: stationTokens.filter(
        (token) => token.priorityTone === "blocked"
      ).length,
      tokens: stationTokens,
    };
  });

  const stationMap = Object.fromEntries(
    stations.map((station) => [station.id, station])
  ) as Record<StudioStationId, StudioStation>;

  return {
    stations,
    tokens,
    stationMap,
    kpis: {
      inbox:
        stationMap.inbox.count +
        stationMap.quote.count +
        stationMap.cashier.count,
      waitingApproval: stationMap.quote.count,
      active:
        stationMap.design.count +
        stationMap.production.count +
        stationMap.packing.count,
      blocked:
        stationMap.cashier.count +
        stationMap.hold.count +
        stationMap.review.count,
    },
  };
}

export function getStudioTokenMeta(token: StudioToken) {
  const designStatusLabel = token.designStatus
    ? DESIGN_STATUS_LABELS[token.designStatus as keyof typeof DESIGN_STATUS_LABELS] ||
      token.designStatus
    : null;
  const jobStatusLabel = token.job?.status
    ? JOB_STATUS_LABELS[token.job.status as keyof typeof JOB_STATUS_LABELS] ||
      token.job.status
    : null;

  return {
    stateLabel: WORKFLOW_STATE_LABELS[token.state],
    designStatusLabel,
    jobStatusLabel,
    paymentSummary: token.paymentSummary,
  };
}
