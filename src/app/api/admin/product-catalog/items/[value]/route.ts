import { NextRequest, NextResponse } from "next/server";

import { logHumanAction } from "@/lib/action-log";
import { resolveAdminAccess } from "@/lib/admin-auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type PatchBody = {
  label?: string;
  category?: string;
  categoryLabel?: string;
  description?: string | null;
  perSqm?: number;
  minCharge?: number;
  active?: boolean;
  sortOrder?: number;
};

function parseNumberOrUndefined(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export async function PATCH(
  request: NextRequest,
  props: { params: Promise<{ value: string }> }
) {
  const { value } = await props.params;

  let body: PatchBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
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

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (typeof body.label === "string") update.label = body.label.trim();
  if (typeof body.category === "string") update.category = body.category.trim();
  if (typeof body.categoryLabel === "string") update.category_label = body.categoryLabel.trim();
  if (body.description !== undefined) {
    update.description = body.description === null ? null : String(body.description);
  }
  const perSqm = parseNumberOrUndefined(body.perSqm);
  if (perSqm !== undefined) update.per_sqm = perSqm;
  const minCharge = parseNumberOrUndefined(body.minCharge);
  if (minCharge !== undefined) update.min_charge = minCharge;
  if (typeof body.active === "boolean") update.active = body.active;
  const sortOrder = parseNumberOrUndefined(body.sortOrder);
  if (sortOrder !== undefined) update.sort_order = sortOrder;

  if (Object.keys(update).length <= 1) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("product_catalog_items")
    .update(update)
    .eq("value", value)
    .select("value, label, category, category_label, description, keywords, per_sqm, min_charge, active, sort_order")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  const adminEmail = access.email;
  const adminActorId =
    adminEmail || (typeof authData?.claims?.sub === "string" ? authData.claims.sub : undefined);

  await logHumanAction(supabase, {
    entityType: "system",
    entityId: "product_catalog_items",
    actionType: "product_catalog.item_updated",
    actorId: adminActorId,
    actorLabel: adminEmail ?? "Admin",
    payload: {
      value,
      changed_fields: Object.keys(update).filter((k) => k !== "updated_at"),
    },
  }).catch(() => null);

  return NextResponse.json({ success: true, item: data });
}
