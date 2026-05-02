import test from "node:test";
import assert from "node:assert/strict";

import {
  getAllowedActions,
  getUiContract,
  validateTransition,
} from "../src/lib/workflow-policy-core.mjs";

test("admin dashboard blocks move_to_production while commercial gate is pending", () => {
  const result = getAllowedActions({
    actor: "admin",
    surface: "admin_dashboard",
    workflow_bundle: {
      payment_terms: "prepaid",
      payment_status: "paid",
      required_document_type: "tax_invoice",
      required_document_issued: false,
    },
  });

  assert.ok(!result.allowed_actions.includes("move_to_production"));
  assert.ok(result.allowed_actions.includes("issue_commercial_document"));
  assert.equal(result.ui_intent, "Payment is complete, but the commercial document gate is still pending before the next operational step.");
});

test("quote page switches to commercial gate intent after payment is complete", () => {
  const result = getAllowedActions({
    actor: "customer",
    surface: "quote_page",
    workflow_bundle: {
      quote_status: "approved",
      payment_terms: "prepaid",
      payment_status: "paid",
      required_document_type: "receipt",
      required_document_issued: false,
    },
  });

  assert.ok(!result.allowed_actions.includes("approve_quote"));
  assert.deepEqual(result.recommended_ctas, ["contact_admin"]);
});

test("job transition blocks production until commercial document gate is clear", () => {
  const result = validateTransition({
    entity: "job",
    action: "move_to_production",
    from_state: {
      job_status: "IN_DESIGN",
      design_status: "approved",
      payment_terms: "prepaid",
      payment_status: "paid",
      required_document_type: "tax_invoice",
      required_document_issued: false,
    },
  });

  assert.equal(result.decision, "blocked");
  assert.match(result.reason, /commercial document gate/i);
});

test("job transition allows production once commercial document gate is clear", () => {
  const result = validateTransition({
    entity: "job",
    action: "move_to_production",
    from_state: {
      job_status: "IN_DESIGN",
      design_status: "approved",
      payment_terms: "prepaid",
      payment_status: "paid",
      required_document_type: "tax_invoice",
      required_document_issued: true,
    },
  });

  assert.equal(result.decision, "allowed");
  assert.equal(result.next_state?.job_status, "IN_PRODUCTION");
});

test("ui contract exposes a commercial gate section for admin when documents are pending", () => {
  const result = getUiContract({
    actor: "admin",
    surface: "admin_dashboard",
    workflow_bundle: {
      payment_terms: "prepaid",
      payment_status: "paid",
      required_document_type: "receipt",
      required_document_issued: false,
    },
  });

  assert.ok(result.show_sections.includes("commercial_gate_queue"));
  assert.ok(result.show_ctas.includes("issue_commercial_document"));
});