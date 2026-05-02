import { NextRequest, NextResponse } from "next/server";

import { logHumanAction } from "@/lib/action-log";
import { createAdminClient } from "@/lib/supabase/admin";

type SelectReceiverBody = {
  orderId?: string;
  receiverEntityId?: string;
  order_id?: string;
  receiver_entity_id?: string;
};

export async function POST(request: NextRequest) {
  let body: SelectReceiverBody;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const orderId = body.orderId || body.order_id;
  const receiverEntityId = body.receiverEntityId || body.receiver_entity_id;

  if (!orderId || !receiverEntityId) {
    return NextResponse.json(
      { error: "orderId and receiverEntityId are required" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  const { data: order, error: orderError } = await supabase
    .from("commercial_orders")
    .select("id, quote_id, selected_receiver_entity_id, payment_receiver_locked_at")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError) {
    return NextResponse.json(
      { error: orderError.message || "Failed to read commercial order" },
      { status: 500 }
    );
  }

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (order.payment_receiver_locked_at) {
    return NextResponse.json(
      { error: "PAYMENT_RECEIVER_LOCKED" },
      { status: 409 }
    );
  }

  const { data: receiver, error: receiverError } = await supabase
    .from("commercial_entities")
    .select("id, active")
    .eq("id", receiverEntityId)
    .maybeSingle();

  if (receiverError) {
    return NextResponse.json(
      { error: receiverError.message || "Failed to read receiver entity" },
      { status: 500 }
    );
  }

  if (!receiver) {
    return NextResponse.json({ error: "Receiver entity not found" }, { status: 404 });
  }

  if (!receiver.active) {
    return NextResponse.json(
      { error: "Receiver entity is inactive" },
      { status: 400 }
    );
  }

  const { data: confirmedPayment, error: paymentError } = await supabase
    .from("payments")
    .select("id")
    .eq("order_id", orderId)
    .eq("status", "CONFIRMED")
    .limit(1)
    .maybeSingle();

  if (paymentError) {
    return NextResponse.json(
      { error: paymentError.message || "Failed to verify payment confirmation" },
      { status: 500 }
    );
  }

  if (confirmedPayment) {
    return NextResponse.json(
      { error: "PAYMENT_ALREADY_CONFIRMED" },
      { status: 409 }
    );
  }

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("commercial_orders")
    .update({
      selected_receiver_entity_id: receiverEntityId,
      updated_at: now,
    })
    .eq("id", orderId);

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message || "Failed to update receiver entity" },
      { status: 500 }
    );
  }

  await logHumanAction(supabase, {
    entityType: "quote",
    entityId: order.quote_id,
    actionType: "commercial.receiver_selected",
    actorLabel: "Admin",
    payload: {
      order_id: orderId,
      receiver_entity_id: receiverEntityId,
      previous_receiver_entity_id: order.selected_receiver_entity_id || null,
    },
  });

  return NextResponse.json({
    success: true,
    orderId,
    receiverEntityId,
  });
}
