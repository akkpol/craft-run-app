import { NextRequest, NextResponse } from "next/server";

import { logHumanAction } from "@/lib/action-log";
import { resolveAdminAccess } from "@/lib/admin-auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/admin/quotes/[id]/clone
 *
 * "Reorder" workflow — clone an existing quote for the same customer:
 * - new conversation (LINE customer can't reuse a COMPLETED/CANCELLED row per CLAUDE.md)
 * - new lead carrying the same product spec + billing snapshot
 * - new quote with the same totals, items, and wht_rate, status='sent',
 *   payment_status='unpaid', fresh public_token
 * - copies all quote_items
 *
 * Does NOT clone: jobs / commercial_orders / payments / commercial_documents /
 * design state — those belong to the original order. The clone starts as a
 * fresh sales cycle in the WAITING_QUOTE_APPROVAL state.
 */
export async function POST(
  _request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const { id: sourceQuoteId } = await props.params;

  const authClient = await createClient();
  const { data: authData } = await authClient.auth.getClaims();
  const access = resolveAdminAccess(authData?.claims);
  if (!access.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!access.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createAdminClient();

  // 1. Read source quote + lead + items.
  const { data: sourceQuote, error: sourceErr } = await supabase
    .from("quotes")
    .select(
      "id, subtotal, discount, vat, total, payment_terms, wht_rate, lead_id, leads(id, customer_id, conversation_id, product_type, width_mm, height_mm, qty, note_from_form, reference_info, design_brief, ai_image_prompt, requested_document_type, billing_entity_type, billing_branch_type, billing_branch_code, billing_name, tax_id, billing_address, fulfillment_mode, fulfillment_address_line1, fulfillment_address_line2, fulfillment_subdistrict, fulfillment_district, fulfillment_province, fulfillment_postal_code, due_date, product_label_snapshot, product_category_snapshot, product_category_label_snapshot)"
    )
    .eq("id", sourceQuoteId)
    .maybeSingle();

  if (sourceErr) {
    return NextResponse.json({ error: sourceErr.message }, { status: 500 });
  }
  if (!sourceQuote) {
    return NextResponse.json({ error: "Source quote not found" }, { status: 404 });
  }

  const sourceLead = Array.isArray(sourceQuote.leads)
    ? sourceQuote.leads[0]
    : sourceQuote.leads;
  if (!sourceLead) {
    return NextResponse.json(
      { error: "Source lead not found for this quote" },
      { status: 422 }
    );
  }
  if (!sourceLead.customer_id) {
    return NextResponse.json(
      {
        error: "SOURCE_LEAD_HAS_NO_CUSTOMER",
        detail: "Cannot clone a quote whose lead has no customer attached.",
      },
      { status: 422 }
    );
  }

  // Look up the source conversation's line_user_id — needed for the new
  // conversation. We never reuse the row itself (CLAUDE.md non-negotiable).
  let lineUserId: string | null = null;
  if (sourceLead.conversation_id) {
    const { data: sourceConv } = await supabase
      .from("conversations")
      .select("line_user_id")
      .eq("id", sourceLead.conversation_id)
      .maybeSingle();
    lineUserId = sourceConv?.line_user_id ?? null;
  }
  // Fallback to customers.line_user_id if conversation lookup didn't help.
  if (!lineUserId) {
    const { data: customer } = await supabase
      .from("customers")
      .select("line_user_id")
      .eq("id", sourceLead.customer_id)
      .maybeSingle();
    lineUserId = customer?.line_user_id ?? null;
  }
  if (!lineUserId) {
    return NextResponse.json(
      {
        error: "SOURCE_CUSTOMER_HAS_NO_LINE_ID",
        detail: "Customer has no line_user_id; cannot start a new conversation.",
      },
      { status: 422 }
    );
  }

  // 2. Create new conversation, lead, quote, items.
  const { data: newConv, error: convErr } = await supabase
    .from("conversations")
    .insert({
      line_user_id: lineUserId,
      state: "WAITING_QUOTE_APPROVAL",
    })
    .select("id")
    .single();
  if (convErr || !newConv) {
    return NextResponse.json(
      { error: convErr?.message || "Failed to create conversation" },
      { status: 500 }
    );
  }

  const { data: newLead, error: leadErr } = await supabase
    .from("leads")
    .insert({
      customer_id: sourceLead.customer_id,
      conversation_id: newConv.id,
      product_type: sourceLead.product_type,
      width_mm: sourceLead.width_mm,
      height_mm: sourceLead.height_mm,
      qty: sourceLead.qty,
      note_from_form: sourceLead.note_from_form,
      reference_info: sourceLead.reference_info,
      design_brief: sourceLead.design_brief,
      ai_image_prompt: sourceLead.ai_image_prompt,
      requested_document_type: sourceLead.requested_document_type,
      billing_entity_type: sourceLead.billing_entity_type,
      billing_branch_type: sourceLead.billing_branch_type,
      billing_branch_code: sourceLead.billing_branch_code,
      billing_name: sourceLead.billing_name,
      tax_id: sourceLead.tax_id,
      billing_address: sourceLead.billing_address,
      fulfillment_mode: sourceLead.fulfillment_mode,
      fulfillment_address_line1: sourceLead.fulfillment_address_line1,
      fulfillment_address_line2: sourceLead.fulfillment_address_line2,
      fulfillment_subdistrict: sourceLead.fulfillment_subdistrict,
      fulfillment_district: sourceLead.fulfillment_district,
      fulfillment_province: sourceLead.fulfillment_province,
      fulfillment_postal_code: sourceLead.fulfillment_postal_code,
      due_date: sourceLead.due_date,
      product_label_snapshot: sourceLead.product_label_snapshot,
      product_category_snapshot: sourceLead.product_category_snapshot,
      product_category_label_snapshot: sourceLead.product_category_label_snapshot,
      design_status: "not_started",
      ai_image_status: "not_requested",
    })
    .select("id")
    .single();
  if (leadErr || !newLead) {
    return NextResponse.json(
      { error: leadErr?.message || "Failed to create lead" },
      { status: 500 }
    );
  }

  const { data: newQuote, error: quoteErr } = await supabase
    .from("quotes")
    .insert({
      lead_id: newLead.id,
      subtotal: sourceQuote.subtotal,
      discount: sourceQuote.discount,
      vat: sourceQuote.vat,
      total: sourceQuote.total,
      payment_terms: sourceQuote.payment_terms,
      payment_status: "unpaid",
      status: "sent",
      wht_rate: sourceQuote.wht_rate,
      // public_token is auto-generated by the column default
    })
    .select("id, public_token")
    .single();
  if (quoteErr || !newQuote) {
    return NextResponse.json(
      { error: quoteErr?.message || "Failed to create quote" },
      { status: 500 }
    );
  }

  // Copy items.
  const { data: sourceItems } = await supabase
    .from("quote_items")
    .select("label, qty, unit_price")
    .eq("quote_id", sourceQuoteId);
  if (sourceItems && sourceItems.length > 0) {
    const itemsToInsert = sourceItems.map((row) => ({
      quote_id: newQuote.id,
      label: row.label,
      qty: row.qty,
      unit_price: row.unit_price,
    }));
    const { error: itemErr } = await supabase
      .from("quote_items")
      .insert(itemsToInsert);
    if (itemErr) {
      return NextResponse.json(
        { error: itemErr.message || "Failed to copy items" },
        { status: 500 }
      );
    }
  }

  await logHumanAction(supabase, {
    entityType: "quote",
    entityId: newQuote.id,
    actionType: "quote.cloned",
    actorId: access.email ?? undefined,
    actorLabel: access.email ?? "Admin",
    payload: {
      source_quote_id: sourceQuoteId,
      source_lead_id: sourceLead.id,
      new_lead_id: newLead.id,
      new_conversation_id: newConv.id,
      item_count: sourceItems?.length ?? 0,
      total: Number(sourceQuote.total ?? 0),
    },
  }).catch(() => null);

  return NextResponse.json({
    success: true,
    newQuoteId: newQuote.id,
    newQuoteToken: newQuote.public_token,
    newLeadId: newLead.id,
    newConversationId: newConv.id,
    itemCount: sourceItems?.length ?? 0,
  });
}
