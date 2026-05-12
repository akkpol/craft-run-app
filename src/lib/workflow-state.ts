export const WORKFLOW_STATES = [
  "NEW_MESSAGE",
  "COLLECTING_REQUIREMENTS",
  "REQUIREMENTS_REVIEW",
  "QUOTE_PENDING_APPROVAL",
  "PAYMENT_PENDING",
  "IN_DESIGN",
  "IN_PRODUCTION",
  "READY_FOR_FULFILLMENT",
  "ON_HOLD",
  "HUMAN_REVIEW_REQUIRED",
  "COMPLETED",
  "CANCELLED",
] as const;

export type WorkflowState = (typeof WORKFLOW_STATES)[number];

const LEGACY_WORKFLOW_STATE_MAP: Record<string, WorkflowState> = {
  COLLECTING_INFO: "COLLECTING_REQUIREMENTS",
  FORM_SUBMITTED: "REQUIREMENTS_REVIEW",
  QUOTE_DRAFTED: "QUOTE_PENDING_APPROVAL",
  WAITING_CUSTOMER_APPROVAL: "QUOTE_PENDING_APPROVAL",
  WAITING_QUOTE_APPROVAL: "QUOTE_PENDING_APPROVAL",
  WAITING_PAYMENT: "PAYMENT_PENDING",
  JOB_CREATED: "IN_DESIGN",
  IN_PROGRESS: "IN_PRODUCTION",
  ON_HOLD_CUSTOMER_INPUT: "ON_HOLD",
};

export function isWorkflowState(value: string): value is WorkflowState {
  return WORKFLOW_STATES.includes(value as WorkflowState);
}

export function normalizeWorkflowState(
  value: string | null | undefined
): WorkflowState | null {
  if (!value) {
    return null;
  }

  if (isWorkflowState(value)) {
    return value;
  }

  return LEGACY_WORKFLOW_STATE_MAP[value] ?? null;
}