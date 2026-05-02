import type {
  BillingBranchType,
  BillingEntityType,
  DocumentRequestType,
} from "./types";

export type TaxDocumentIntakeInput = {
  requestedDocumentType: DocumentRequestType | string | null | undefined;
  billingEntityType: BillingEntityType | string | null | undefined;
  billingBranchType?: BillingBranchType | string | null | undefined;
  billingBranchCode?: string | null | undefined;
  billingName?: string | null | undefined;
  taxId?: string | null | undefined;
  billingAddress?: string | null | undefined;
};

export type TaxDocumentIntakeValidation = {
  requiresTaxProfile: boolean;
  errors: string[];
  notices: string[];
};

function hasText(value: string | null | undefined) {
  return Boolean(value?.trim());
}

export function validateTaxDocumentIntake(
  input: TaxDocumentIntakeInput
): TaxDocumentIntakeValidation {
  const requiresTaxProfile = input.requestedDocumentType === "tax_invoice";

  if (!requiresTaxProfile) {
    return {
      requiresTaxProfile,
      errors: [],
      notices: [],
    };
  }

  const errors: string[] = [];

  if (!hasText(input.billingName)) {
    errors.push("กรุณาระบุชื่อที่ใช้ออกใบกำกับภาษี");
  }

  if (!hasText(input.taxId)) {
    errors.push("กรุณาระบุเลขผู้เสียภาษีสำหรับใบกำกับภาษี");
  }

  if (!hasText(input.billingAddress)) {
    errors.push("กรุณาระบุที่อยู่ออกใบกำกับภาษี");
  }

  if (input.billingEntityType === "company") {
    if (!input.billingBranchType) {
      errors.push("กรุณาระบุสำนักงานใหญ่หรือสาขาสำหรับนิติบุคคล");
    }

    if (input.billingBranchType === "branch" && !hasText(input.billingBranchCode)) {
      errors.push("กรุณาระบุเลขสาขาสำหรับใบกำกับภาษีของนิติบุคคล");
    }
  }

  return {
    requiresTaxProfile,
    errors,
    notices: [
      "การออกใบกำกับภาษียังขึ้นกับผู้รับเงินที่แอดมินเลือกหลังบ้าน: ผู้รับเงินต้องเป็นผู้ขายที่จด VAT และจะถูกล็อกหลังยืนยันการชำระเงิน",
    ],
  };
}

export function formatTaxDocumentIntakeErrors(errors: string[]) {
  return errors.join(" / ");
}