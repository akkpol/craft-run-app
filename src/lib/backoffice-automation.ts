import { getDesignQueueLeads } from "@/lib/admin-dashboard-queues";
import { getCommercialGateQuotes } from "@/lib/backoffice-commercial-gate";

import type {
  BackofficeSnapshot,
  SnapshotConversation,
  SnapshotEscalation,
  SnapshotJob,
  SnapshotLead,
  SnapshotProductionEvent,
  SnapshotQuote,
} from "./backoffice-snapshot";

export type AutomationLaneKey = "sales" | "design" | "production" | "inbox";

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
  const designQueueLeads = getDesignQueueLeads(snapshot);
  const customerWaitingLeads = activeLeads.filter((lead) => {
    const designStatus = lead.design_status || "not_started";
    return designStatus === "preview_sent" || Boolean(lead.hold_reason);
  });

  const stalledQuotes = snapshot.quotes.filter((quote) => {
    const hasJob = Array.isArray(quote.jobs) && quote.jobs.length > 0;
    return quote.status === "sent" || (quote.status === "approved" && !hasJob);
  });
  const commercialGateQuotes = getCommercialGateQuotes(snapshot);

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

  const lanes: BackofficeAutomationLane[] = [
    {
      key: "sales",
      label: "Sales",
      description: "quote ที่ระบบยังปิดให้ไม่ได้หรือยังติด payment gate",
      count: stalledQuotes.length + waitingPaymentConversations.length,
      severity: getLaneSeverity(stalledQuotes.length + waitingPaymentConversations.length),
    },
    {
      key: "design",
      label: "Design",
      description: "งานแบบที่ยังมี owner ฝั่งคนหรือยังต้องตาม feedback",
      count: designQueueLeads.length + customerWaitingLeads.length,
      severity: getLaneSeverity(designQueueLeads.length + customerWaitingLeads.length, 3, 1),
    },
    {
      key: "production",
      label: "Production",
      description: "หลักฐานจากหน้างานที่ยังต้องมีคน review หรือ override",
      count: pendingProductionReview.length,
      severity: getLaneSeverity(pendingProductionReview.length),
    },
    {
      key: "inbox",
      label: "Inbox",
      description: "เคสที่ระบบโยนกลับมาให้คนเพราะติด manual review หรือ escalation",
      count:
        snapshot.escalations.length +
        manualReviewConversations.length +
        customerWaitingConversations.length,
      severity: getLaneSeverity(
        snapshot.escalations.length + manualReviewConversations.length,
        1,
        1
      ),
    },
  ];

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