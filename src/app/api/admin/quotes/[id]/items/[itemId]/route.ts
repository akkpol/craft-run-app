import { NextRequest, NextResponse } from "next/server";

import { logHumanAction } from "@/lib/action-log";
import { resolveAdminAccess } from "@/lib/admin-auth";
import { getRuntimeAppConfig } from "@/lib/app-settings";
import { resolvePaymentProfileFromConfig } from "@/lib/payment-routing";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const VAT_RATE = 0.07;

function getBillingEntityType(leads: unknown) {
  const lead = Array.isArray(leads) ? leads[0] : leads;
  if (!lead || typeof lead !== "object") {
    return null;
  }

  const value = (lead as { billing_entity_type?: unknown }).billing_entity_type;
  return typeof value === "string" ? value : null;
}

async function recomputeQuoteTotals(
  supabase: ReturnType<typeof createAdminClient>,
  quote: {
    id: string;
    discount: number;
    paymentTerms?: string | null;
    billingEntityType?: string | null;
  }
) {
  const { data: itemRows, error: sumError } = await supabase
    .from("quote_items")
    .select("line_total")
    .eq("quote_id", quote.id);

  if (sumError) {
    throw new Error(sumError.message);
  }

  const subtotal = (itemRows ?? []).reduce(
    (sum, row) => sum + Number(row.line_total ?? 0),
    0
  );
  const taxable = Math.max(0, subtotal - quote.discount);
  const vat = Math.round(taxable * VAT_RATE * 100) / 100;
  const total = Math.round((taxable + vat) * 100) / 100;
  const appConfig = await getRuntimeAppConfig();
  const paymentProfileSnapshot = resolvePaymentProfileFromConfig(appConfig, {
    total,
    billingEntityType: quote.billingEntityType || null,
    paymentTerms: quote.paymentTerms || null,
  });

  const { error: updateError } = await supabase
    .from("quotes")
    .update({
      subtotal,
      vat,
      total,
      payment_profile_snapshot: paymentProfileSnapshot,
    })
    .eq("id", quote.id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return { subtotal, vat, total };
}

async function loadQuoteEditability(
  supabase: ReturnType<typeof createAdminClient>,
  quoteId: string
) {
  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .select("id, status, discount, payment_status, payment_terms, leads(billing_entity_type)")
    .eq("id", quoteId)
    .maybeSingle();
  if (quoteError) {
    return { ok: false as const, status: 500, error: quoteError.message };
  }
  if (!quote) {
    return { ok: false as const, status: 404, error: "Quote not found" };
  }
  if (quote.status !== "draft" && quote.status !== "sent") {
    return {
      ok: false as const,
      status: 409,
      error: "QUOTE_NOT_EDITABLE",
      detail: `Cannot edit items while quote status is ${quote.status}.`,
    };
  }
  if (quote.payment_status === "paid" || quote.payment_status === "partial") {
    return {
      ok: false as const,
      status: 409,
      error: "QUOTE_NOT_EDITABLE",
      detail: "Cannot edit items after payment has been captured.",
    };
  }
  return {
    ok: true as const,
    quoteId: quote.id,
    discount: Number(quote.discount ?? 0),
    paymentTerms: quote.payment_terms,
    billingEntityType: getBillingEntityType(quote.leads),
  };
}

export async function DELETE(
  _request: NextRequest,
  props: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id, itemId } = await props.params;

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
  const editable = await loadQuoteEditability(supabase, id);
  if (!editable.ok) {
    return NextResponse.json(
      { error: editable.error, detail: "detail" in editable ? editable.detail : undefined },
      { status: editable.status }
    );
  }

  const { data: existingItems, error: existingItemsError } = await supabase
    .from("quote_items")
    .select("id")
    .eq("quote_id", id);

  if (existingItemsError) {
    return NextResponse.json(
      { error: existingItemsError.message },
      { status: 500 }
    );
  }

  if (!(existingItems ?? []).some((item) => item.id === itemId)) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  if ((existingItems ?? []).length <= 1) {
    return NextResponse.json(
      {
        error: "LAST_ITEM_PROTECTED",
        detail: "A quote must keep at least one line item.",
      },
      { status: 409 }
    );
  }

  // Race-safe delete: filter by both quote_id AND item id so concurrent
  // attempts to delete the same item see a 404 rather than success.
  const { data: deleted, error: deleteError } = await supabase
    .from("quote_items")
    .delete()
    .eq("id", itemId)
    .eq("quote_id", id)
    .select("id, label, qty, unit_price")
    .maybeSingle();

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }
  if (!deleted) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  // Don't allow deleting the last item — a quote with zero items has no
  // billable contents and would let the workflow keep moving with stale
  // pricing. Restore by re-inserting and 409 the request.
  const { count, error: countError } = await supabase
    .from("quote_items")
    .select("id", { count: "exact", head: true })
    .eq("quote_id", id);

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }

  if (!count || count === 0) {
    // Re-insert the row to keep the quote consistent.
    await supabase.from("quote_items").insert({
      id: deleted.id,
      quote_id: id,
      label: deleted.label,
      qty: deleted.qty,
      unit_price: deleted.unit_price,
    });
    return NextResponse.json(
      {
        error: "LAST_ITEM_PROTECTED",
        detail: "A quote must keep at least one line item.",
      },
      { status: 409 }
    );
  }

  let totals;
  try {
    totals = await recomputeQuoteTotals(supabase, {
      id: editable.quoteId,
      discount: editable.discount,
      paymentTerms: editable.paymentTerms,
      billingEntityType: editable.billingEntityType,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to recompute totals" },
      { status: 500 }
    );
  }

  await logHumanAction(supabase, {
    entityType: "quote",
    entityId: id,
    actionType: "quote.item_removed",
    actorId: access.email ?? undefined,
    actorLabel: access.email ?? "Admin",
    payload: {
      item_id: itemId,
      removed_label: deleted.label,
      new_subtotal: totals.subtotal,
      new_total: totals.total,
    },
  }).catch(() => null);

  return NextResponse.json({ success: true, totals });
}
