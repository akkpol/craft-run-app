export type CommercialReceiverRole = "MAIN_COMPANY" | "SUB_COMPANY" | "PERSONAL_ACCOUNT";

export type CommercialReceiverEntityOption = {
  id: string;
  displayName: string;
  legalName: string;
  role: CommercialReceiverRole;
  isVatRegistered: boolean;
  active: boolean;
};

export type CommercialOrderReceiverState = {
  id: string;
  selectedReceiverEntityId: string | null;
  paymentReceiverLockedAt: string | null;
  customerTaxProfileId: string | null;
};

export type CommercialReceiverWarning = {
  tone: "info" | "warning" | "danger" | "success";
  message: string;
};

export function getCommercialReceiverLabel(
  entity: CommercialReceiverEntityOption | null | undefined
) {
  if (!entity) {
    return "ยังไม่ได้เลือกผู้รับเงิน";
  }

  return entity.displayName || entity.legalName || entity.id;
}

export function getCommercialReceiverWarnings(input: {
  selectedEntity: CommercialReceiverEntityOption | null;
  requestedDocumentType: string | null | undefined;
  customerTaxProfileId: string | null | undefined;
  paymentReceiverLockedAt: string | null | undefined;
}): CommercialReceiverWarning[] {
  const warnings: CommercialReceiverWarning[] = [];
  const wantsTaxInvoice = input.requestedDocumentType === "tax_invoice";

  if (input.paymentReceiverLockedAt) {
    warnings.push({
      tone: "success",
      message: "ล็อกผู้รับเงินแล้ว เอกสารหลังรับเงินต้องออกในชื่อ entity นี้เท่านั้น",
    });
  }

  if (!input.selectedEntity) {
    warnings.push({
      tone: "warning",
      message: "ยังไม่ได้เลือกผู้รับเงินก่อนยืนยัน payment",
    });
    return warnings;
  }

  if (!input.selectedEntity.active) {
    warnings.push({
      tone: "danger",
      message: "entity นี้ถูกปิดใช้งานแล้ว ห้ามใช้เป็นผู้รับเงิน",
    });
  }

  if (!wantsTaxInvoice) {
    warnings.push({
      tone: "info",
      message: "ลูกค้าไม่ได้ขอใบกำกับภาษี ระบบจะออกเอกสารหลังรับเงินตามประเภทที่ policy อนุญาต",
    });
    return warnings;
  }

  if (input.selectedEntity.role === "PERSONAL_ACCOUNT") {
    warnings.push({
      tone: "danger",
      message: "ลูกค้าขอใบกำกับภาษี แต่บัญชีบุคคลออกได้เฉพาะใบรับเงิน ไม่ใช่ใบกำกับภาษีบริษัท",
    });
  }

  if (!input.selectedEntity.isVatRegistered) {
    warnings.push({
      tone: "danger",
      message: "ลูกค้าขอใบกำกับภาษี แต่ entity นี้ไม่ได้จด VAT จึงออก tax invoice ไม่ได้",
    });
  }

  if (!input.customerTaxProfileId) {
    warnings.push({
      tone: "warning",
      message: "ลูกค้าขอใบกำกับภาษี แต่ยังไม่มี customer tax profile ที่ lock กับ commercial order",
    });
  }

  if (
    input.selectedEntity.role !== "PERSONAL_ACCOUNT" &&
    input.selectedEntity.isVatRegistered &&
    input.customerTaxProfileId
  ) {
    warnings.push({
      tone: "success",
      message: "ข้อมูลพร้อมสำหรับออกใบเสร็จรับเงิน/ใบกำกับภาษีหลัง payment ถูก lock",
    });
  }

  return warnings;
}