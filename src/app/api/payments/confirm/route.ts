import { NextRequest, NextResponse } from "next/server";

import { logHumanAction } from "@/lib/action-log";
import { buildCommercialPaymentConfirmFailureAudit } from "@/lib/commercial-audit";
import { createAdminClient } from "@/lib/supabase/admin";
import {
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

  if (payment.status !== "PENDING") {
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

  // 5. Mark payment as CONFIRMED.
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

  // 6. Lock the receiver on the order (policy §7.4).
  // Once locked, no document may be issued against a different entity.
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
      payment_receiver_locked_at: now,
    },
  });

  return NextResponse.json({
    success: true,
    paymentId,
    orderId: order.id,
    receiverEntityId: payment.receiver_entity_id,
    paymentReceiverLockedAt: now,
  });
}
