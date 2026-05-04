import test from "node:test";
import assert from "node:assert/strict";

import { getCommercialGateQuotes } from "../src/lib/backoffice-commercial-gate.ts";
import type { BackofficeSnapshot } from "../src/lib/backoffice-snapshot.ts";

function makeSnapshot(overrides: Partial<BackofficeSnapshot["quotes"][number]> = {}): BackofficeSnapshot {
  return {
    leads: [
      {
        id: "lead-commercial-gate",
        conversation_id: "conv-commercial-gate",
        product_type: "signage",
        width_mm: 1000,
        height_mm: 500,
        qty: 1,
        status: "approved",
        created_at: "2026-05-03T09:00:00.000Z",
        requested_document_type: "tax_invoice",
        customers: { display_name: "Commercial Gate", phone: null },
      },
    ],
    quotes: [
      {
        id: "quote-commercial-gate",
        lead_id: "lead-commercial-gate",
        status: "approved",
        total: 1200,
        public_token: "token-1",
        created_at: "2026-05-03T09:05:00.000Z",
        payment_terms: "prepaid",
        payment_status: "paid",
        leads: {
          id: "lead-commercial-gate",
          conversation_id: "conv-commercial-gate",
          product_type: "signage",
          width_mm: 1000,
          height_mm: 500,
          qty: 1,
          status: "approved",
          created_at: "2026-05-03T09:00:00.000Z",
          requested_document_type: "tax_invoice",
          customers: { display_name: "Commercial Gate", phone: null },
        },
        quote_items: [],
        jobs: [],
        commercialOrder: {
          id: "order-1",
          selectedReceiverEntityId: "entity-1",
          paymentReceiverLockedAt: "2026-05-03T09:10:00.000Z",
          customerTaxProfileId: "tax-1",
          confirmedPaymentId: "payment-1",
          confirmedPaymentStatus: "CONFIRMED",
          issuedDocumentId: null,
          issuedDocumentType: null,
          issuedDocumentNumber: null,
          issuedDocumentStatus: null,
        },
        ...overrides,
      },
    ],
    jobs: [],
    productionReviewQueue: [],
    escalations: [],
    recentConversations: [],
    conversations: [
      {
        id: "conv-commercial-gate",
        line_user_id: "line-user-1",
        state: "WAITING_PAYMENT",
        last_message_at: "2026-05-03T09:00:00.000Z",
        created_at: "2026-05-03T08:55:00.000Z",
      },
    ],
  };
}

test("getCommercialGateQuotes returns quotes blocked on commercial gate", () => {
  const commercialGateQuotes = getCommercialGateQuotes(makeSnapshot());

  assert.equal(commercialGateQuotes.length, 1);
  assert.equal(commercialGateQuotes[0]?.id, "quote-commercial-gate");
});

test("getCommercialGateQuotes keeps receiver-selection backlog visible before payment confirmation", () => {
  const commercialGateQuotes = getCommercialGateQuotes(
    makeSnapshot({
      payment_status: "unpaid",
      commercialOrder: {
        id: "order-1",
        selectedReceiverEntityId: null,
        paymentReceiverLockedAt: null,
        customerTaxProfileId: "tax-1",
        confirmedPaymentId: null,
        confirmedPaymentStatus: null,
        issuedDocumentId: null,
        issuedDocumentType: null,
        issuedDocumentNumber: null,
        issuedDocumentStatus: null,
      },
    })
  );

  assert.equal(commercialGateQuotes.length, 1);
  assert.equal(commercialGateQuotes[0]?.id, "quote-commercial-gate");
});

test("getCommercialGateQuotes includes confirmed payments that are still missing receiver lock", () => {
  const commercialGateQuotes = getCommercialGateQuotes(
    makeSnapshot({
      commercialOrder: {
        id: "order-1",
        selectedReceiverEntityId: "entity-1",
        paymentReceiverLockedAt: null,
        customerTaxProfileId: "tax-1",
        confirmedPaymentId: "payment-1",
        confirmedPaymentStatus: "CONFIRMED",
        issuedDocumentId: null,
        issuedDocumentType: null,
        issuedDocumentNumber: null,
        issuedDocumentStatus: null,
      },
    })
  );

  assert.equal(commercialGateQuotes.length, 1);
  assert.equal(commercialGateQuotes[0]?.id, "quote-commercial-gate");
});

test("getCommercialGateQuotes excludes paid quotes once the required document is issued", () => {
  const commercialGateQuotes = getCommercialGateQuotes(
    makeSnapshot({
      commercialOrder: {
        id: "order-1",
        selectedReceiverEntityId: "entity-1",
        paymentReceiverLockedAt: "2026-05-03T09:10:00.000Z",
        customerTaxProfileId: "tax-1",
        confirmedPaymentId: "payment-1",
        confirmedPaymentStatus: "CONFIRMED",
        issuedDocumentId: "document-1",
        issuedDocumentType: "TAX_INVOICE_RECEIPT",
        issuedDocumentNumber: "TIR-0001",
        issuedDocumentStatus: "ISSUED",
      },
    })
  );

  assert.equal(commercialGateQuotes.length, 0);
});