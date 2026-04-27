import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

import { normalizeWorkflowState } from "../src/lib/workflow-state.ts";

const workflowTransitionsUrl = new URL(
  "../src/lib/workflow-transitions.ts",
  import.meta.url
);
const workflowStateUrl = new URL("../src/lib/workflow-state.ts", import.meta.url);
const workflowTransitionsSource = await readFile(workflowTransitionsUrl, "utf8");
const patchedWorkflowTransitionsSource = workflowTransitionsSource.replace(
  /from "\.\/workflow-state";/,
  `from ${JSON.stringify(workflowStateUrl.href)};`
);
const transpiledWorkflowTransitions = ts.transpileModule(
  patchedWorkflowTransitionsSource,
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }
);
const { getReusableConversationState }: typeof import("../src/lib/workflow-transitions") =
  await import(
    `data:text/javascript,${encodeURIComponent(transpiledWorkflowTransitions.outputText)}`
  );

test("normalizeWorkflowState maps legacy conversation states to canonical states", () => {
  assert.equal(normalizeWorkflowState("COLLECTING_INFO"), "COLLECTING_REQUIREMENTS");
  assert.equal(normalizeWorkflowState("FORM_SUBMITTED"), "REQUIREMENTS_REVIEW");
  assert.equal(
    normalizeWorkflowState("WAITING_CUSTOMER_APPROVAL"),
    "WAITING_QUOTE_APPROVAL"
  );
  assert.equal(normalizeWorkflowState("JOB_CREATED"), "IN_DESIGN");
  assert.equal(normalizeWorkflowState("IN_PROGRESS"), "IN_PRODUCTION");
});

test("getReusableConversationState keeps reusable conversations in the same order flow", () => {
  assert.equal(
    getReusableConversationState("FORM_SUBMITTED", "REQUIREMENTS_REVIEW"),
    "REQUIREMENTS_REVIEW"
  );
  assert.equal(
    getReusableConversationState("WAITING_PAYMENT", "REQUIREMENTS_REVIEW"),
    "WAITING_PAYMENT"
  );
  assert.equal(
    getReusableConversationState("COLLECTING_INFO", "COLLECTING_REQUIREMENTS"),
    "COLLECTING_REQUIREMENTS"
  );
});

test("getReusableConversationState returns null for closed or unrelated conversations", () => {
  assert.equal(
    getReusableConversationState("IN_PRODUCTION", "REQUIREMENTS_REVIEW"),
    null
  );
  assert.equal(
    getReusableConversationState("COMPLETED", "COLLECTING_REQUIREMENTS"),
    null
  );
  assert.equal(
    getReusableConversationState("BROKEN_STATE", "REQUIREMENTS_REVIEW"),
    null
  );
});
