import { getCommercialGateQuotes } from "./backoffice-commercial-gate";
import {
  getAdminQueueContract,
  type AdminQueueRowFilterKey,
} from "./admin-queue-contract";

import type {
  BackofficeSnapshot,
  SnapshotConversation,
  SnapshotEscalation,
  SnapshotJob,
  SnapshotLead,
  SnapshotProductionEvent,
  SnapshotQuote,
} from "./backoffice-snapshot";

export type AutomationLaneKey = AdminQueueRowFilterKey;

export type AutomationLaneSeverity = "healthy" | "info" | "warning" | "critical";

export type BackofficeAutomationLane = {
  key: AutomationLaneKey;
  label: string;
  description: string;
  count: number;
  severity: AutomationLaneSeverity;
};

export type BackofficeAutomationSnapshot = {
  summary: {
    activeManagedCount: number;
    autoFlowingCount: number;
    needsHumanNowCount: number;
    waitingOnCustomerCount: number;
    incidentsOpenCount: number;
    commercialGateCount: number;
  };
  lanes: BackofficeAutomationLane[];
  queues: {
    stalledQuotes: SnapshotQuote[];
    pendingProductionReview: SnapshotProductionEvent[];
    escalations: SnapshotEscalation[];
    blockedConversations: SnapshotConversation[];
    waitingPaymentConversations: SnapshotConversation[];
    commercialGateQuotes: SnapshotQuote[];
    manualReviewConversations: SnapshotConversation[];
    customerWaitingConversations: SnapshotConversation[];
    customerWaitingLeads: SnapshotLead[];
  };
  audit: {
    recentConversations: SnapshotConversation[];
    supersededLeads: SnapshotLead[];
    recentCompletedJobs: SnapshotJob[];
  };
};

const NEW_LEAD_STATES = new Set([
  "NEW_MESSAGE",
  "COLLECTING_REQUIREMENTS",
  "REQUIREMENTS_REVIEW",
]);

const DESIGN_OPS_BLOCKING_STATES = new Set([
  ...NEW_LEAD_STATES,
  "WAITING_QUOTE_APPROVAL",
  "WAITING_PAYMENT",
  "ON_HOLD_CUSTOMER_INPUT",
  "IN_PRODUCTION",
  "READY_FOR_FULFILLMENT",
  "COMPLETED",
  "CANCELLED",
]);

const AUTOMATION_LANE_ORDER: AutomationLaneKey[] = [
  "new-leads",
  "quote-decision",
  "payment-ops",
  "customer-waiting",
  "commercial-gate",
  "design-ops",
  "production-ops",
  "exceptions",
];

function getLaneSeverity(
  count: number,
  criticalThreshold = 1,
  warningThreshold = 1
): AutomationLaneSeverity {
  if (count >= criticalThreshold) {
    return "critical";
  }

  if (count >= warningThreshold) {
    return "warning";
  }

  return "healthy";
}

export function buildBackofficeAutomationSnapshot(
  snapshot: BackofficeSnapshot
): BackofficeAutomationSnapshot {
  const activeLeads = snapshot.leads.filter((lead) => !lead.superseded_at);
  const newLeadConversations = snapshot.conversations.filter((conversation) =>
    NEW_LEAD_STATES.has(conversation.state)
  );
  const commercialGateQuoteIds = new Set(
    getCommercialGateQuotes(snapshot).map((quote) => quote.id)
  );
  const designOpsLeads = activeLeads.filter((lead) => {
    if (!lead.conversation_id) {
      return false;
    }

    const conversationState = snapshot.conversations.find(
      (conversation) => conversation.id === lead.conversation_id
    )?.state;

    if (!conversationState || DESIGN_OPS_BLOCKING_STATES.has(conversationState)) {
      return false;
    }

    const designStatus = lead.design_status || "not_started";
    return ["not_started", "drafting", "revision_requested"].includes(designStatus);
  });
  const customerWaitingLeads = activeLeads.filter((lead) => {
    const designStatus = lead.design_status || "not_started";
    return designStatus === "preview_sent" || Boolean(lead.hold_reason);
  });

  const stalledQuotes = snapshot.quotes.filter((quote) => {
    const hasJob = Array.isArray(quote.jobs) && quote.jobs.length > 0;
    return quote.status === "sent" || (quote.status === "approved" && !hasJob);
  });
  const commercialGateQuotes = snapshot.quotes.filter((quote) =>
    commercialGateQuoteIds.has(quote.id)
  );

  const pendingProductionReview = snapshot.productionReviewQueue.filter(
    (event) => event.review_status === "pending"
  );
  const waitingPaymentConversations = snapshot.conversations.filter(
    (conversation) => conversation.state === "WAITING_PAYMENT"
  );
  const manualReviewConversations = snapshot.conversations.filter(
    (conversation) => conversation.state === "HUMAN_REVIEW_REQUIRED"
  );
  const customerWaitingConversations = snapshot.conversations.filter(
    (conversation) => conversation.state === "ON_HOLD_CUSTOMER_INPUT"
  );
  const blockedConversations = snapshot.conversations.filter((conversation) =>
    ["WAITING_PAYMENT", "HUMAN_REVIEW_REQUIRED"].includes(conversation.state)
  );

  const activeJobs = snapshot.jobs.filter((job) =>
    ["IN_DESIGN", "IN_PRODUCTION", "READY_FOR_FULFILLMENT"].includes(job.status)
  );

  const needsHumanNowCount =
    snapshot.escalations.length +
    manualReviewConversations.length +
    waitingPaymentConversations.length +
    pendingProductionReview.length +
    commercialGateQuotes.length;

  const waitingOnCustomerCount =
    customerWaitingConversations.length + customerWaitingLeads.length;

  const activeManagedCount =
    activeLeads.length + snapshot.quotes.length + activeJobs.length;

  const autoFlowingCount = Math.max(
    activeManagedCount - needsHumanNowCount - waitingOnCustomerCount,
    0
  );

  const incidentsOpenCount =
    snapshot.escalations.length +
    blockedConversations.length +
    pendingProductionReview.length +
    commercialGateQuotes.length;

  const laneCounts: Record<AutomationLaneKey, number> = {
    "new-leads": newLeadConversations.length,
    "quote-decision": stalledQuotes.filter((quote) => !commercialGateQuoteIds.has(quote.id)).length,
    "payment-ops": waitingPaymentConversations.length + manualReviewConversations.length,
    "customer-waiting": customerWaitingConversations.length + customerWaitingLeads.length,
    "commercial-gate": commercialGateQuotes.length,
    "design-ops": designOpsLeads.length + pendingProductionReview.length,
    "production-ops": activeJobs.length,
    exceptions: snapshot.escalations.length,
  };

  const lanes: BackofficeAutomationLane[] = AUTOMATION_LANE_ORDER.map((key) => {
    const contract = getAdminQueueContract(key);
    const count = laneCounts[key];
    const severity =
      key === "production-ops" || key === "design-ops"
        ? getLaneSeverity(count, 3, 1)
        : getLaneSeverity(count);

    return {
      key,
      label: contract.label,
      description: contract.description,
      count,
      severity,
    };
  });

  return {
    summary: {
      activeManagedCount,
      autoFlowingCount,
      needsHumanNowCount,
      waitingOnCustomerCount,
      incidentsOpenCount,
      commercialGateCount: commercialGateQuotes.length,
    },
    lanes,
    queues: {
      stalledQuotes,
      pendingProductionReview,
      escalations: snapshot.escalations,
      blockedConversations,
      waitingPaymentConversations,
      commercialGateQuotes,
      manualReviewConversations,
      customerWaitingConversations,
      customerWaitingLeads,
    },
    audit: {
      recentConversations: snapshot.recentConversations.slice(0, 8),
      supersededLeads: snapshot.leads.filter((lead) => Boolean(lead.superseded_at)).slice(0, 6),
      recentCompletedJobs: snapshot.jobs
        .filter((job) => job.status === "COMPLETED" || Boolean(job.completed_at))
        .slice(0, 6),
    },
  };
}