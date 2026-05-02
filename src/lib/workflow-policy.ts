import "server-only";

import {
  getAllowedActions as getAllowedActionsImpl,
  getUiContract as getUiContractImpl,
  getWorkflowPolicy as getWorkflowPolicyImpl,
  getWorkflowSummary as getWorkflowSummaryImpl,
  validateTransition as validateTransitionImpl,
} from "./workflow-policy-core.mjs";

export type WorkflowBundle = {
  conversation_state?: string;
  quote_status?: string;
  payment_terms?: string;
  payment_status?: string;
  design_status?: string;
  job_status?: string;
  has_job?: boolean;
  hold_reason?: string | null;
  required_document_type?: string | null;
  required_document_issued?: boolean;
  commercial_review_required?: boolean;
  commercial_gate_status?: string | null;
  payment_receiver_locked?: boolean;
};

export type AllowedActionResult = {
  allowed_actions: string[];
  blocked_actions: Array<{ action: string; reason: string }>;
  recommended_ctas: string[];
  ui_intent: string;
};

export type TransitionValidationResult = {
  decision: "allowed" | "blocked" | "requires_decision";
  reason: string;
  next_state: Record<string, string | null> | null;
  side_effects: string[];
  missing_requirements: string[];
};

export type UiContractResult = {
  show_sections: string[];
  show_ctas: string[];
  hide_ctas: string[];
  copy_guidance: {
    headline?: string;
    tone?: string;
  };
  notes: string[];
};

export type WorkflowSummary = {
  mode: string;
  canonical_sources: string[];
  main_path: string[];
  branches: string[];
  payment_rules: Record<string, string>;
  notes: string[];
};

export const getWorkflowPolicy =
  getWorkflowPolicyImpl as () => Record<string, unknown>;

export const getWorkflowSummary =
  getWorkflowSummaryImpl as () => WorkflowSummary;

export const getAllowedActions = getAllowedActionsImpl as (input: {
  actor: string;
  surface: string;
  workflow_bundle?: WorkflowBundle;
}) => AllowedActionResult;

export const validateTransition = validateTransitionImpl as (input: {
  actor?: string;
  entity: string;
  action: string;
  from_state?: WorkflowBundle;
  context?: Record<string, string | boolean | null | undefined>;
}) => TransitionValidationResult;

export const getUiContract = getUiContractImpl as (input: {
  actor: string;
  surface: string;
  workflow_bundle?: WorkflowBundle;
}) => UiContractResult;
