const PRE_JOB_QUOTE_STATUSES = new Set(["draft", "sent", "approved"]);
const RESTART_REPLACEABLE_CONVERSATION_STATES = [
  "NEW_MESSAGE",
  "COLLECTING_REQUIREMENTS",
  "REQUIREMENTS_REVIEW",
  "WAITING_QUOTE_APPROVAL",
  "WAITING_PAYMENT",
  "ON_HOLD_CUSTOMER_INPUT",
  "HUMAN_REVIEW_REQUIRED",
] as const;

type RestartReplaceableConversationState =
  (typeof RESTART_REPLACEABLE_CONVERSATION_STATES)[number];

export type FreshRestartConversationCandidate = {
  id: string;
  state: string | null | undefined;
};

export type FreshRestartLeadCandidate = {
  id: string;
  conversation_id: string | null;
  status: string;
  superseded_at?: string | null;
  quotes?:
    | Array<{
        id: string;
        status: string;
        jobs?: Array<{ id: string; status: string }> | null;
      }>
    | null;
};

export type FreshRestartConversationReplacement = {
  id: string;
  fromState: RestartReplaceableConversationState;
};

export function getConversationsToCancelForFreshRestart(
  conversations: FreshRestartConversationCandidate[],
  replacementConversationId: string
): FreshRestartConversationReplacement[] {
  return conversations.flatMap((conversation) => {
    if (!conversation.id || conversation.id === replacementConversationId) {
      return [];
    }

    const currentState = RESTART_REPLACEABLE_CONVERSATION_STATES.find(
      (state) => state === conversation.state
    );
    if (!currentState) {
      return [];
    }

    return [
      {
        id: conversation.id,
        fromState: currentState,
      },
    ];
  });
}

export function isLeadSupersedableForFreshRestart(
  lead: FreshRestartLeadCandidate
): boolean {
  if (lead.superseded_at) {
    return false;
  }

  if (lead.status === "superseded" || lead.status === "cancelled") {
    return false;
  }

  const quotes = lead.quotes || [];
  if (quotes.some((quote) => (quote.jobs || []).length > 0)) {
    return false;
  }

  if (quotes.length === 0) {
    return true;
  }

  return quotes.some((quote) => PRE_JOB_QUOTE_STATUSES.has(quote.status));
}

export function getLeadsToSupersedeForFreshRestart(
  leads: FreshRestartLeadCandidate[],
  replacementLeadId: string
): FreshRestartLeadCandidate[] {
  return leads.filter(
    (lead) => lead.id !== replacementLeadId && isLeadSupersedableForFreshRestart(lead)
  );
}
