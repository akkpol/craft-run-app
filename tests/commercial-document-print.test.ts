import assert from "node:assert/strict";
import test from "node:test";

import { buildCommercialDocumentPrintModel } from "../src/lib/commercial-document-print.ts";

const snapshot = {
  document_type: "TAX_INVOICE_RECEIPT",
  document_number: "TAXRE-2026-00009",
  issued_at: "2026-05-02T15:20:00.000Z",
  locked_at: "2026-05-02T15:00:00.000Z",
  issuer: {
    legal_name: "Snapshot VAT Co., Ltd.",
    display_name: "Live name must not win",
    role: "MAIN_COMPANY",
    tax_id: "0105555555001",
    branch_type: "HEAD_OFFICE",
    address: "Snapshot issuer address",
  },
  customer: {
    billing_name: "Fallback customer",
    billing_address: "Fallback address",
    tax_id: "fallback-tax",
    tax_profile: {
      legal_name: "Snapshot Customer Co., Ltd.",
      tax_id: "0105555555999",
      branch_type: "BRANCH",
      branch_code: "00002",
      branch_name: "Silom",
      address: "Snapshot customer address",
    },
  },
  payment: {
    id: "payment-1",
    amount: 963,
    currency: "THB",
    paid_at: "2026-05-02T15:25:00.000Z",
    receiver_entity_id: "entity-1",
  },
  totals: {
    subtotal: 1000,
    discount_amount: 100,
    vat_mode: "EXCLUSIVE",
    vat_rate: 0.07,
    vat_amount: 63,
    grand_total: 963,
  },
};

test("buildCommercialDocumentPrintModel renders commercial documents from locked snapshot data", () => {
  const model = buildCommercialDocumentPrintModel({
    id: "document-1",
    status: "ISSUED",
    snapshot_json: snapshot,
  });

  assert.ok(model);
  assert.equal(model.documentNumber, "TAXRE-2026-00009");
  assert.equal(model.titleTh, "ใบเสร็จรับเงิน/ใบกำกับภาษี");
  assert.equal(model.titleEn, "Receipt / Tax Invoice");
  assert.deepEqual(model.issuerRows, [
    "Snapshot VAT Co., Ltd.",
    "เลขประจำตัวผู้เสียภาษี / Tax ID: 0105555555001",
    "สาขา / Branch: สำนักงานใหญ่ / Head office",
    "ที่อยู่ / Address: Snapshot issuer address",
  ]);
  assert.equal(model.customerRows[0], "Snapshot Customer Co., Ltd.");
  assert.match(model.customerRows[2], /Silom/);
  assert.equal(model.totals.subtotal, "1,000.00");
  assert.equal(model.totals.vatRate, "7.00%");
  assert.equal(model.totals.grandTotal, "963.00");
});

test("buildCommercialDocumentPrintModel uses the original lock date instead of payment date", () => {
  const model = buildCommercialDocumentPrintModel({
    id: "document-1",
    status: "ISSUED",
    snapshot_json: {
      ...snapshot,
      locked_at: "2026-05-01T15:00:00.000Z",
    },
  });

  assert.ok(model);
  assert.notEqual(model.lockedDate, model.paymentDate);
  assert.equal(model.lockedDate, "1/5/2569");
  assert.equal(model.paymentDate, "2/5/2569");
});

test("buildCommercialDocumentPrintModel labels personal-account receipts as payment receipts", () => {
  const model = buildCommercialDocumentPrintModel({
    id: "document-2",
    status: "ISSUED",
    snapshot_json: {
      ...snapshot,
      document_type: "RECEIPT",
      issuer: {
        legal_name: "Personal Receiver",
        role: "PERSONAL_ACCOUNT",
        branch_type: "HEAD_OFFICE",
      },
      totals: {
        grand_total: 900,
      },
    },
  });

  assert.ok(model);
  assert.equal(model.titleTh, "ใบรับเงิน");
  assert.equal(model.titleEn, "Receipt");
});

test("buildCommercialDocumentPrintModel exposes a locked document appendix image", () => {
  const model = buildCommercialDocumentPrintModel({
    id: "document-appendix",
    status: "ISSUED",
    snapshot_json: {
      ...snapshot,
      document_appendix: {
        image_url: "https://example.com/document-appendix.png",
        image_name: "billing-appendix.png",
      },
    },
  });

  assert.ok(model);
  assert.deepEqual(model.documentAppendix, {
    imageUrl: "https://example.com/document-appendix.png",
    imageName: "billing-appendix.png",
  });
});

test("buildCommercialDocumentPrintModel rejects missing snapshots", () => {
  assert.equal(
    buildCommercialDocumentPrintModel({
      id: "document-3",
      status: "ISSUED",
      snapshot_json: null,
    }),
    null
  );
});