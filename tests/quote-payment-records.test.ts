import test from "node:test";
import assert from "node:assert/strict";

import {
  buildMonthlyAccountingCsv,
  buildQuotePaymentRecordMutation,
  getAccountingMonthRange,
} from "../src/lib/quote-payment-records";

test("buildQuotePaymentRecordMutation opens a manual payment record for approved deposit quotes", () => {
  const mutation = buildQuotePaymentRecordMutation({
    quoteId: "quote-1",
    leadId: "lead-1",
    quoteStatus: "approved",
    total: 2500,
    paymentTerms: "deposit",
    paymentStatus: "unpaid",
    paymentProfileSnapshot: { sourceProfile: "primary" },
    now: "2026-04-30T00:00:00.000Z",
  });

  assert.deepEqual(mutation, {
    quote_id: "quote-1",
    lead_id: "lead-1",
    amount_due: 2500,
    payment_terms: "deposit",
    payment_status: "unpaid",
    payment_profile_snapshot: { sourceProfile: "primary" },
    requires_action: true,
    opened_at: "2026-04-30T00:00:00.000Z",
    last_status_changed_at: "2026-04-30T00:00:00.000Z",
    partially_paid_at: null,
    paid_at: null,
    closed_at: null,
    updated_at: "2026-04-30T00:00:00.000Z",
  });
});

test("buildQuotePaymentRecordMutation closes the record when payment is marked paid", () => {
  const mutation = buildQuotePaymentRecordMutation({
    quoteId: "quote-1",
    leadId: "lead-1",
    quoteStatus: "approved",
    total: 2500,
    paymentTerms: "deposit",
    paymentStatus: "paid",
    now: "2026-05-01T00:00:00.000Z",
    existingRecord: {
      payment_status: "unpaid",
      opened_at: "2026-04-30T00:00:00.000Z",
      last_status_changed_at: "2026-04-30T00:00:00.000Z",
      partially_paid_at: null,
      paid_at: null,
      closed_at: null,
      payment_profile_snapshot: { sourceProfile: "primary" },
    },
  });

  assert.equal(mutation?.requires_action, false);
  assert.equal(mutation?.opened_at, "2026-04-30T00:00:00.000Z");
  assert.equal(mutation?.paid_at, "2026-05-01T00:00:00.000Z");
  assert.equal(mutation?.closed_at, "2026-05-01T00:00:00.000Z");
  assert.equal(mutation?.last_status_changed_at, "2026-05-01T00:00:00.000Z");
});

test("buildMonthlyAccountingCsv includes billing fields and escapes commas", () => {
  const csv = buildMonthlyAccountingCsv([
    {
      quote: {
        id: "quote-1",
        publicToken: "token-1",
        createdAt: "2026-04-30T00:00:00.000Z",
        status: "approved",
        subtotal: 1000,
        discount: 0,
        vat: 70,
        total: 1070,
        paymentTerms: "deposit",
        paymentStatus: "partial",
        paymentProfileSnapshot: {
          sourceProfile: "secondary",
          reason: "secondary_payment_terms",
          profile: {
            bankName: "KBank",
            accountName: "FOGUS Co., Ltd.",
          },
        },
      },
      lead: {
        requestedDocumentType: "tax_invoice",
        billingEntityType: "company",
        billingBranchType: "branch",
        billingBranchCode: "00012",
        billingName: "ACME, Ltd.",
        taxId: "0105550000001",
        billingAddress: "Bangkok",
      },
      customer: {
        displayName: "Acme Buyer",
        phone: "0812345678",
      },
      paymentRecord: {
        paymentStatus: "partial",
        amountDue: 1070,
        openedAt: "2026-04-30T00:00:00.000Z",
        lastStatusChangedAt: "2026-04-30T12:00:00.000Z",
        partiallyPaidAt: "2026-04-30T12:00:00.000Z",
        paidAt: null,
        closedAt: null,
        proofReference: "slip-001",
        proofReceivedAt: "2026-04-30T11:59:00.000Z",
        note: "waiting final balance",
      },
    },
  ]);

  assert.match(csv, /quote_created_at,quote_id,public_token/);
  assert.match(csv, /"ACME, Ltd\."/);
  assert.match(csv, /secondary_payment_terms/);
  assert.match(csv, /slip-001/);
});

test("getAccountingMonthRange falls back to the current UTC month for invalid input", () => {
  const range = getAccountingMonthRange("invalid", new Date("2026-04-30T12:00:00.000Z"));

  assert.equal(range.month, "2026-04");
  assert.equal(range.startIso, "2026-04-01T00:00:00.000Z");
  assert.equal(range.endIso, "2026-05-01T00:00:00.000Z");
});
