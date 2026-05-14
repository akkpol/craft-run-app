import { NextRequest, NextResponse } from "next/server";

import { logHumanAction } from "@/lib/action-log";
import { createAdminClient } from "@/lib/supabase/admin";
import { firstRow } from "@/lib/utils";

type SelectReceiverBody = {
  orderId?: string;
  quoteId?: string;
  receiverEntityId?: string;
  order_id?: string;
  quote_id?: string;
  receiver_entity_id?: string;
};

type CommercialOrderRow = {
  id: string;
  quote_id: string;
  selected_receiver_entity_id: string | null;
  payment_receiver_locked_at: string | null;
};

type QuoteOrderAnchorRow = {
  id: string;
  lead_id: string;
  leads?: { customer_id: string | null } | Array<{ customer_id: string | null }> | null;
};

export async function POST(request: NextRequest) {
  let body: SelectReceiverBody;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const requestedOrderId = body.orderId || body.order_id;
  const quoteId = body.quoteId || body.quote_id;
  const receiverEntityId = body.receiverEntityId || body.receiver_entity_id;

  if ((!requestedOrderId && !quoteId) || !receiverEntityId) {
    return NextResponse.json(
      { error: "orderId or quoteId, and receiverEntityId are required" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  let order: CommercialOrderRow | null = null;
  let orderError: { message?: string } | null = null;

  if (requestedOrderId) {
    const result = await supabase
      .from("commercial_orders")
      .select("id, quote_id, selected_receiver_entity_id, payment_receiver_locked_at")
      .eq("id", requestedOrderId)
      .maybeSingle();
    order = result.data as CommercialOrderRow | null;
    orderError = result.error;
  }

  if (!order && quoteId) {
    const result = await supabase
      .from("commercial_orders")
      .select("id, quote_id, selected_receiver_entity_id, payment_receiver_locked_at")
      .eq("quote_id", quoteId)
      .maybeSingle();
    order = result.data as CommercialOrderRow | null;
    orderError = result.error;
  }

  if (orderError) {
    return NextResponse.json(
      { error: orderError.message || "Failed to read commercial order" },
      { status: 500 }
    );
  }

  if (!order && requestedOrderId && !quoteId) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (!order && quoteId) {
    const { data: quote, error: quoteError } = await supabase
      .from("quotes")
      .select("id, lead_id, leads(customer_id)")
      .eq("id", quoteId)
      .maybeSingle();

    if (quoteError) {
      return NextResponse.json(
        { error: quoteError.message || "Failed to read quote" },
        { status: 500 }
      );
    }

    const quoteRow = quote as QuoteOrderAnchorRow | null;
    const lead = firstRow(quoteRow?.leads);

    if (!quoteRow || !lead?.customer_id) {
      return NextResponse.json(
        { error: "Quote cannot create commercial order anchor" },
        { status: 404 }
      );
    }

    const now = new Date().toISOString();
    const { data: insertedOrder, error: insertError } = await supabase
      .from("commercial_orders")
      .insert({
        quote_id: quoteRow.id,
        lead_id: quoteRow.lead_id,
        customer_id: lead.customer_id,
        updated_at: now,
      })
      .select("id, quote_id, selected_receiver_entity_id, payment_receiver_locked_at")
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message || "Failed to create commercial order anchor" },
        { status: 500 }
      );
    }

    order = insertedOrder as CommercialOrderRow;
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
    .eq("order_id", order.id)
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

  let customerTaxProfileId: string | null = null;
  const { data: orderWithProfile } = await supabase
    .from("commercial_orders")
    .select("customer_tax_profile_id, customer_id, quote_id")
    .eq("id", order.id)
    .maybeSingle();

  if (!orderWithProfile?.customer_tax_profile_id && orderWithProfile?.customer_id) {
    const { data: leadForProfile } = await supabase
      .from("quotes")
      .select(
        "leads(requested_document_type, billing_name, tax_id, billing_address, billing_branch_type, billing_branch_code)"
      )
      .eq("id", orderWithProfile.quote_id)
      .maybeSingle();
    const leadRow = Array.isArray(leadForProfile?.leads)
      ? leadForProfile?.leads[0]
      : leadForProfile?.leads;

    if (
      leadRow?.requested_document_type === "tax_invoice" &&
      leadRow?.billing_name &&
      leadRow?.billing_address
    ) {
      const { data: insertedProfile, error: profileInsertError } = await supabase
        .from("customer_tax_profiles")
        .insert({
          customer_id: orderWithProfile.customer_id,
          legal_name: leadRow.billing_name,
          tax_id: leadRow.tax_id || null,
          address: leadRow.billing_address,
          branch_type:
            leadRow.billing_branch_type === "branch" ? "BRANCH" : "HEAD_OFFICE",
          branch_code: leadRow.billing_branch_code || null,
        })
        .select("id")
        .single();

      if (profileInsertError) {
        console.error(
          "[select-receiver] Failed to create customer tax profile:",
          profileInsertError.message
        );
      } else if (insertedProfile) {
        customerTaxProfileId = insertedProfile.id;
      }
    }
  }

  const updatePayload: Record<string, unknown> = {
    selected_receiver_entity_id: receiverEntityId,
    updated_at: now,
  };
  if (customerTaxProfileId) {
    updatePayload.customer_tax_profile_id = customerTaxProfileId;
  }

  const { error: updateError } = await supabase
    .from("commercial_orders")
    .update(updatePayload)
    .eq("id", order.id);

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
      order_id: order.id,
      receiver_entity_id: receiverEntityId,
      previous_receiver_entity_id: order.selected_receiver_entity_id || null,
      customer_tax_profile_id: customerTaxProfileId,
    },
  });

  return NextResponse.json({
    success: true,
    orderId: order.id,
    receiverEntityId,
    customerTaxProfileId,
  });
}
