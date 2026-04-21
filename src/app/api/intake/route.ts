import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { pushQuoteLink, verifyLiffIdToken } from "@/lib/line";
import {
  toMM,
  calculatePrice,
  PRODUCT_TYPES,
  isPaymentTerm,
} from "@/lib/types";
import type { IntakeFormData, WorkflowState } from "@/lib/types";
import { getLeadOperationalDefaults } from "@/lib/quote-workflow";
import {
  getReusableConversationState,
} from "@/lib/workflow-transitions";
import {
  getConversationsToCancelForFreshRestart,
  getLeadsToSupersedeForFreshRestart,
  type FreshRestartConversationCandidate,
  type FreshRestartLeadCandidate,
} from "@/lib/customer-restart";
import { logSystemAction } from "@/lib/action-log";

export async function POST(request: NextRequest) {
  let data: IntakeFormData;
  try {
    data = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const providedLineUserId = data.lineUserId?.trim() || "";
  const providedDisplayName = data.displayName?.trim() || "";
  const providedLiffIdToken = data.liffIdToken?.trim() || "";

  // Simple required-field validation
  const errors: string[] = [];
  if (!data.productType) errors.push("productType is required");
  if (!data.width || data.width <= 0) errors.push("width must be positive");
  if (!data.height || data.height <= 0) errors.push("height must be positive");
  if (!data.unit) errors.push("unit is required");
  if (!data.qty || data.qty <= 0) errors.push("qty must be positive");
  if (!data.phone) errors.push("phone is required");
  if (data.paymentTerms && !isPaymentTerm(data.paymentTerms)) {
    errors.push("paymentTerms is invalid");
  }
  if (data.intakeMode && !["resume", "fresh"].includes(data.intakeMode)) {
    errors.push("intakeMode is invalid");
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join(", ") }, { status: 400 });
  }

  let intakeIdentity: { userId: string; displayName: string | null };
  if (providedLiffIdToken) {
    try {
      intakeIdentity = await verifyLiffIdToken(providedLiffIdToken);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to verify LIFF identity";
      return NextResponse.json(
        { error: `Unable to verify LINE identity: ${message}` },
        { status: 400 }
      );
    }
  } else if (process.env.NODE_ENV !== "production" && providedLineUserId) {
    intakeIdentity = {
      userId: providedLineUserId,
      displayName: providedDisplayName || "ลูกค้า",
    };
  } else {
    return NextResponse.json(
      {
        error:
          "LINE identity verification is required. Please reopen the form from LINE.",
      },
      { status: 400 }
    );
  }

  const resolvedLineUserId = intakeIdentity.userId;
  const resolvedDisplayName =
    intakeIdentity.displayName?.trim() || providedDisplayName || "ลูกค้า";

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
        line_user_id: resolvedLineUserId,
        display_name: resolvedDisplayName,
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
    .eq("line_user_id", resolvedLineUserId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (existingConvError) {
    return NextResponse.json(
      { error: `Failed to load conversation: ${existingConvError.message}` },
      { status: 500 }
    );
  }

  const existingConv = existingConvRows?.[0] ?? null;
  const forceFreshConversation = data.intakeMode === "fresh";
  const reusableConversationState = getReusableConversationState(
    existingConv?.state,
    "REQUIREMENTS_REVIEW"
  );
  const shouldReuseConversation = Boolean(
    !forceFreshConversation && existingConv && reusableConversationState
  );

  if (existingConv && reusableConversationState && !forceFreshConversation) {
    conversationId = existingConv.id;
    conversationState = reusableConversationState;

    if (reusableConversationState !== existingConv.state) {
      const { error: normalizeConversationError } = await supabase
        .from("conversations")
        .update({ state: reusableConversationState })
        .eq("id", conversationId);

      if (normalizeConversationError) {
        return NextResponse.json(
          {
            error: `Failed to normalize conversation state: ${normalizeConversationError.message}`,
          },
          { status: 500 }
        );
      }
    }
  } else {
    const { data: newConv, error: newConvError } = await supabase
      .from("conversations")
      .insert({ line_user_id: resolvedLineUserId, state: "REQUIREMENTS_REVIEW" })
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
  if (shouldReuseConversation && conversationState !== "REQUIREMENTS_REVIEW") {
    const { error: updateConversationError } = await supabase
      .from("conversations")
      .update({ state: "REQUIREMENTS_REVIEW" })
      .eq("id", conversationId);

    if (updateConversationError) {
      return NextResponse.json(
        {
          error: `Failed to update conversation: ${updateConversationError.message}`,
        },
        { status: 500 }
      );
    }
  }

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

  if (forceFreshConversation) {
    const { data: priorConversationRows, error: priorConversationError } =
      await supabase
        .from("conversations")
        .select("id, state")
        .eq("line_user_id", resolvedLineUserId)
        .neq("id", conversationId)
        .order("created_at", { ascending: false })
        .limit(10);

    if (priorConversationError) {
      return NextResponse.json(
        {
          error: `Failed to load prior conversations: ${priorConversationError.message}`,
        },
        { status: 500 }
      );
    }

    const { data: priorLeadRows, error: priorLeadError } = await supabase
      .from("leads")
      .select(
        "id, conversation_id, status, superseded_at, quotes(id, status, jobs(id, status)), conversations!inner(line_user_id)"
      )
      .eq("conversations.line_user_id", resolvedLineUserId)
      .neq("id", lead.id)
      .is("superseded_at", null)
      .order("created_at", { ascending: false })
      .limit(10);

    if (priorLeadError) {
      return NextResponse.json(
        { error: `Failed to load prior leads: ${priorLeadError.message}` },
        { status: 500 }
      );
    }

    const conversationsToCancel = getConversationsToCancelForFreshRestart(
      (priorConversationRows || []) as FreshRestartConversationCandidate[],
      conversationId
    );
    const leadsToSupersede = getLeadsToSupersedeForFreshRestart(
      (priorLeadRows || []) as FreshRestartLeadCandidate[],
      lead.id
    );

    if (leadsToSupersede.length > 0 || conversationsToCancel.length > 0) {
      const supersededAt = new Date().toISOString();
      const supersedeNote = `Superseded by fresh intake lead ${lead.id}`;

      for (const priorLead of leadsToSupersede) {
        const { error: supersedeLeadError } = await supabase
          .from("leads")
          .update({
            status: "superseded",
            superseded_by_lead_id: lead.id,
            superseded_at: supersededAt,
            supersede_reason: "Customer started a fresh request in LINE",
          })
          .eq("id", priorLead.id);

        if (supersedeLeadError) {
          return NextResponse.json(
            { error: `Failed to supersede previous lead: ${supersedeLeadError.message}` },
            { status: 500 }
          );
        }

        await logSystemAction(supabase, {
          entityType: "lead",
          entityId: priorLead.id,
          actionType: "lead.superseded",
          serviceName: "intake",
          note: supersedeNote,
          payload: {
            superseded_by_lead_id: lead.id,
            replacement_conversation_id: conversationId,
            replacement_mode: "fresh",
          },
        });
      }

      for (const priorConversation of conversationsToCancel) {
        const { error: cancelConversationError } = await supabase
          .from("conversations")
          .update({ state: "CANCELLED" })
          .eq("id", priorConversation.id);

        if (cancelConversationError) {
          return NextResponse.json(
            {
              error: `Failed to supersede previous conversation: ${cancelConversationError.message}`,
            },
            { status: 500 }
          );
        }

        await logSystemAction(supabase, {
          entityType: "conversation",
          entityId: priorConversation.id,
          actionType: "conversation.state_changed",
          serviceName: "intake",
          note: supersedeNote,
          payload: {
            from: priorConversation.fromState,
            to: "CANCELLED",
            replacement_lead_id: lead.id,
            replacement_mode: "fresh",
          },
        });
      }
    }
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
      payload: {
        conversation_id: conversationId,
        state: "ON_HOLD_CUSTOMER_INPUT",
        needs_review: true,
        intake_mode: data.intakeMode ?? "resume",
      },
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
    payload: {
      conversation_id: conversationId,
      product_type: data.productType,
      intake_mode: data.intakeMode ?? "resume",
    },
  });
  await logSystemAction(supabase, {
    entityType: "quote",
    entityId: quote.id,
    actionType: "quote.created",
    serviceName: "intake",
    payload: {
      lead_id: lead.id,
      total,
      payment_terms: paymentTerms,
      to_state: "WAITING_QUOTE_APPROVAL",
      intake_mode: data.intakeMode ?? "resume",
    },
  });

  // 9. Send quote link to customer via LINE push
  try {
    const summary = `${productLabel} ${(widthMm / 10).toFixed(0)}×${(heightMm / 10).toFixed(0)} ซม. จำนวน ${qty} ชิ้น\nราคารวม VAT: ฿${total.toLocaleString()}`;
    await pushQuoteLink(resolvedLineUserId, quote.public_token, summary);
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
