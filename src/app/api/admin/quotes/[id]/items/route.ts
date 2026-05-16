import { NextRequest, NextResponse } from "next/server";

import { logHumanAction } from "@/lib/action-log";
import { resolveAdminAccess } from "@/lib/admin-auth";
import { getRuntimeAppConfig } from "@/lib/app-settings";
import { resolvePaymentProfileFromConfig } from "@/lib/payment-routing";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type AddItemBody = {
  label?: string;
  qty?: number | string;
  unitPrice?: number | string;
  discount?: number | string;
  note?: string;
};

/**
 * Threshold + VAT calculation reproduced inline. Keeps this endpoint
 * compatible with the same totals layout that /api/intake writes.
 *   subtotal = sum(line_total)
 *   vat      = round(subtotal × 0.07, 2)   (Thai VAT 7%)
 *   total    = subtotal + vat
 *
 * Discount is intentionally NOT mutated here — preserves whatever the
 * upstream quote already had (currently always 0 per intake flow, but
 * leaving room for a future discount feature without overwriting it).
 */
const VAT_RATE = 0.07;

function getBillingEntityType(leads: unknown) {
  const lead = Array.isArray(leads) ? leads[0] : leads;
  if (!lead || typeof lead !== "object") {
    return null;
  }

  const value = (lead as { billing_entity_type?: unknown }).billing_entity_type;
  return typeof value === "string" ? value : null;
}

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;

  let body: AddItemBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const label = (body.label || "").trim();
  if (!label) {
    return NextResponse.json(
      { error: "label is required" },
      { status: 400 }
    );
  }
  if (label.length > 200) {
    return NextResponse.json(
      { error: "label too long (max 200 chars)" },
      { status: 400 }
    );
  }

  const qty = Number(body.qty ?? 0);
  if (!Number.isFinite(qty) || qty <= 0) {
    return NextResponse.json(
      { error: "qty must be a positive number" },
      { status: 400 }
    );
  }

  const unitPrice = Number(body.unitPrice ?? 0);
  if (!Number.isFinite(unitPrice) || unitPrice < 0) {
    return NextResponse.json(
      { error: "unitPrice must be a non-negative number" },
      { status: 400 }
    );
  }

  const discount = Number(body.discount ?? 0);
  if (!Number.isFinite(discount) || discount < 0) {
    return NextResponse.json(
      { error: "discount must be a non-negative number" },
      { status: 400 }
    );
  }
  if (discount > qty * unitPrice) {
    return NextResponse.json(
      {
        error: "DISCOUNT_EXCEEDS_LINE",
        detail: "Per-line discount cannot exceed qty × unitPrice.",
      },
      { status: 422 }
    );
  }

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
  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .select("id, status, discount, payment_terms, payment_status, leads(billing_entity_type)")
    .eq("id", id)
    .maybeSingle();

  if (quoteError) {
    return NextResponse.json({ error: quoteError.message }, { status: 500 });
  }
  if (!quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  // Gate: only allow item edits while the quote is editable.
  // Once approved + payment captured, the totals influence issued documents
  // and the receiver lock — mutating them would corrupt audit trail.
  if (quote.status !== "draft" && quote.status !== "sent") {
    return NextResponse.json(
      {
        error: "QUOTE_NOT_EDITABLE",
        detail: `Cannot add items while quote status is ${quote.status}. Items can only be added on draft or sent quotes.`,
      },
      { status: 409 }
    );
  }

  if (
    quote.payment_status === "paid" ||
    quote.payment_status === "partial"
  ) {
    return NextResponse.json(
      {
        error: "QUOTE_NOT_EDITABLE",
        detail: "Cannot add items after payment has been captured.",
      },
      { status: 409 }
    );
  }

  // Insert the line item.
  const { data: insertedItem, error: insertError } = await supabase
    .from("quote_items")
    .insert({
      quote_id: id,
      label,
      qty,
      unit_price: unitPrice,
      discount,
    })
    .select("id, label, qty, unit_price, discount, line_total")
    .single();

  if (insertError || !insertedItem) {
    return NextResponse.json(
      { error: insertError?.message || "Failed to insert item" },
      { status: 500 }
    );
  }

  // Recompute totals from the canonical sum of quote_items.line_total.
  const { data: itemRows, error: sumError } = await supabase
    .from("quote_items")
    .select("line_total")
    .eq("quote_id", id);

  if (sumError) {
    return NextResponse.json(
      { error: sumError.message || "Failed to recompute totals" },
      { status: 500 }
    );
  }

  const subtotal = (itemRows ?? []).reduce(
    (sum, row) => sum + Number(row.line_total ?? 0),
    0
  );
  const quoteDiscount = Number(quote.discount ?? 0);
  const taxable = Math.max(0, subtotal - quoteDiscount);
  const vat = Math.round(taxable * VAT_RATE * 100) / 100;
  const total = Math.round((taxable + vat) * 100) / 100;
  const appConfig = await getRuntimeAppConfig();
  const paymentProfileSnapshot = resolvePaymentProfileFromConfig(appConfig, {
    total,
    billingEntityType: getBillingEntityType(quote.leads),
    paymentTerms: quote.payment_terms,
  });

  const { error: updateError } = await supabase
    .from("quotes")
    .update({
      subtotal,
      vat,
      total,
      payment_profile_snapshot: paymentProfileSnapshot,
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message || "Failed to update quote totals" },
      { status: 500 }
    );
  }

  await logHumanAction(supabase, {
    entityType: "quote",
    entityId: id,
    actionType: "quote.item_added",
    actorId: access.email ?? undefined,
    actorLabel: access.email ?? "Admin",
    note: body.note?.toString().trim().slice(0, 500) ?? undefined,
    payload: {
      item_id: insertedItem.id,
      label: insertedItem.label,
      qty: Number(insertedItem.qty),
      unit_price: Number(insertedItem.unit_price),
      discount: Number(insertedItem.discount ?? 0),
      line_total: Number(insertedItem.line_total),
      new_subtotal: subtotal,
      new_total: total,
    },
  }).catch(() => null);

  return NextResponse.json({
    success: true,
    item: insertedItem,
    totals: { subtotal, vat, total },
  });
}

export async function GET(
  _request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;

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
  const { data, error } = await supabase
    .from("quote_items")
    .select("id, label, qty, unit_price, discount, line_total")
    .eq("quote_id", id)
    .order("id", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ items: data ?? [] });
}
