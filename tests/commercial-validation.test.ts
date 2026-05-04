import test from "node:test";
import assert from "node:assert/strict";

import {
  validatePaymentConfirm,
  validateReceiverEntityActive,
  allowedDocumentTypesAfterPayment,
} from "../src/lib/commercial-validation.ts";

// ── validatePaymentConfirm ────────────────────────────────────────────────────

test("validatePaymentConfirm: accepts when receiver matches and order is unlocked", () => {
  const result = validatePaymentConfirm({
    paymentReceiverEntityId: "entity-abc",
    selectedReceiverEntityId: "entity-abc",
    paymentReceiverLockedAt: null,
  });
  assert.equal(result.ok, true);
});

test("validatePaymentConfirm: rejects when order already locked", () => {
  const result = validatePaymentConfirm({
    paymentReceiverEntityId: "entity-abc",
    selectedReceiverEntityId: "entity-abc",
    paymentReceiverLockedAt: "2026-05-02T10:00:00Z",
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error, "PAYMENT_RECEIVER_LOCKED");
  }
});

test("validatePaymentConfirm: rejects when no receiver was selected", () => {
  const result = validatePaymentConfirm({
    paymentReceiverEntityId: "entity-abc",
    selectedReceiverEntityId: null,
    paymentReceiverLockedAt: null,
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error, "PAYMENT_RECEIVER_NOT_SELECTED");
  }
});

test("validatePaymentConfirm: rejects when payment receiver does not match selected receiver", () => {
  const result = validatePaymentConfirm({
    paymentReceiverEntityId: "entity-abc",
    selectedReceiverEntityId: "entity-xyz",
    paymentReceiverLockedAt: null,
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error, "PAYMENT_RECEIVER_MISMATCH");
    assert.ok(result.detail.includes("entity-abc"));
    assert.ok(result.detail.includes("entity-xyz"));
  }
});

test("validatePaymentConfirm: lock check takes priority over other errors", () => {
  // Even when entities mismatch, locked is the first gate.
  const result = validatePaymentConfirm({
    paymentReceiverEntityId: "entity-abc",
    selectedReceiverEntityId: "entity-xyz",
    paymentReceiverLockedAt: "2026-05-02T10:00:00Z",
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error, "PAYMENT_RECEIVER_LOCKED");
  }
});

// ── validateReceiverEntityActive ──────────────────────────────────────────────

test("validateReceiverEntityActive: accepts active entity", () => {
  const result = validateReceiverEntityActive({ id: "entity-abc", active: true });
  assert.equal(result.ok, true);
});

test("validateReceiverEntityActive: rejects inactive entity", () => {
  const result = validateReceiverEntityActive({ id: "entity-abc", active: false });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error, "RECEIVER_ENTITY_INACTIVE");
    assert.ok(result.detail.includes("entity-abc"));
  }
});

// ── allowedDocumentTypesAfterPayment ─────────────────────────────────────────

test("allowedDocumentTypesAfterPayment: VAT entity + customer requests tax invoice → TAX_INVOICE_RECEIPT", () => {
  const types = allowedDocumentTypesAfterPayment(
    { id: "e1", role: "MAIN_COMPANY", isVatRegistered: true, active: true },
    true
  );
  assert.deepEqual(types, ["TAX_INVOICE_RECEIPT"]);
});

test("allowedDocumentTypesAfterPayment: VAT entity + customer does not request tax invoice → RECEIPT only", () => {
  const types = allowedDocumentTypesAfterPayment(
    { id: "e1", role: "MAIN_COMPANY", isVatRegistered: true, active: true },
    false
  );
  assert.deepEqual(types, ["RECEIPT"]);
});

test("allowedDocumentTypesAfterPayment: non-VAT entity → RECEIPT only regardless of customer request", () => {
  const types = allowedDocumentTypesAfterPayment(
    { id: "e1", role: "MAIN_COMPANY", isVatRegistered: false, active: true },
    true
  );
  assert.deepEqual(types, ["RECEIPT"]);
});

test("allowedDocumentTypesAfterPayment: PERSONAL_ACCOUNT entity → RECEIPT only even if VAT registered", () => {
  // Edge case: personal entity cannot issue a company tax invoice (Policy §3.2).
  const types = allowedDocumentTypesAfterPayment(
    { id: "e1", role: "PERSONAL_ACCOUNT", isVatRegistered: true, active: true },
    true
  );
  assert.deepEqual(types, ["RECEIPT"]);
});
