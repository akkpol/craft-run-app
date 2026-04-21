import type { JobStatus } from "./types";
import { normalizeWorkflowState, type WorkflowState } from "./workflow-state";

export const ALLOWED_JOB_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  IN_DESIGN: [
    "ON_HOLD_CUSTOMER_INPUT",
    "HUMAN_REVIEW_REQUIRED",
    "IN_PRODUCTION",
    "CANCELLED",
  ],
  ON_HOLD_CUSTOMER_INPUT: ["IN_DESIGN", "CANCELLED"],
  HUMAN_REVIEW_REQUIRED: ["IN_DESIGN", "CANCELLED"],
  IN_PRODUCTION: ["READY_FOR_FULFILLMENT", "CANCELLED"],
  READY_FOR_FULFILLMENT: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export const ALLOWED_CONVERSATION_TRANSITIONS: Record<
  WorkflowState,
  WorkflowState[]
> = {
  NEW_MESSAGE: ["COLLECTING_REQUIREMENTS", "REQUIREMENTS_REVIEW"],
  COLLECTING_REQUIREMENTS: [
    "REQUIREMENTS_REVIEW",
    "ON_HOLD_CUSTOMER_INPUT",
    "HUMAN_REVIEW_REQUIRED",
    "CANCELLED",
  ],
  REQUIREMENTS_REVIEW: [
    "WAITING_QUOTE_APPROVAL",
    "ON_HOLD_CUSTOMER_INPUT",
    "HUMAN_REVIEW_REQUIRED",
    "CANCELLED",
  ],
  WAITING_QUOTE_APPROVAL: [
    "REQUIREMENTS_REVIEW",
    "WAITING_PAYMENT",
    "IN_DESIGN",
    "HUMAN_REVIEW_REQUIRED",
    "CANCELLED",
  ],
  WAITING_PAYMENT: [
    "REQUIREMENTS_REVIEW",
    "IN_DESIGN",
    "HUMAN_REVIEW_REQUIRED",
    "CANCELLED",
  ],
  IN_DESIGN: [
    "ON_HOLD_CUSTOMER_INPUT",
    "HUMAN_REVIEW_REQUIRED",
    "IN_PRODUCTION",
    "CANCELLED",
  ],
  IN_PRODUCTION: [
    "READY_FOR_FULFILLMENT",
    "ON_HOLD_CUSTOMER_INPUT",
    "HUMAN_REVIEW_REQUIRED",
    "CANCELLED",
  ],
  READY_FOR_FULFILLMENT: ["COMPLETED", "HUMAN_REVIEW_REQUIRED", "CANCELLED"],
  ON_HOLD_CUSTOMER_INPUT: [
    "COLLECTING_REQUIREMENTS",
    "REQUIREMENTS_REVIEW",
    "IN_DESIGN",
    "HUMAN_REVIEW_REQUIRED",
    "CANCELLED",
  ],
  HUMAN_REVIEW_REQUIRED: [
    "COLLECTING_REQUIREMENTS",
    "REQUIREMENTS_REVIEW",
    "WAITING_QUOTE_APPROVAL",
    "WAITING_PAYMENT",
    "IN_DESIGN",
    "IN_PRODUCTION",
    "READY_FOR_FULFILLMENT",
    "CANCELLED",
  ],
  COMPLETED: [],
  CANCELLED: [],
};

export function getReusableConversationState(
  currentStateValue: string | null | undefined,
  nextState: WorkflowState
): WorkflowState | null {
  const currentState = normalizeWorkflowState(currentStateValue);

  if (!currentState) {
    return null;
  }

  return currentState === nextState ||
    canTransitionConversationState(currentState, nextState)
    ? currentState
    : null;
}

export function getAllowedConversationTransitions(
  currentState: WorkflowState
): WorkflowState[] {
  return ALLOWED_CONVERSATION_TRANSITIONS[currentState] ?? [];
}

export function canTransitionConversationState(
  currentState: WorkflowState,
  nextState: WorkflowState
): boolean {
  return getAllowedConversationTransitions(currentState).includes(nextState);
}

export function isTerminalConversationState(state: WorkflowState): boolean {
  return state === "COMPLETED" || state === "CANCELLED";
}
