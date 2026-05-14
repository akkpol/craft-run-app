import { NextRequest, NextResponse } from "next/server";

import { logHumanAction } from "@/lib/action-log";
import { buildCommercialPaymentConfirmFailureAudit } from "@/lib/commercial-audit";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  validatePaymentAmount,
  validatePaymentConfirm,
  validateReceiverEntityActive,
} from "@/lib/commercial-validation";

/**
 * POST /api/payments/confirm
 *
 * Confirms a PENDING payment and locks the payment receiver on the order.
 *
 * Core invariant enforced (Policy §7.2, §7.4):
 *   payment.receiver_entity_id === order.selected_receiver_entity_id
 *   → sets commercial_orders.payment_receiver_locked_at = now()
 *
 * After this call, no document can be issued against a different receiver.
 * Tax/document generation is intentionally blocked to a separate endpoint.
 */

type ConfirmPaymentBody = {
  paymentId?: string;
  payment_id?: string;
};

export async function POST(request: NextRequest) {
  let body: ConfirmPaymentBody;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const paymentId = body.paymentId ?? body.payment_id;

  if (!paymentId) {
    return NextResponse.json(
      { error: "paymentId is required" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // 1. Load the payment record.
  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .select("id, order_id, receiver_entity_id, status, amount")
    .eq("id", paymentId)
    .maybeSingle();

  if (paymentError) {
    return NextResponse.json(
      { error: paymentError.message || "Failed to read payment" },
      { status: 500 }
    );
  }

  if (!payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  const paymentAlreadyConfirmed = payment.status === "CONFIRMED";

  if (payment.status !== "PENDING" && !paymentAlreadyConfirmed) {
    return NextResponse.json(
      { error: `Payment is already in status ${payment.status}` },
      { status: 409 }
    );
  }

  // 2. Load the associated commercial order.
  const { data: order, error: orderError } = await supabase
    .from("commercial_orders")
    .select(
      "id, quote_id, selected_receiver_entity_id, payment_receiver_locked_at"
    )
    .eq("id", payment.order_id)
    .maybeSingle();

  if (orderError) {
    return NextResponse.json(
      { error: orderError.message || "Failed to read commercial order" },
      { status: 500 }
    );
  }

  if (!order) {
    return NextResponse.json(
      { error: "Commercial order not found" },
      { status: 404 }
    );
  }

  // 2b. Load quote payment record for amount validation — only on fresh confirmations.
  // Skipped for already-CONFIRMED idempotent retries (fail-open if absent).
  let paymentRecord: { amount_due: number; payment_terms: string } | null = null;
  if (!paymentAlreadyConfirmed) {
    const { data } = await supabase
      .from("quote_payment_records")
      .select("amount_due, payment_terms")
      .eq("quote_id", order.quote_id)
      .maybeSingle();
    paymentRecord = data ?? null;
  }

  // 3. Validate preconditions (policy §7.2).
  const confirmValidation = validatePaymentConfirm({
    paymentReceiverEntityId: payment.receiver_entity_id,
    selectedReceiverEntityId: order.selected_receiver_entity_id,
    paymentReceiverLockedAt: order.payment_receiver_locked_at,
  });

  if (!confirmValidation.ok) {
    const statusCode =
      confirmValidation.error === "PAYMENT_RECEIVER_LOCKED" ? 409 : 422;

    await logHumanAction(supabase, {
      entityType: "quote",
      entityId: order.quote_id,
      actorLabel: "Admin",
      ...buildCommercialPaymentConfirmFailureAudit({
        error: confirmValidation.error,
        detail: confirmValidation.detail,
        paymentId,
        orderId: order.id,
        quoteId: order.quote_id,
        receiverEntityId: payment.receiver_entity_id,
        selectedReceiverEntityId: order.selected_receiver_entity_id,
        paymentReceiverLockedAt: order.payment_receiver_locked_at,
      }),
    }).catch(() => null);

    return NextResponse.json(
      {
        error: confirmValidation.error,
        detail: confirmValidation.detail,
      },
      { status: statusCode }
    );
  }

  // 3b. Validate payment amount against quote total (policy: FIX-1).
  // Only runs on new confirmations (not idempotent retries of already-CONFIRMED payments).
  // Skipped when no payment record exists (backward-compatible for older quotes).
  if (!paymentAlreadyConfirmed && paymentRecord) {
    const amountValidation = validatePaymentAmount({
      paymentTerms: paymentRecord.payment_terms as "prepaid" | "deposit" | "credit",
      paymentAmount: Number(payment.amount),
      amountDue: Number(paymentRecord.amount_due),
    });

    if (!amountValidation.ok) {
      await logHumanAction(supabase, {
        entityType: "quote",
        entityId: order.quote_id,
        actorLabel: "Admin",
        ...buildCommercialPaymentConfirmFailureAudit({
          error: amountValidation.error,
          detail: amountValidation.detail,
          paymentId,
          orderId: order.id,
          quoteId: order.quote_id,
          receiverEntityId: payment.receiver_entity_id,
          selectedReceiverEntityId: order.selected_receiver_entity_id,
          paymentReceiverLockedAt: order.payment_receiver_locked_at,
        }),
      }).catch(() => null);

      return NextResponse.json(
        {
          error: amountValidation.error,
          detail: amountValidation.detail,
        },
        { status: 422 }
      );
    }
  }

  // 4. Verify receiver entity is still active.
  const { data: receiverEntity, error: entityError } = await supabase
    .from("commercial_entities")
    .select("id, active")
    .eq("id", payment.receiver_entity_id)
    .maybeSingle();

  if (entityError) {
    return NextResponse.json(
      { error: entityError.message || "Failed to read receiver entity" },
      { status: 500 }
    );
  }

  if (!receiverEntity) {
    return NextResponse.json(
      { error: "Receiver entity not found" },
      { status: 404 }
    );
  }

  const entityValidation = validateReceiverEntityActive(receiverEntity);
  if (!entityValidation.ok) {
    await logHumanAction(supabase, {
      entityType: "quote",
      entityId: order.quote_id,
      actorLabel: "Admin",
      ...buildCommercialPaymentConfirmFailureAudit({
        error: entityValidation.error,
        detail: entityValidation.detail,
        paymentId,
        orderId: order.id,
        quoteId: order.quote_id,
        receiverEntityId: payment.receiver_entity_id,
        selectedReceiverEntityId: order.selected_receiver_entity_id,
        paymentReceiverLockedAt: order.payment_receiver_locked_at,
      }),
    }).catch(() => null);

    return NextResponse.json(
      {
        error: entityValidation.error,
        detail: entityValidation.detail,
      },
      { status: 422 }
    );
  }

  const now = new Date().toISOString();

  // 5. Mark payment as CONFIRMED unless a previous attempt already did so.
  if (!paymentAlreadyConfirmed) {
    const { error: paymentUpdateError } = await supabase
      .from("payments")
      .update({ status: "CONFIRMED", paid_at: now, updated_at: now })
      .eq("id", paymentId);

    if (paymentUpdateError) {
      return NextResponse.json(
        {
          error: paymentUpdateError.message || "Failed to confirm payment",
        },
        { status: 500 }
      );
    }
  }

  // 6. Lock the receiver on the order (policy §7.4). If it is already
  // locked to the same selected receiver, later payment confirmations are
  // allowed and must not overwrite the immutable lock timestamp.
  const paymentReceiverLockedAt = order.payment_receiver_locked_at || now;
  if (!order.payment_receiver_locked_at) {
    const { error: orderLockError } = await supabase
      .from("commercial_orders")
      .update({
        payment_receiver_locked_at: now,
        updated_at: now,
      })
      .eq("id", order.id);

    if (orderLockError) {
      // Payment is confirmed but lock failed — audit and surface as 500 so
      // the caller can retry. The payment status update is not rolled back
      // because Supabase does not expose multi-statement transactions here;
      // the receiver lock will be re-applied on retry since payment is now
      // CONFIRMED and the order lock check is independent.
      console.error(
        "[payments/confirm] Failed to lock receiver after payment confirmation:",
        orderLockError.message
      );
      await logHumanAction(supabase, {
        entityType: "quote",
        entityId: order.quote_id,
        actorLabel: "Admin",
        ...buildCommercialPaymentConfirmFailureAudit({
          error: "RECEIVER_LOCK_FAILED",
          detail: orderLockError.message || "Failed to lock payment receiver. Retry is safe.",
          paymentId,
          orderId: order.id,
          quoteId: order.quote_id,
          receiverEntityId: payment.receiver_entity_id,
          selectedReceiverEntityId: order.selected_receiver_entity_id,
          paymentReceiverLockedAt: order.payment_receiver_locked_at,
        }),
      }).catch(() => null);

      return NextResponse.json(
        { error: "Failed to lock payment receiver. Retry is safe." },
        { status: 500 }
      );
    }
  }

  // 7. Emit audit event (non-fatal).
  await logHumanAction(supabase, {
    entityType: "quote",
    entityId: order.quote_id,
    actionType: "commercial.payment_confirmed",
    actorLabel: "Admin",
    payload: {
      payment_id: paymentId,
      order_id: order.id,
      receiver_entity_id: payment.receiver_entity_id,
      amount: payment.amount,
      payment_receiver_locked_at: paymentReceiverLockedAt,
    },
  });

  return NextResponse.json({
    success: true,
    paymentId,
    orderId: order.id,
    receiverEntityId: payment.receiver_entity_id,
    paymentReceiverLockedAt,
  });
}
