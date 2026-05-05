import test from "node:test";
import assert from "node:assert/strict";

import {
  getWorkflowOwnerContract,
  getWorkflowOwnerContracts,
  getWorkflowStatesByAutomationMode,
  isHumanGateWorkflowState,
  isTerminalWorkflowOwnerState,
  WORKFLOW_OWNER_MAP,
} from "../src/lib/workflow-owner-map.ts";
import { ADMIN_QUEUE_FILTER_KEYS } from "../src/lib/admin-queue-contract.ts";
import { WORKFLOW_STATES, type WorkflowState } from "../src/lib/workflow-state.ts";

test("workflow owner map covers every canonical workflow state exactly once", () => {
  assert.deepEqual(
    Object.keys(WORKFLOW_OWNER_MAP).sort(),
    [...WORKFLOW_STATES].sort()
  );

  for (const state of WORKFLOW_STATES) {
    const contract = getWorkflowOwnerContract(state);
    assert.equal(contract.state, state);
    assert.ok(contract.ownerKey);
    assert.ok(contract.ownerLabel);
    assert.ok(contract.summary);
    assert.ok(contract.primarySurface.href);
    assert.ok(contract.primarySurface.label);
  }
});

test("workflow owner map uses valid admin queue filters", () => {
  const validQueueKeys = new Set<string>(ADMIN_QUEUE_FILTER_KEYS);

  for (const contract of getWorkflowOwnerContracts()) {
    if (!contract.primaryQueue) {
      continue;
    }

    assert.equal(
      validQueueKeys.has(contract.primaryQueue),
      true,
      `${contract.state} references an unknown queue key`
    );
  }
});

test("customer-waiting states put the next action with the customer", () => {
  const customerWaitingStates = getWorkflowStatesByAutomationMode("customer_waiting");

  assert.deepEqual(customerWaitingStates.sort(), [
    "COLLECTING_REQUIREMENTS",
    "ON_HOLD_CUSTOMER_INPUT",
    "WAITING_QUOTE_APPROVAL",
  ].sort());

  for (const state of customerWaitingStates) {
    const contract = getWorkflowOwnerContract(state);
    assert.equal(contract.nextActionOwner, "customer");
    assert.ok(contract.customerActions.length > 0);
  }
});

test("human-gate states declare stop reasons and internal ownership", () => {
  const humanGateStates = getWorkflowStatesByAutomationMode("human_gate");

  assert.deepEqual(humanGateStates.sort(), [
    "HUMAN_REVIEW_REQUIRED",
    "IN_DESIGN",
    "IN_PRODUCTION",
    "READY_FOR_FULFILLMENT",
    "WAITING_PAYMENT",
  ].sort());

  for (const state of humanGateStates) {
    const contract = getWorkflowOwnerContract(state);
    assert.equal(isHumanGateWorkflowState(state), true);
    assert.equal(contract.nextActionOwner, "internal");
    assert.ok(contract.internalActions.length > 0);
    assert.ok(contract.humanGateReasons.length > 0);
  }
});

test("terminal states stay closed and out of active queues", () => {
  const terminalStates = getWorkflowStatesByAutomationMode("terminal");

  assert.deepEqual(terminalStates.sort(), ["CANCELLED", "COMPLETED"].sort());

  for (const state of terminalStates) {
    const contract = getWorkflowOwnerContract(state);
    assert.equal(isTerminalWorkflowOwnerState(state), true);
    assert.equal(contract.nextActionOwner, "none");
    assert.equal(contract.primaryQueue, null);
  }
});

test("critical ownership decisions match the auto-run operating model", () => {
  const expected: Partial<Record<WorkflowState, [string, string]>> = {
    NEW_MESSAGE: ["system", "auto_run"],
    REQUIREMENTS_REVIEW: ["crm", "auto_run"],
    WAITING_PAYMENT: ["finance", "human_gate"],
    IN_DESIGN: ["design", "human_gate"],
    HUMAN_REVIEW_REQUIRED: ["owner", "human_gate"],
  };

  for (const [state, [ownerKey, automationMode]] of Object.entries(expected)) {
    const contract = getWorkflowOwnerContract(state as WorkflowState);
    assert.equal(contract.ownerKey, ownerKey);
    assert.equal(contract.automationMode, automationMode);
  }
});
