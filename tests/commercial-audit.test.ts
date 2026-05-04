import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCommercialDocumentIssueFailureAudit,
  buildCommercialPaymentConfirmFailureAudit,
} from "../src/lib/commercial-audit.ts";

test("buildCommercialPaymentConfirmFailureAudit marks receiver mismatch explicitly", () => {
  const audit = buildCommercialPaymentConfirmFailureAudit({
    error: "PAYMENT_RECEIVER_MISMATCH",
    detail: "Payment receiver and selected receiver differ.",
    paymentId: "payment-1",
    orderId: "order-1",
    quoteId: "quote-1",
    receiverEntityId: "entity-pay",
    selectedReceiverEntityId: "entity-selected",
    paymentReceiverLockedAt: null,
  });

  assert.equal(audit.actionType, "commercial.receiver_mismatch");
  assert.equal(audit.payload.phase, "payment_confirm");
});

test("buildCommercialPaymentConfirmFailureAudit marks lock failures separately", () => {
  const audit = buildCommercialPaymentConfirmFailureAudit({
    error: "RECEIVER_LOCK_FAILED",
    detail: "Failed to lock payment receiver. Retry is safe.",
    paymentId: "payment-1",
    orderId: "order-1",
    quoteId: "quote-1",
    receiverEntityId: "entity-pay",
    selectedReceiverEntityId: "entity-pay",
    paymentReceiverLockedAt: null,
  });

  assert.equal(audit.actionType, "commercial.receiver_lock_failed");
});

test("buildCommercialDocumentIssueFailureAudit marks tax-profile blocks as tax document blocks", () => {
  const audit = buildCommercialDocumentIssueFailureAudit({
    error: "CUSTOMER_TAX_PROFILE_REQUIRED",
    detail: "Customer tax profile is required before issuing a tax document.",
    paymentId: "payment-1",
    orderId: "order-1",
    quoteId: "quote-1",
    receiverEntityId: "entity-pay",
    requestedTaxInvoice: true,
  });

  assert.equal(audit.actionType, "commercial.tax_document_blocked");
  assert.equal(audit.payload.requested_tax_invoice, true);
});

test("buildCommercialDocumentIssueFailureAudit marks numbering conflicts separately", () => {
  const audit = buildCommercialDocumentIssueFailureAudit({
    error: "DOCUMENT_NUMBER_CONFLICT",
    detail: "DOCUMENT_NUMBER_CONFLICT",
    paymentId: "payment-1",
    orderId: "order-1",
    quoteId: "quote-1",
    receiverEntityId: "entity-pay",
    requestedTaxInvoice: false,
    documentType: "RECEIPT",
  });

  assert.equal(audit.actionType, "commercial.document_number_failed");
});