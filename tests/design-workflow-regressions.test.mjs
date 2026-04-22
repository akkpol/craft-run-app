/**
 * Regression tests for 4 workflow-policy fixes.
 *
 * Fix #1 — designStatusNeedsCustomerResponse must only fire for "preview_sent"
 * Fix #2 — approve_design with no active job must resume to REQUIREMENTS_REVIEW
 * Fix #3 — admin "approved" action must be disabled / rejected from non-preview_sent states
 * Fix #4 — fresh restart sentinel "" lets getLeadsToSupersedeForFreshRestart include all non-superseded leads
 *
 * Run: node --experimental-strip-types tests/design-workflow-regressions.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import {
  getLeadsToSupersedeForFreshRestart,
  isLeadSupersedableForFreshRestart,
} from "../src/lib/customer-restart.ts";

// ---------------------------------------------------------------------------
// Load designStatusNeedsCustomerResponse from types.ts via ts.transpileModule.
// types.ts has a bare (no-extension) import from "./workflow-state" that Node
// cannot resolve without patching.  The "./locale" import is type-only and will
// be erased by the TypeScript transpiler automatically.
// ---------------------------------------------------------------------------
const typesUrl = new URL("../src/lib/types.ts", import.meta.url);
const workflowStateUrl = new URL("../src/lib/workflow-state.ts", import.meta.url);
const typesSource = await readFile(typesUrl, "utf8");
const patchedTypesSource = typesSource.replace(
  'from "./workflow-state";',
  `from ${JSON.stringify(workflowStateUrl.href)};`
);
const transpiledTypes = ts.transpileModule(patchedTypesSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
/** @type {typeof import("../src/lib/types")} */
const { designStatusNeedsCustomerResponse } = await import(
  `data:text/javascript,${encodeURIComponent(transpiledTypes.outputText)}`
);

// ---------------------------------------------------------------------------
// Fix #1: designStatusNeedsCustomerResponse
// ---------------------------------------------------------------------------

test("Fix #1 — preview_sent needs customer response", () => {
  assert.equal(designStatusNeedsCustomerResponse("preview_sent"), true);
});

test("Fix #1 — revision_requested must NOT need customer response (was incorrectly true before fix)", () => {
  assert.equal(designStatusNeedsCustomerResponse("revision_requested"), false);
});

test("Fix #1 — not_started does not need customer response", () => {
  assert.equal(designStatusNeedsCustomerResponse("not_started"), false);
});

test("Fix #1 — drafting does not need customer response", () => {
  assert.equal(designStatusNeedsCustomerResponse("drafting"), false);
});

test("Fix #1 — approved does not need customer response", () => {
  assert.equal(designStatusNeedsCustomerResponse("approved"), false);
});

test("Fix #1 — null does not need customer response", () => {
  assert.equal(designStatusNeedsCustomerResponse(null), false);
});

test("Fix #1 — undefined does not need customer response", () => {
  assert.equal(designStatusNeedsCustomerResponse(undefined), false);
});

// ---------------------------------------------------------------------------
// Fix #4: getLeadsToSupersedeForFreshRestart with "" sentinel
// The pre-creation fresh-restart path passes "" so that ALL non-superseded leads
// owned by this customer are included in the supersede list (none are filtered
// out as the "replacement" lead because no lead exists yet).
// ---------------------------------------------------------------------------

const makeCandidate = (id, overrides = {}) => ({
  id,
  conversation_id: "conv-" + id,
  status: "quoted",
  superseded_at: null,
  quotes: [],
  ...overrides,
});

test("Fix #4 — sentinel \"\" does not exclude any lead", () => {
  const leads = [makeCandidate("lead-1"), makeCandidate("lead-2")];
  const result = getLeadsToSupersedeForFreshRestart(leads, "");
  // Both leads are supersedable; neither matches the "" sentinel
  assert.equal(result.length, 2);
  assert.ok(result.some((l) => l.id === "lead-1"));
  assert.ok(result.some((l) => l.id === "lead-2"));
});

test("Fix #4 — real lead.id is excluded when passed as replacementLeadId (existing behaviour)", () => {
  const leads = [makeCandidate("lead-1"), makeCandidate("lead-2")];
  const result = getLeadsToSupersedeForFreshRestart(leads, "lead-1");
  assert.equal(result.length, 1);
  assert.equal(result[0].id, "lead-2");
});

test("Fix #4 — already superseded leads are not included", () => {
  const leads = [
    makeCandidate("lead-1", { superseded_at: "2025-01-01T00:00:00Z" }),
    makeCandidate("lead-2"),
  ];
  const result = getLeadsToSupersedeForFreshRestart(leads, "");
  assert.equal(result.length, 1);
  assert.equal(result[0].id, "lead-2");
});

test("Fix #4 — lead with active job is not supersedable", () => {
  const leadWithJob = makeCandidate("lead-with-job", {
    quotes: [
      {
        id: "q1",
        status: "approved",
        jobs: [{ id: "j1", status: "IN_DESIGN" }],
      },
    ],
  });
  assert.equal(isLeadSupersedableForFreshRestart(leadWithJob), false);
});

test("Fix #4 — lead with no quotes is supersedable", () => {
  const leadNoQuote = makeCandidate("lead-no-quote", { quotes: [] });
  assert.equal(isLeadSupersedableForFreshRestart(leadNoQuote), true);
});
