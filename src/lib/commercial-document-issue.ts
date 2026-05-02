import {
  allowedDocumentTypesAfterPayment,
  type ReceiverEntitySnapshot,
  validateReceiverEntityActive,
} from "./commercial-validation.ts";

export type IssueDocumentErrorCode =
  | "PAYMENT_NOT_CONFIRMED"
  | "PAYMENT_RECEIVER_NOT_LOCKED"
  | "PAYMENT_RECEIVER_NOT_SELECTED"
  | "DOCUMENT_ISSUER_MISMATCH"
  | "CUSTOMER_TAX_PROFILE_REQUIRED"
  | "CUSTOMER_TAX_PROFILE_CUSTOMER_MISMATCH"
  | "RECEIVER_ENTITY_INACTIVE";

export type IssueDocumentResult<T = void> =
  | { ok: true; value: T }
  | { ok: false; error: IssueDocumentErrorCode; detail: string };

export type DocumentTypeAfterPayment = "RECEIPT" | "TAX_INVOICE_RECEIPT";
export type DocumentVatMode = "EXCLUSIVE" | "NO_VAT";

export interface CommercialDocumentIssuePlanInput {
  paymentStatus: string;
  paymentReceiverEntityId: string;
  selectedReceiverEntityId: string | null;
  paymentReceiverLockedAt: string | null;
  customerId: string;
  customerTaxProfileId: string | null;
  customerTaxProfileCustomerId: string | null;
  customerRequestsTaxInvoice: boolean;
  quoteSubtotal: number;
  quoteDiscount: number;
  quoteVat: number;
  quoteTotal: number;
  receiverEntity: ReceiverEntitySnapshot;
  issuedAt?: string;
}

export interface CommercialDocumentIssuePlan {
  documentType: DocumentTypeAfterPayment;
  prefix: string;
  sequenceYear: number;
  vatMode: DocumentVatMode;
  vatRate: number;
  subtotal: number;
  discountAmount: number;
  vatAmount: number;
  grandTotal: number;
  issuedAt: string;
  lockedAt: string;
}

function getDocumentPrefix(documentType: DocumentTypeAfterPayment) {
  return documentType === "TAX_INVOICE_RECEIPT" ? "TAXRE" : "RE";
}

export function buildCommercialDocumentIssuePlan(
  input: CommercialDocumentIssuePlanInput
): IssueDocumentResult<CommercialDocumentIssuePlan> {
  if (input.paymentStatus !== "CONFIRMED") {
    return {
      ok: false,
      error: "PAYMENT_NOT_CONFIRMED",
      detail: "Payment must be CONFIRMED before issuing a commercial document.",
    };
  }

  if (!input.paymentReceiverLockedAt) {
    return {
      ok: false,
      error: "PAYMENT_RECEIVER_NOT_LOCKED",
      detail: "Payment receiver must be locked before issuing a commercial document.",
    };
  }

  if (!input.selectedReceiverEntityId) {
    return {
      ok: false,
      error: "PAYMENT_RECEIVER_NOT_SELECTED",
      detail: "A receiver entity must be selected before issuing a commercial document.",
    };
  }

  if (input.paymentReceiverEntityId !== input.selectedReceiverEntityId) {
    return {
      ok: false,
      error: "DOCUMENT_ISSUER_MISMATCH",
      detail: `Payment receiver (${input.paymentReceiverEntityId}) does not match selected receiver (${input.selectedReceiverEntityId}).`,
    };
  }

  const entityValidation = validateReceiverEntityActive(input.receiverEntity);
  if (!entityValidation.ok) {
    return {
      ok: false,
      error: "RECEIVER_ENTITY_INACTIVE",
      detail: entityValidation.detail,
    };
  }

  const allowedTypes = allowedDocumentTypesAfterPayment(
    input.receiverEntity,
    input.customerRequestsTaxInvoice
  );
  const documentType = allowedTypes[0] as DocumentTypeAfterPayment | undefined;

  if (!documentType) {
    return {
      ok: false,
      error: "DOCUMENT_ISSUER_MISMATCH",
      detail: "No commercial document type is allowed for this receiver entity.",
    };
  }

  if (
    documentType === "TAX_INVOICE_RECEIPT" &&
    !input.customerTaxProfileId
  ) {
    return {
      ok: false,
      error: "CUSTOMER_TAX_PROFILE_REQUIRED",
      detail: "Customer tax profile is required before issuing a tax document.",
    };
  }

  if (
    input.customerTaxProfileId &&
    input.customerTaxProfileCustomerId !== null &&
    input.customerTaxProfileCustomerId !== input.customerId
  ) {
    return {
      ok: false,
      error: "CUSTOMER_TAX_PROFILE_CUSTOMER_MISMATCH",
      detail: `Customer tax profile ${input.customerTaxProfileId} does not belong to customer ${input.customerId}.`,
    };
  }

  const issuedAt = input.issuedAt ?? new Date().toISOString();
  const vatMode: DocumentVatMode =
    input.receiverEntity.isVatRegistered && input.quoteVat > 0
      ? "EXCLUSIVE"
      : "NO_VAT";
  const vatRate = vatMode === "EXCLUSIVE" ? 0.07 : 0;

  return {
    ok: true,
    value: {
      documentType,
      prefix: getDocumentPrefix(documentType),
      sequenceYear: new Date(issuedAt).getUTCFullYear(),
      vatMode,
      vatRate,
      subtotal: input.quoteSubtotal,
      discountAmount: input.quoteDiscount,
      vatAmount: vatMode === "EXCLUSIVE" ? input.quoteVat : 0,
      grandTotal: input.quoteTotal,
      issuedAt,
      lockedAt: input.paymentReceiverLockedAt,
    },
  };
}