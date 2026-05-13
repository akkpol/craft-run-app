import type { IssueDocumentErrorCode } from "./commercial-document-issue.ts";
import type { ValidationErrorCode } from "./commercial-validation.ts";

type PaymentConfirmAuditErrorCode =
  | ValidationErrorCode
  | "RECEIVER_LOCK_FAILED";

type DocumentIssueAuditErrorCode =
  | IssueDocumentErrorCode
  | "DOCUMENT_ALREADY_ISSUED"
  | "DOCUMENT_NUMBER_CONFLICT";

type DocumentDeliverySkipReason =
  | "missing_public_token"
  | "missing_conversation_id"
  | "conversation_not_found"
  | "missing_line_user_id";

type AuditLogShape = {
  actionType: string;
  payload: Record<string, unknown>;
};

export function buildCommercialPaymentConfirmFailureAudit(input: {
  error: PaymentConfirmAuditErrorCode;
  detail: string;
  paymentId: string;
  orderId: string;
  quoteId: string;
  receiverEntityId: string | null;
  selectedReceiverEntityId: string | null;
  paymentReceiverLockedAt: string | null;
}): AuditLogShape {
  const actionType =
    input.error === "PAYMENT_RECEIVER_MISMATCH"
      ? "commercial.receiver_mismatch"
      : input.error === "RECEIVER_LOCK_FAILED"
        ? "commercial.receiver_lock_failed"
        : "commercial.payment_confirm_blocked";

  return {
    actionType,
    payload: {
      phase: "payment_confirm",
      error: input.error,
      detail: input.detail,
      payment_id: input.paymentId,
      order_id: input.orderId,
      quote_id: input.quoteId,
      receiver_entity_id: input.receiverEntityId,
      selected_receiver_entity_id: input.selectedReceiverEntityId,
      payment_receiver_locked_at: input.paymentReceiverLockedAt,
    },
  };
}

export function buildCommercialDocumentIssueFailureAudit(input: {
  error: DocumentIssueAuditErrorCode;
  detail: string;
  paymentId: string;
  orderId: string;
  quoteId: string;
  receiverEntityId: string | null;
  requestedTaxInvoice: boolean;
  documentType?: string | null;
  documentNumber?: string | null;
}): AuditLogShape {
  const actionType =
    input.error === "DOCUMENT_ISSUER_MISMATCH"
      ? "commercial.receiver_mismatch"
      : input.error === "CUSTOMER_TAX_PROFILE_REQUIRED" ||
          input.error === "CUSTOMER_TAX_PROFILE_CUSTOMER_MISMATCH"
        ? "commercial.tax_document_blocked"
        : input.error === "DOCUMENT_NUMBER_CONFLICT"
          ? "commercial.document_number_failed"
          : "commercial.document_issue_blocked";

  return {
    actionType,
    payload: {
      phase: "document_issue",
      error: input.error,
      detail: input.detail,
      payment_id: input.paymentId,
      order_id: input.orderId,
      quote_id: input.quoteId,
      receiver_entity_id: input.receiverEntityId,
      requested_tax_invoice: input.requestedTaxInvoice,
      document_type: input.documentType ?? null,
      document_number: input.documentNumber ?? null,
    },
  };
}

export function buildCommercialDocumentDeliverySkipAudit(input: {
  reason: DocumentDeliverySkipReason;
  detail: string;
  paymentId: string;
  orderId: string;
  quoteId: string;
  documentId: string;
  documentType: string;
  documentNumber: string;
  conversationId?: string | null;
  lineUserId?: string | null;
}): AuditLogShape {
  const actionType =
    input.reason === "missing_public_token"
      ? "commercial.document_delivery_skipped_no_token"
      : input.reason === "missing_conversation_id"
        ? "commercial.document_delivery_skipped_no_conv"
        : input.reason === "conversation_not_found"
          ? "commercial.document_delivery_skipped_conv_missing"
          : "commercial.document_delivery_skipped_no_user_id";

  return {
    actionType,
    payload: {
      phase: "document_delivery",
      skip_reason: input.reason,
      detail: input.detail,
      payment_id: input.paymentId,
      order_id: input.orderId,
      quote_id: input.quoteId,
      document_id: input.documentId,
      document_type: input.documentType,
      document_number: input.documentNumber,
      conversation_id: input.conversationId ?? null,
      line_user_id: input.lineUserId ?? null,
    },
  };
}