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
  | "RECEIVER_ENTITY_INACTIVE"
  | "PAYMENT_AMOUNT_UNDERPAID"
  | "PAYMENT_AMOUNT_OVERPAID";

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

export interface PaymentAmountInput {
  /** 'prepaid' | 'deposit' | 'credit' — from quote_payment_records.payment_terms */
  paymentTerms: "prepaid" | "deposit" | "credit";
  /** The amount on the payment record being confirmed. */
  paymentAmount: number;
  /** The total amount due from quote_payment_records.amount_due. */
  amountDue: number;
}

/**
 * Validate that a payment amount is consistent with the order's payment terms.
 *
 * Rules (Business Policy):
 * - credit: no pre-payment gate — any amount accepted.
 * - prepaid: payment amount must equal amount_due exactly (full payment required).
 * - deposit: payment amount must be > 0 and <= amount_due (partial ok, overpay not).
 */
export function validatePaymentAmount(
  input: PaymentAmountInput
): ValidationResult {
  const { paymentTerms, paymentAmount, amountDue } = input;

  if (paymentTerms === "credit") {
    // Credit orders have no upfront payment gate.
    return { ok: true, value: undefined };
  }

  if (paymentTerms === "prepaid") {
    if (paymentAmount < amountDue) {
      return {
        ok: false,
        error: "PAYMENT_AMOUNT_UNDERPAID",
        detail: `Prepaid order requires full payment of ${amountDue}. Payment amount ${paymentAmount} is insufficient.`,
      };
    }
    if (paymentAmount > amountDue) {
      return {
        ok: false,
        error: "PAYMENT_AMOUNT_OVERPAID",
        detail: `Payment amount ${paymentAmount} exceeds the amount due ${amountDue}.`,
      };
    }
    return { ok: true, value: undefined };
  }

  // deposit: partial payment is acceptable; overpay is a data-entry error.
  if (paymentTerms === "deposit") {
    if (paymentAmount <= 0) {
      return {
        ok: false,
        error: "PAYMENT_AMOUNT_UNDERPAID",
        detail: "Deposit payment amount must be greater than zero.",
      };
    }
    if (paymentAmount > amountDue) {
      return {
        ok: false,
        error: "PAYMENT_AMOUNT_OVERPAID",
        detail: `Payment amount ${paymentAmount} exceeds the amount due ${amountDue}.`,
      };
    }
    return { ok: true, value: undefined };
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
