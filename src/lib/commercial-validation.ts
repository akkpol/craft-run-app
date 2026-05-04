/**
 * commercial-validation.ts
 *
 * Pure validation helpers for Commercial Document Policy v1.
 *
 * Core invariant: payment receiver entity === document issuer entity.
 * No I/O here — all functions take plain data and return typed results.
 *
 * Policy reference: docs/COMMERCIAL_DOCUMENT_POLICY_V1.md
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type CommercialEntityRole =
  | "MAIN_COMPANY"
  | "SUB_COMPANY"
  | "PERSONAL_ACCOUNT";

export interface ReceiverEntitySnapshot {
  id: string;
  role: CommercialEntityRole;
  isVatRegistered: boolean;
  active: boolean;
}

export interface PaymentConfirmInput {
  /** Entity the payment actually entered (from payment record). */
  paymentReceiverEntityId: string;
  /** Entity pre-selected by admin before payment was taken. */
  selectedReceiverEntityId: string | null;
  /** ISO timestamp — truthy means already locked from a previous confirmation. */
  paymentReceiverLockedAt: string | null;
}

export type ValidationErrorCode =
  | "PAYMENT_RECEIVER_LOCKED"
  | "PAYMENT_RECEIVER_NOT_SELECTED"
  | "PAYMENT_RECEIVER_MISMATCH"
  | "RECEIVER_ENTITY_INACTIVE";

export type ValidationResult<T = void> =
  | { ok: true; value: T }
  | { ok: false; error: ValidationErrorCode; detail: string };

// ── Guards ────────────────────────────────────────────────────────────────────

/**
 * Validate payment confirmation preconditions.
 *
 * Rules (Policy §7.2):
 * 1. If `payment_receiver_locked_at` is already set → reject (idempotency guard).
 * 2. A receiver must have been selected before confirmation.
 * 3. The receiver entity on the payment record must match the selected entity.
 */
export function validatePaymentConfirm(
  input: PaymentConfirmInput
): ValidationResult {
  if (input.paymentReceiverLockedAt) {
    return {
      ok: false,
      error: "PAYMENT_RECEIVER_LOCKED",
      detail: "Payment receiver is already locked for this order.",
    };
  }

  if (!input.selectedReceiverEntityId) {
    return {
      ok: false,
      error: "PAYMENT_RECEIVER_NOT_SELECTED",
      detail: "A receiver entity must be selected before confirming payment.",
    };
  }

  if (input.paymentReceiverEntityId !== input.selectedReceiverEntityId) {
    return {
      ok: false,
      error: "PAYMENT_RECEIVER_MISMATCH",
      detail: `Payment receiver (${input.paymentReceiverEntityId}) does not match selected receiver (${input.selectedReceiverEntityId}).`,
    };
  }

  return { ok: true, value: undefined };
}

/**
 * Validate that a receiver entity is eligible to receive payment.
 *
 * Rules (Policy §3.2):
 * - Entity must be active.
 */
export function validateReceiverEntityActive(
  entity: Pick<ReceiverEntitySnapshot, "id" | "active">
): ValidationResult {
  if (!entity.active) {
    return {
      ok: false,
      error: "RECEIVER_ENTITY_INACTIVE",
      detail: `Receiver entity ${entity.id} is inactive and cannot receive payment.`,
    };
  }
  return { ok: true, value: undefined };
}

/**
 * Determine which document types are allowed after payment is confirmed.
 *
 * Rules (Policy §7.3, §3.2):
 * - VAT-registered entity → can issue RECEIPT or TAX_INVOICE_RECEIPT.
 * - Non-VAT entity → RECEIPT only.
 * - PERSONAL_ACCOUNT → RECEIPT only (never a company tax invoice).
 */
export function allowedDocumentTypesAfterPayment(
  receiver: ReceiverEntitySnapshot,
  customerRequestsTaxInvoice: boolean
): string[] {
  if (
    receiver.isVatRegistered &&
    receiver.role !== "PERSONAL_ACCOUNT" &&
    customerRequestsTaxInvoice
  ) {
    return ["TAX_INVOICE_RECEIPT"];
  }
  return ["RECEIPT"];
}
