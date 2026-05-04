import { NextRequest, NextResponse } from "next/server";
import { resolveAdminAccess } from "@/lib/admin-auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logHumanAction } from "@/lib/action-log";
import { parseProductCatalogCsv } from "@/lib/product-catalog";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "กรุณาเลือกไฟล์ CSV" }, { status: 400 });
  }

  const csvText = await file.text();
  const { items, errors } = parseProductCatalogCsv(csvText);

  if (errors.length > 0) {
    return NextResponse.json(
      { error: "รูปแบบ CSV ไม่ถูกต้อง", details: errors.slice(0, 20) },
      { status: 400 }
    );
  }

  if (items.length === 0) {
    return NextResponse.json({ error: "ไม่พบข้อมูลสินค้าในไฟล์" }, { status: 400 });
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

  const adminEmail = access.email;
  const adminActorId =
    adminEmail || (typeof authData?.claims?.sub === "string" ? authData.claims.sub : undefined);

  const supabase = createAdminClient();
  const values = Array.from(new Set(items.map((item) => item.value)));
  const { data: existingRows } = await supabase
    .from("product_catalog_items")
    .select("value")
    .in("value", values);

  const existingValues = new Set((existingRows || []).map((row) => row.value));
  const now = new Date().toISOString();
  const payload = items.map((item) => ({
    value: item.value,
    label: item.label,
    category: item.category,
    category_label: item.categoryLabel,
    description: item.description || null,
    keywords: item.keywords,
    per_sqm: item.perSqm,
    min_charge: item.minCharge,
    active: item.active,
    sort_order: item.sortOrder,
    updated_at: now,
  }));

  const { error } = await supabase.from("product_catalog_items").upsert(payload, {
    onConflict: "value",
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const importedValues = new Set(items.map((item) => item.value));
  const generatedValueCount = items.filter((item, index) => {
    const original = parseProductCatalogCsv(csvText).items[index];
    return original?.value === item.value;
  }).length;

  await logHumanAction(supabase, {
    entityType: "system",
    entityId: "product_catalog_items",
    actionType: "product_catalog.imported",
    actorId: adminActorId,
    actorLabel: adminEmail ?? "Admin",
    payload: {
      file_name: file.name,
      imported_count: items.length,
      inserted_count: items.filter((item) => !existingValues.has(item.value)).length,
      updated_count: items.filter((item) => existingValues.has(item.value)).length,
      active_count: items.filter((item) => item.active).length,
      distinct_values: importedValues.size,
      generated_value_count: generatedValueCount,
    },
  });

  return NextResponse.json({
    success: true,
    importedCount: items.length,
    insertedCount: items.filter((item) => !existingValues.has(item.value)).length,
    updatedCount: items.filter((item) => existingValues.has(item.value)).length,
    activeCount: items.filter((item) => item.active).length,
    generatedValueCount,
  });
}
