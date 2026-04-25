import type { BackofficeSnapshot, SnapshotLead } from "./backoffice-snapshot";
import type { WorkflowState } from "./workflow-state";

const DESIGN_QUEUE_BLOCKING_STATES = new Set<WorkflowState>([
  // Payment/quote/customer-hold states should not render as active team-owned design work.
  "WAITING_QUOTE_APPROVAL",
  "WAITING_PAYMENT",
  "ON_HOLD_CUSTOMER_INPUT",
  "COMPLETED",
  "CANCELLED",
]);

function getLeadConversationState(
  snapshot: BackofficeSnapshot,
  lead: SnapshotLead
): WorkflowState | null {
  if (!lead.conversation_id) {
    return null;
  }

  return (
    snapshot.conversations.find(
      (conversation) => conversation.id === lead.conversation_id
    )?.state || null
  );
}

export function getDesignQueueLeads(snapshot: BackofficeSnapshot) {
  return snapshot.leads.filter((lead) => {
    if (lead.superseded_at) {
      return false;
    }

    const conversationState = getLeadConversationState(snapshot, lead);
    if (conversationState && DESIGN_QUEUE_BLOCKING_STATES.has(conversationState)) {
      return false;
    }

    const designStatus = lead.design_status || "not_started";
    return (
      lead.status === "new" ||
      ["not_started", "drafting", "revision_requested"].includes(designStatus)
    );
  });
}
