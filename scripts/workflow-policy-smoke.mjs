import assert from "node:assert/strict";
import process from "node:process";

import {
  getAllowedActions,
  getUiContract,
  getWorkflowSummary,
  validateTransition,
} from "../src/lib/workflow-policy-core.mjs";

const summary = getWorkflowSummary();

assert.equal(summary.mode, "current_runtime");
assert.ok(summary.main_path.includes("WAITING_PAYMENT|IN_DESIGN"));
assert.ok(summary.branches.includes("CANCELLED"));
assert.equal(summary.payment_rules.credit, "unlock_immediately");

const waitingPaymentActions = getAllowedActions({
  actor: "customer",
  surface: "quote_page",
  workflow_bundle: {
    conversation_state: "WAITING_PAYMENT",
    quote_status: "approved",
    payment_terms: "prepaid",
    payment_status: "unpaid",
  },
});

assert.ok(!waitingPaymentActions.allowed_actions.includes("approve_quote"));
assert.ok(
  waitingPaymentActions.blocked_actions.some(
    (item) => item.action === "approve_quote"
  )
);
assert.ok(
  waitingPaymentActions.recommended_ctas.includes("view_payment_instruction")
);

const previewSentActions = getAllowedActions({
  actor: "customer",
  surface: "status_page",
  workflow_bundle: {
    conversation_state: "ON_HOLD_CUSTOMER_INPUT",
    design_status: "preview_sent",
    job_status: "ON_HOLD_CUSTOMER_INPUT",
    hold_reason: "waiting for preview feedback",
  },
});

assert.ok(previewSentActions.allowed_actions.includes("approve_design"));
assert.ok(
  previewSentActions.allowed_actions.includes("request_design_revision")
);

const revisionRequestedActions = getAllowedActions({
  actor: "customer",
  surface: "status_page",
  workflow_bundle: {
    conversation_state: "ON_HOLD_CUSTOMER_INPUT",
    design_status: "revision_requested",
    job_status: "ON_HOLD_CUSTOMER_INPUT",
    hold_reason: "customer requested revisions",
  },
});

assert.ok(!revisionRequestedActions.allowed_actions.includes("approve_design"));

const blockedRevisionApprove = validateTransition({
  actor: "customer",
  entity: "design_feedback",
  action: "approve_design",
  from_state: {
    conversation_state: "ON_HOLD_CUSTOMER_INPUT",
    design_status: "revision_requested",
    job_status: "ON_HOLD_CUSTOMER_INPUT",
  },
});

assert.equal(blockedRevisionApprove.decision, "blocked");

const prepaidApproval = validateTransition({
  actor: "customer",
  entity: "payment_gate",
  action: "approve_quote",
  from_state: {
    conversation_state: "WAITING_QUOTE_APPROVAL",
    quote_status: "sent",
    payment_terms: "prepaid",
    payment_status: "unpaid",
  },
});

assert.equal(prepaidApproval.decision, "allowed");
assert.equal(prepaidApproval.next_state?.conversation_state, "WAITING_PAYMENT");

const creditApproval = validateTransition({
  actor: "customer",
  entity: "payment_gate",
  action: "approve_quote",
  from_state: {
    conversation_state: "WAITING_QUOTE_APPROVAL",
    quote_status: "sent",
    payment_terms: "credit",
    payment_status: "unpaid",
  },
});

assert.equal(creditApproval.decision, "allowed");
assert.equal(creditApproval.next_state?.conversation_state, "IN_DESIGN");
assert.equal(creditApproval.next_state?.payment_status, "not_required");

const terminalConversation = validateTransition({
  actor: "system",
  entity: "conversation",
  action: "reuse_for_new_intake",
  from_state: {
    conversation_state: "COMPLETED",
  },
  context: {
    target_state: "REQUIREMENTS_REVIEW",
  },
});

assert.equal(terminalConversation.decision, "blocked");

const waitingPaymentUi = getUiContract({
  actor: "customer",
  surface: "quote_page",
  workflow_bundle: {
    conversation_state: "WAITING_PAYMENT",
    quote_status: "approved",
    payment_terms: "prepaid",
    payment_status: "unpaid",
  },
});

assert.ok(waitingPaymentUi.show_sections.includes("waiting_payment_panel"));
assert.ok(!waitingPaymentUi.show_ctas.includes("approve_quote"));

const previewUi = getUiContract({
  actor: "customer",
  surface: "status_page",
  workflow_bundle: {
    conversation_state: "ON_HOLD_CUSTOMER_INPUT",
    design_status: "preview_sent",
    job_status: "ON_HOLD_CUSTOMER_INPUT",
    hold_reason: "waiting for preview feedback",
  },
});

assert.ok(previewUi.show_sections.includes("design_preview_gallery"));
assert.ok(previewUi.show_ctas.includes("approve_design"));
assert.ok(previewUi.show_ctas.includes("request_design_revision"));

process.stdout.write("workflow-policy smoke checks passed\n");
