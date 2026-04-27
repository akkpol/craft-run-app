import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  getDefaultProductCatalog,
  sortProductCatalog,
  type ProductCatalogItem,
} from "@/lib/product-catalog";

export type ProductCatalogRow = {
  value: string;
  label: string;
  category: string;
  category_label: string;
  description: string | null;
  keywords: string[] | null;
  per_sqm: number;
  min_charge: number;
  active: boolean;
  sort_order: number;
};

function mapRowToItem(row: ProductCatalogRow): ProductCatalogItem {
  return {
    value: row.value,
    label: row.label,
    category: row.category,
    categoryLabel: row.category_label,
    description: row.description || "",
    keywords: Array.isArray(row.keywords) ? row.keywords : [],
    perSqm: Number(row.per_sqm) || 0,
    minCharge: Number(row.min_charge) || 0,
    active: row.active !== false,
    sortOrder: Number.isFinite(row.sort_order) ? row.sort_order : 0,
  };
}

export async function getProductCatalog(options?: { activeOnly?: boolean }) {
  const activeOnly = options?.activeOnly ?? true;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("product_catalog_items")
    .select(
      "value, label, category, category_label, description, keywords, per_sqm, min_charge, active, sort_order"
    )
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true });

  if (error) {
    return {
      items: getDefaultProductCatalog(),
      source: "fallback" as const,
      error,
    };
  }

  const merged = new Map<string, ProductCatalogItem>();
  for (const item of getDefaultProductCatalog()) {
    merged.set(item.value, item);
  }

  for (const row of (data || []) as ProductCatalogRow[]) {
    const item = mapRowToItem(row);
    if (!item.active) {
      merged.delete(item.value);
      continue;
    }

    merged.set(item.value, item);
  }

  const items = sortProductCatalog(
    Array.from(merged.values()).filter((item) => (activeOnly ? item.active : true))
  );

  return {
    items,
    source: (data || []).length > 0 ? ("database" as const) : ("fallback" as const),
    error: null,
  };
}