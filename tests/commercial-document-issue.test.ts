import assert from "node:assert/strict";
import test from "node:test";

import { buildCommercialDocumentIssuePlan } from "../src/lib/commercial-document-issue.ts";

const baseReceiver = {
  id: "entity-main",
  role: "MAIN_COMPANY" as const,
  isVatRegistered: true,
  active: true,
};

const baseInput = {
  paymentStatus: "CONFIRMED",
  paymentReceiverEntityId: "entity-main",
  selectedReceiverEntityId: "entity-main",
  paymentReceiverLockedAt: "2026-05-02T12:00:00.000Z",
  customerTaxProfileId: "tax-profile-1",
  customerRequestsTaxInvoice: true,
  quoteSubtotal: 1000,
  quoteDiscount: 100,
  quoteVat: 63,
  quoteTotal: 963,
  receiverEntity: baseReceiver,
  issuedAt: "2026-05-02T12:34:56.000Z",
};

test("buildCommercialDocumentIssuePlan returns a tax invoice receipt plan for a VAT receiver with tax request", () => {
  const result = buildCommercialDocumentIssuePlan(baseInput);

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.documentType, "TAX_INVOICE_RECEIPT");
    assert.equal(result.value.prefix, "TAXRE");
    assert.equal(result.value.sequenceYear, 2026);
    assert.equal(result.value.vatMode, "EXCLUSIVE");
    assert.equal(result.value.vatRate, 0.07);
    assert.equal(result.value.vatAmount, 63);
  }
});

test("buildCommercialDocumentIssuePlan falls back to receipt for a personal account", () => {
  const result = buildCommercialDocumentIssuePlan({
    ...baseInput,
    customerTaxProfileId: null,
    receiverEntity: {
      id: "entity-personal",
      role: "PERSONAL_ACCOUNT",
      isVatRegistered: false,
      active: true,
    },
    paymentReceiverEntityId: "entity-personal",
    selectedReceiverEntityId: "entity-personal",
    customerRequestsTaxInvoice: true,
    quoteVat: 0,
    quoteTotal: 900,
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.documentType, "RECEIPT");
    assert.equal(result.value.prefix, "RE");
    assert.equal(result.value.vatMode, "NO_VAT");
    assert.equal(result.value.vatAmount, 0);
  }
});

test("buildCommercialDocumentIssuePlan rejects unconfirmed payments", () => {
  const result = buildCommercialDocumentIssuePlan({
    ...baseInput,
    paymentStatus: "PENDING",
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error, "PAYMENT_NOT_CONFIRMED");
  }
});

test("buildCommercialDocumentIssuePlan rejects unlocked receiver state", () => {
  const result = buildCommercialDocumentIssuePlan({
    ...baseInput,
    paymentReceiverLockedAt: null,
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error, "PAYMENT_RECEIVER_NOT_LOCKED");
  }
});

test("buildCommercialDocumentIssuePlan rejects mismatched issuer selection", () => {
  const result = buildCommercialDocumentIssuePlan({
    ...baseInput,
    selectedReceiverEntityId: "entity-other",
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error, "DOCUMENT_ISSUER_MISMATCH");
    assert.match(result.detail, /entity-other/);
  }
});

test("buildCommercialDocumentIssuePlan requires a customer tax profile for tax documents", () => {
  const result = buildCommercialDocumentIssuePlan({
    ...baseInput,
    customerTaxProfileId: null,
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error, "CUSTOMER_TAX_PROFILE_REQUIRED");
  }
});

test("buildCommercialDocumentIssuePlan rejects inactive receivers", () => {
  const result = buildCommercialDocumentIssuePlan({
    ...baseInput,
    receiverEntity: {
      ...baseReceiver,
      active: false,
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error, "RECEIVER_ENTITY_INACTIVE");
  }
});