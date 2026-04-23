import type { WorkflowState } from "@/lib/types";

export type ReturningCustomerReplyType =
  | "intake_link"
  | "resume_or_fresh"
  | "quote_approval_context"
  | "payment_context"
  | "production_status"
  | "terminal_fresh_intake";

const RESUME_OR_FRESH_STATES: WorkflowState[] = [
  "COLLECTING_REQUIREMENTS",
  "REQUIREMENTS_REVIEW",
  "ON_HOLD_CUSTOMER_INPUT",
];

const MID_PRODUCTION_STATES: WorkflowState[] = [
  "IN_DESIGN",
  "IN_PRODUCTION",
  "READY_FOR_FULFILLMENT",
];

export function getReturningCustomerReplyType(params: {
  conversationState: WorkflowState;
  isReusedConversation: boolean;
  previousConvWasTerminal: boolean;
}): ReturningCustomerReplyType {
  const { conversationState, isReusedConversation, previousConvWasTerminal } =
    params;

  if (MID_PRODUCTION_STATES.includes(conversationState)) {
    return "production_status";
  }

  if (conversationState === "WAITING_QUOTE_APPROVAL") {
    return "quote_approval_context";
  }

  if (conversationState === "WAITING_PAYMENT") {
    return "payment_context";
  }

  if (
    isReusedConversation &&
    RESUME_OR_FRESH_STATES.includes(conversationState)
  ) {
    return "resume_or_fresh";
  }

  if (previousConvWasTerminal) {
    return "terminal_fresh_intake";
  }

  return "intake_link";
}
