import assert from "node:assert/strict";
import test from "node:test";

import { getCommercialReceiverWarnings } from "../src/lib/commercial-receiver-ui.ts";

const vatEntity = {
  id: "entity-vat",
  displayName: "VAT Entity",
  legalName: "VAT Entity Co., Ltd.",
  role: "MAIN_COMPANY" as const,
  isVatRegistered: true,
  active: true,
};

test("getCommercialReceiverWarnings blocks tax invoice for personal-account receivers", () => {
  const warnings = getCommercialReceiverWarnings({
    selectedEntity: {
      ...vatEntity,
      role: "PERSONAL_ACCOUNT",
      isVatRegistered: false,
    },
    requestedDocumentType: "tax_invoice",
    customerTaxProfileId: "tax-profile-1",
    paymentReceiverLockedAt: null,
  });

  assert.equal(warnings.some((warning) => warning.message.includes("บัญชีบุคคล")), true);
  assert.equal(warnings.some((warning) => warning.message.includes("ไม่ได้จด VAT")), true);
});

test("getCommercialReceiverWarnings warns when tax profile is missing for tax invoice requests", () => {
  const warnings = getCommercialReceiverWarnings({
    selectedEntity: vatEntity,
    requestedDocumentType: "tax_invoice",
    customerTaxProfileId: null,
    paymentReceiverLockedAt: null,
  });

  assert.equal(warnings.some((warning) => warning.message.includes("customer tax profile")), true);
});

test("getCommercialReceiverWarnings keeps missing receiver as the primary warning", () => {
  const warnings = getCommercialReceiverWarnings({
    selectedEntity: null,
    requestedDocumentType: "tax_invoice",
    customerTaxProfileId: null,
    paymentReceiverLockedAt: null,
  });

  assert.deepEqual(warnings, [
    {
      tone: "warning",
      message: "ยังไม่ได้เลือกผู้รับเงินก่อนยืนยัน payment",
    },
  ]);
});

test("getCommercialReceiverWarnings reports readiness for VAT receiver with tax profile", () => {
  const warnings = getCommercialReceiverWarnings({
    selectedEntity: vatEntity,
    requestedDocumentType: "tax_invoice",
    customerTaxProfileId: "tax-profile-1",
    paymentReceiverLockedAt: "2026-05-02T12:00:00.000Z",
  });

  assert.equal(warnings.some((warning) => warning.tone === "success"), true);
  assert.equal(
    warnings.some(
      (warning) => warning.tone === "info" && warning.message.includes("ล็อกผู้รับเงินแล้ว")
    ),
    true
  );
});