import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { pushQuoteLink } from "@/lib/line";
import {
  toMM,
  calculatePrice,
  PRODUCT_TYPES,
  isPaymentTerm,
  isWorkflowState,
} from "@/lib/types";
import type { IntakeFormData, WorkflowState } from "@/lib/types";
import { getLeadOperationalDefaults } from "@/lib/quote-workflow";
import {
  canTransitionConversationState,
  isTerminalConversationState,
} from "@/lib/workflow-transitions";
import { logSystemAction } from "@/lib/action-log";

export async function POST(request: NextRequest) {
  let data: IntakeFormData;
  try {
    data = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Simple required-field validation
  const errors: string[] = [];
  if (!data.lineUserId) errors.push("lineUserId is required");
  if (!data.productType) errors.push("productType is required");
  if (!data.width || data.width <= 0) errors.push("width must be positive");
  if (!data.height || data.height <= 0) errors.push("height must be positive");
  if (!data.unit) errors.push("unit is required");
  if (!data.qty || data.qty <= 0) errors.push("qty must be positive");
  if (!data.phone) errors.push("phone is required");
  if (data.paymentTerms && !isPaymentTerm(data.paymentTerms)) {
    errors.push("paymentTerms is invalid");
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join(", ") }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Normalize units to mm
  const widthMm = toMM(data.width, data.unit);
  const heightMm = toMM(data.height, data.unit);
  const qty = data.qty;

  // 1. Upsert customer
  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .upsert(
      {
        line_user_id: data.lineUserId,
        display_name: data.displayName || "ลูกค้า",
        phone: data.phone,
      },
      { onConflict: "line_user_id" }
    )
    .select("id")
    .single();

  if (!customer) {
    return NextResponse.json(
      { error: `Failed to create customer${customerError ? `: ${customerError.message}` : ""}` },
      { status: 500 }
    );
  }

  // 2. Find or create conversation
  let conversationId: string;
  let conversationState: WorkflowState = "NEW_MESSAGE";
  const { data: existingConvRows, error: existingConvError } = await supabase
    .from("conversations")
    .select("id, state")
    .eq("line_user_id", data.lineUserId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (existingConvError) {
    return NextResponse.json(
      { error: `Failed to load conversation: ${existingConvError.message}` },
      { status: 500 }
    );
  }

  const existingConv = existingConvRows?.[0] ?? null;

  if (existingConv) {
    if (!isWorkflowState(existingConv.state)) {
      return NextResponse.json(
        { error: "Conversation has invalid workflow state" },
        { status: 500 }
      );
    }

    conversationId = existingConv.id;
    conversationState = existingConv.state;

    if (isTerminalConversationState(existingConv.state)) {
      return NextResponse.json(
        { error: `Conversation is already ${existingConv.state}` },
        { status: 409 }
      );
    }
  } else {
    const { data: newConv, error: newConvError } = await supabase
      .from("conversations")
      .insert({ line_user_id: data.lineUserId, state: "REQUIREMENTS_REVIEW" })
      .select("id")
      .single();

    if (!newConv?.id) {
      return NextResponse.json(
        {
          error: `Failed to create conversation${newConvError ? `: ${newConvError.message}` : ""}`,
        },
        { status: 500 }
      );
    }

    conversationId = newConv.id;
    conversationState = "REQUIREMENTS_REVIEW";
  }

  // 3. Update conversation state
  if (
    existingConv &&
    conversationState !== "REQUIREMENTS_REVIEW" &&
    !canTransitionConversationState(conversationState, "REQUIREMENTS_REVIEW")
  ) {
    return NextResponse.json(
      {
        error: `Cannot move conversation from ${conversationState} to REQUIREMENTS_REVIEW`,
      },
      { status: 409 }
    );
  }

  await supabase
    .from("conversations")
    .update({ state: "REQUIREMENTS_REVIEW" })
    .eq("id", conversationId);

  // 4. Create lead
  const needsReview =
    !data.productType || !data.dueDate || widthMm <= 0 || heightMm <= 0;
  const holdReason = needsReview
    ? "ยังมีข้อมูลไม่ครบสำหรับออกใบเสนอราคาอัตโนมัติ"
    : null;
  const leadDefaults = getLeadOperationalDefaults(data.fulfillmentMode);

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .insert({
      conversation_id: conversationId,
      customer_id: customer.id,
      product_type: data.productType,
      width_mm: widthMm,
      height_mm: heightMm,
      qty,
      due_date: data.dueDate || null,
      note_from_form: data.note || null,
      reference_info: data.referenceInfo || null,
      ai_image_prompt: data.aiImagePrompt || null,
      ai_image_status: data.aiImagePrompt ? "pending" : "not_requested",
      fulfillment_mode: leadDefaults.fulfillment_mode,
      design_assignment_mode: leadDefaults.design_assignment_mode,
      design_executor: leadDefaults.design_executor,
      design_status: leadDefaults.design_status,
      hold_reason: holdReason,
      status: needsReview ? "new" : "quoted",
    })
    .select("id")
    .single();

  if (!lead) {
    return NextResponse.json(
      { error: `Failed to create lead${leadError ? `: ${leadError.message}` : ""}` },
      { status: 500 }
    );
  }

  // 5. If data incomplete, park the conversation until the customer adds more info
  if (needsReview) {
    await supabase
      .from("conversations")
      .update({ state: "ON_HOLD_CUSTOMER_INPUT" })
      .eq("id", conversationId);

    await logSystemAction(supabase, {
      entityType: "lead",
      entityId: lead.id,
      actionType: "lead.created",
      serviceName: "intake",
      note: "Lead created — incomplete data, waiting for customer input",
      payload: { conversation_id: conversationId, state: "ON_HOLD_CUSTOMER_INPUT", needs_review: true },
    });

    return NextResponse.json({
      success: true,
      leadId: lead.id,
      needsReview: true,
      message: "Lead created — waiting for more customer input",
    });
  }

  // 6. Calculate price & create quote
  const subtotal = calculatePrice(data.productType, widthMm, heightMm, qty);
  const vat = Math.round(subtotal * 0.07 * 100) / 100;
  const total = subtotal + vat;
  const paymentTerms = data.paymentTerms || "prepaid";

  const productLabel =
    PRODUCT_TYPES.find((p) => p.value === data.productType)?.label ||
    data.productType;

  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .insert({
      lead_id: lead.id,
      subtotal,
      discount: 0,
      vat,
      total,
      status: "sent",
      payment_terms: paymentTerms,
      payment_status: paymentTerms === "credit" ? "not_required" : "unpaid",
    })
    .select("id, public_token")
    .single();

  if (!quote) {
    return NextResponse.json(
      { error: `Failed to create quote${quoteError ? `: ${quoteError.message}` : ""}` },
      { status: 500 }
    );
  }

  // 7. Create quote items
  await supabase.from("quote_items").insert({
    quote_id: quote.id,
    label: `${productLabel} (${(widthMm / 10).toFixed(1)}×${(heightMm / 10).toFixed(1)} ซม.) × ${qty}`,
    qty: 1,
    unit_price: subtotal,
  });

  // 8. Move the conversation into the customer approval stage
  await supabase
    .from("conversations")
    .update({ state: "WAITING_QUOTE_APPROVAL" })
    .eq("id", conversationId);

  await logSystemAction(supabase, {
    entityType: "lead",
    entityId: lead.id,
    actionType: "lead.created",
    serviceName: "intake",
    payload: { conversation_id: conversationId, product_type: data.productType },
  });
  await logSystemAction(supabase, {
    entityType: "quote",
    entityId: quote.id,
    actionType: "quote.created",
    serviceName: "intake",
    payload: { lead_id: lead.id, total, payment_terms: paymentTerms, to_state: "WAITING_QUOTE_APPROVAL" },
  });

  // 9. Send quote link to customer via LINE push
  try {
    const summary = `${productLabel} ${(widthMm / 10).toFixed(0)}×${(heightMm / 10).toFixed(0)} ซม. จำนวน ${qty} ชิ้น\nราคารวม VAT: ฿${total.toLocaleString()}`;
    await pushQuoteLink(data.lineUserId, quote.public_token, summary);
  } catch (error) {
    console.error("Failed to push quote link:", error);
    // Don't fail — quote is created, customer can still access via admin
  }

  return NextResponse.json({
    success: true,
    leadId: lead.id,
    quoteId: quote.id,
    quoteToken: quote.public_token,
    total,
  });
}
