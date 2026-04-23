import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

// `import type { WorkflowState }` is erased at transpile time — no @/ patching needed.
const srcUrl = new URL(
  "../src/lib/webhook-returning-customer.ts",
  import.meta.url
);
const source = await readFile(srcUrl, "utf8");
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
});

/** @type {typeof import("../src/lib/webhook-returning-customer")} */
const { getReturningCustomerReplyType } = await import(
  `data:text/javascript,${encodeURIComponent(transpiled.outputText)}`
);

// ── Happy-path: active production states ─────────────────────────────────────

test("IN_DESIGN → production_status (not reused)", () => {
  assert.equal(
    getReturningCustomerReplyType({
      conversationState: "IN_DESIGN",
      isReusedConversation: false,
      previousConvWasTerminal: false,
    }),
    "production_status"
  );
});

test("IN_DESIGN → production_status (reused)", () => {
  assert.equal(
    getReturningCustomerReplyType({
      conversationState: "IN_DESIGN",
      isReusedConversation: true,
      previousConvWasTerminal: false,
    }),
    "production_status"
  );
});

test("IN_PRODUCTION → production_status", () => {
  assert.equal(
    getReturningCustomerReplyType({
      conversationState: "IN_PRODUCTION",
      isReusedConversation: false,
      previousConvWasTerminal: false,
    }),
    "production_status"
  );
});

test("READY_FOR_FULFILLMENT → production_status", () => {
  assert.equal(
    getReturningCustomerReplyType({
      conversationState: "READY_FOR_FULFILLMENT",
      isReusedConversation: false,
      previousConvWasTerminal: false,
    }),
    "production_status"
  );
});

// ── Bug fix: WAITING_QUOTE_APPROVAL must NOT fall into resume_or_fresh ────────

test("WAITING_QUOTE_APPROVAL → quote_approval_context (not reused)", () => {
  assert.equal(
    getReturningCustomerReplyType({
      conversationState: "WAITING_QUOTE_APPROVAL",
      isReusedConversation: false,
      previousConvWasTerminal: false,
    }),
    "quote_approval_context"
  );
});

test("WAITING_QUOTE_APPROVAL → quote_approval_context (reused)", () => {
  assert.equal(
    getReturningCustomerReplyType({
      conversationState: "WAITING_QUOTE_APPROVAL",
      isReusedConversation: true,
      previousConvWasTerminal: false,
    }),
    "quote_approval_context"
  );
});

// ── Bug fix: WAITING_PAYMENT must NOT fall into resume_or_fresh ───────────────

test("WAITING_PAYMENT → payment_context (not reused)", () => {
  assert.equal(
    getReturningCustomerReplyType({
      conversationState: "WAITING_PAYMENT",
      isReusedConversation: false,
      previousConvWasTerminal: false,
    }),
    "payment_context"
  );
});

test("WAITING_PAYMENT → payment_context (reused)", () => {
  assert.equal(
    getReturningCustomerReplyType({
      conversationState: "WAITING_PAYMENT",
      isReusedConversation: true,
      previousConvWasTerminal: false,
    }),
    "payment_context"
  );
});

// ── Resume-or-fresh: only for early in-flight states ─────────────────────────

test("COLLECTING_REQUIREMENTS + reused → resume_or_fresh", () => {
  assert.equal(
    getReturningCustomerReplyType({
      conversationState: "COLLECTING_REQUIREMENTS",
      isReusedConversation: true,
      previousConvWasTerminal: false,
    }),
    "resume_or_fresh"
  );
});

test("REQUIREMENTS_REVIEW + reused → resume_or_fresh", () => {
  assert.equal(
    getReturningCustomerReplyType({
      conversationState: "REQUIREMENTS_REVIEW",
      isReusedConversation: true,
      previousConvWasTerminal: false,
    }),
    "resume_or_fresh"
  );
});

test("ON_HOLD_CUSTOMER_INPUT + reused → resume_or_fresh", () => {
  assert.equal(
    getReturningCustomerReplyType({
      conversationState: "ON_HOLD_CUSTOMER_INPUT",
      isReusedConversation: true,
      previousConvWasTerminal: false,
    }),
    "resume_or_fresh"
  );
});

test("COLLECTING_REQUIREMENTS + NOT reused → intake_link", () => {
  assert.equal(
    getReturningCustomerReplyType({
      conversationState: "COLLECTING_REQUIREMENTS",
      isReusedConversation: false,
      previousConvWasTerminal: false,
    }),
    "intake_link"
  );
});

// ── Terminal predecessor ──────────────────────────────────────────────────────

test("NEW_MESSAGE + previousConvWasTerminal → terminal_fresh_intake", () => {
  assert.equal(
    getReturningCustomerReplyType({
      conversationState: "NEW_MESSAGE",
      isReusedConversation: false,
      previousConvWasTerminal: true,
    }),
    "terminal_fresh_intake"
  );
});

test("COMPLETED + previousConvWasTerminal=true → terminal_fresh_intake", () => {
  assert.equal(
    getReturningCustomerReplyType({
      conversationState: "COMPLETED",
      isReusedConversation: false,
      previousConvWasTerminal: true,
    }),
    "terminal_fresh_intake"
  );
});

// ── Default fallback ──────────────────────────────────────────────────────────

test("NEW_MESSAGE + no reuse + no terminal predecessor → intake_link", () => {
  assert.equal(
    getReturningCustomerReplyType({
      conversationState: "NEW_MESSAGE",
      isReusedConversation: false,
      previousConvWasTerminal: false,
    }),
    "intake_link"
  );
});

test("HUMAN_REVIEW_REQUIRED + not reused → intake_link", () => {
  assert.equal(
    getReturningCustomerReplyType({
      conversationState: "HUMAN_REVIEW_REQUIRED",
      isReusedConversation: false,
      previousConvWasTerminal: false,
    }),
    "intake_link"
  );
});
