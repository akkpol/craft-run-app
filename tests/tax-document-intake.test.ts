import test from "node:test";
import assert from "node:assert/strict";

import {
  formatTaxDocumentIntakeErrors,
  validateTaxDocumentIntake,
} from "../src/lib/tax-document-intake.ts";

test("validateTaxDocumentIntake allows non-tax document requests without required tax fields", () => {
  const result = validateTaxDocumentIntake({
    requestedDocumentType: "receipt",
    billingEntityType: "person",
  });

  assert.equal(result.requiresTaxProfile, false);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.notices, []);
});

test("validateTaxDocumentIntake requires tax identity fields for tax invoice requests", () => {
  const result = validateTaxDocumentIntake({
    requestedDocumentType: "tax_invoice",
    billingEntityType: "company",
    billingBranchType: "head_office",
    billingName: "",
    taxId: "",
    billingAddress: "",
  });

  assert.deepEqual(result.errors, [
    "กรุณาระบุชื่อที่ใช้ออกใบกำกับภาษี",
    "กรุณาระบุเลขผู้เสียภาษีสำหรับใบกำกับภาษี",
    "กรุณาระบุที่อยู่ออกใบกำกับภาษี",
  ]);
});

test("validateTaxDocumentIntake requires branch code for company branch tax invoices", () => {
  const result = validateTaxDocumentIntake({
    requestedDocumentType: "tax_invoice",
    billingEntityType: "company",
    billingBranchType: "branch",
    billingBranchCode: "",
    billingName: "บริษัท ตัวอย่าง จำกัด",
    taxId: "0105559999999",
    billingAddress: "Bangkok",
  });

  assert.deepEqual(result.errors, [
    "กรุณาระบุเลขสาขาสำหรับใบกำกับภาษีของนิติบุคคล",
  ]);
});

test("validateTaxDocumentIntake accepts complete company head office tax profile", () => {
  const result = validateTaxDocumentIntake({
    requestedDocumentType: "tax_invoice",
    billingEntityType: "company",
    billingBranchType: "head_office",
    billingName: "บริษัท ตัวอย่าง จำกัด",
    taxId: "0105559999999",
    billingAddress: "Bangkok",
  });

  assert.equal(result.requiresTaxProfile, true);
  assert.deepEqual(result.errors, []);
  assert.equal(result.notices.length, 1);
});

test("formatTaxDocumentIntakeErrors joins customer-facing errors", () => {
  assert.equal(formatTaxDocumentIntakeErrors(["หนึ่ง", "สอง"]), "หนึ่ง / สอง");
});