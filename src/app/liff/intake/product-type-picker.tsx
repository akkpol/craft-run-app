"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getDefaultProductCatalog,
  type ProductCatalogItem,
} from "@/lib/product-catalog";
import { cn } from "@/lib/utils";

type ProductCatalogValue = string;
type ProductCatalogCategory = string;

type ProductTypePickerProps = {
  value: string;
  onChange: (value: ProductCatalogValue | "") => void;
  onSelectedProductChange?: (product: ProductCatalogItem | null) => void;
  initialCategory?: string;
  initialProduct?: string;
};

type ProductCategoryOption = {
  value: "all" | ProductCatalogCategory;
  label: string;
};

function normalizeCategory(
  value: string | undefined,
  products: ProductCatalogItem[]
): "all" | ProductCatalogCategory {
  if (!value) {
    return "all";
  }

  return (
    products.find((item) => item.category === value)?.category || "all"
  );
}

function normalizeProduct(
  value: string | undefined,
  products: ProductCatalogItem[]
): ProductCatalogValue | null {
  if (!value) {
    return null;
  }

  return (
    products.find((item) => item.value === value)?.value || null
  );
}

export default function ProductTypePicker({
  value,
  onChange,
  onSelectedProductChange,
  initialCategory,
  initialProduct,
}: ProductTypePickerProps) {
  const [products, setProducts] = useState<ProductCatalogItem[]>(() =>
    getDefaultProductCatalog()
  );
  const [catalogSource, setCatalogSource] = useState<
    "loading" | "database" | "fallback"
  >("loading");
  const [activeCategory, setActiveCategory] = useState<"all" | ProductCatalogCategory>(
    normalizeCategory(initialCategory, getDefaultProductCatalog())
  );
  const [query, setQuery] = useState("");
  const [showAllProducts, setShowAllProducts] = useState(false);
  const selectedProduct = useMemo(
    () => products.find((item) => item.value === value) || null,
    [products, value]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadProductCatalog() {
      try {
        const res = await fetch("/api/intake/product-catalog", {
          cache: "no-store",
        });
        const data = await res.json();

        if (!res.ok || !Array.isArray(data.products) || data.products.length === 0) {
          throw new Error("PRODUCT_CATALOG_UNAVAILABLE");
        }

        if (!cancelled) {
          setProducts(data.products as ProductCatalogItem[]);
          setCatalogSource(data.source === "database" ? "database" : "fallback");
        }
      } catch {
        if (!cancelled) {
          setProducts(getDefaultProductCatalog());
          setCatalogSource("fallback");
        }
      }
    }

    void loadProductCatalog();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const presetProduct = normalizeProduct(initialProduct, products);

    if (presetProduct && !value) {
      onChange(presetProduct);
    }
  }, [initialProduct, onChange, products, value]);

  useEffect(() => {
    setActiveCategory(normalizeCategory(initialCategory, products));
  }, [initialCategory, products]);

  useEffect(() => {
    onSelectedProductChange?.(selectedProduct);
  }, [onSelectedProductChange, selectedProduct]);

  const categoryOptions = useMemo<ProductCategoryOption[]>(() => {
    const seen = new Set<string>();
    const categories: ProductCategoryOption[] = [
      { value: "all", label: "ทั้งหมด" },
    ];

    for (const item of products) {
      if (seen.has(item.category)) {
        continue;
      }

      seen.add(item.category);
      categories.push({
        value: item.category,
        label: item.categoryLabel,
      });
    }

    return categories;
  }, [products]);

  const categoryFilteredProducts = useMemo(() => {
    return products.filter((item) => {
      if (activeCategory !== "all" && item.category !== activeCategory) {
        return false;
      }

      return true;
    });
  }, [activeCategory, products]);

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return categoryFilteredProducts;
    }

    return categoryFilteredProducts.filter((item) => {
      const haystack = [
        item.label,
        item.categoryLabel,
        item.description,
        ...item.keywords,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [categoryFilteredProducts, query]);

  const compactProductList = !query.trim() && activeCategory === "all";
  const visibleProducts = compactProductList && !showAllProducts
    ? filteredProducts.slice(0, 6)
    : filteredProducts;

  useEffect(() => {
    setShowAllProducts(false);
  }, [activeCategory, query]);

  useEffect(() => {
    if (!value) {
      return;
    }

    if (activeCategory === "all") {
      return;
    }

    const stillVisible = categoryFilteredProducts.some((item) => item.value === value);
    if (!stillVisible) {
      onChange("");
    }
  }, [activeCategory, categoryFilteredProducts, onChange, value]);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-[1.25rem] bg-slate-50/78 p-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">สินค้า</p>
          <p className="mt-1 text-sm font-semibold text-stone-900">
            {selectedProduct ? selectedProduct.label : "เลือกหมวดและชนิดสินค้า"}
          </p>
          {selectedProduct?.categoryLabel ? (
            <p className="mt-1 text-xs text-sky-700">{selectedProduct.categoryLabel}</p>
          ) : null}
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">หมวดงาน</p>
          <div className="flex flex-wrap gap-2">
            {categoryOptions.map((category) => {
              const isActive = activeCategory === category.value;

              return (
                <Button
                  key={category.value}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveCategory(category.value)}
                  className={cn(
                    "rounded-xl px-3.5",
                    isActive
                      ? "border-sky-300 bg-sky-50 text-sky-950 hover:bg-sky-100"
                      : "border-slate-200 bg-white/80 text-slate-600 hover:bg-slate-50"
                  )}
                >
                  {category.label}
                </Button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <label
            htmlFor="product-type-query"
            className="block text-xs font-medium uppercase tracking-[0.14em] text-slate-500"
          >
            ค้นหางาน
          </label>
          <Input
            id="product-type-query"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="พิมพ์ชื่อสินค้า"
            className="h-11 rounded-xl border border-slate-200 bg-white/86 px-4 text-sm shadow-none focus-visible:border-sky-300 focus-visible:ring-4 focus-visible:ring-sky-100"
          />
        </div>

        <div className="mt-4 space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">ชนิดสินค้า</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {visibleProducts.map((item) => {
              const isActive = value === item.value;

              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => onChange(item.value)}
                  className={cn(
                    "pressable-native rounded-2xl border px-4 py-3 text-left",
                    isActive
                      ? "border-sky-300 bg-sky-50/90 text-slate-900 shadow-[0_12px_24px_rgba(125,211,252,0.18)]"
                      : "border-slate-200 bg-white/82 text-slate-900 hover:border-sky-200 hover:bg-sky-50/40"
                  )}
                >
                  <p className="text-sm font-semibold leading-5">{item.label}</p>
                  <p className={cn("mt-1 text-xs", isActive ? "text-sky-800" : "text-slate-500")}>{item.categoryLabel}</p>
                </button>
              );
            })}
          </div>
          {compactProductList && filteredProducts.length > visibleProducts.length ? (
            <button
              type="button"
              onClick={() => setShowAllProducts(true)}
              className="pressable-native w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              แสดงสินค้าทั้งหมด {filteredProducts.length} รายการ
            </button>
          ) : null}

          {filteredProducts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-600">
              ไม่พบรายการที่ตรงกับหมวดหรือคำค้นนี้
            </div>
          ) : null}
        </div>

        {selectedProduct ? (
          <div className="flow-theme-card mt-3 flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{selectedProduct.label}</p>
              <p className="mt-1 text-xs font-medium text-sky-700">{selectedProduct.categoryLabel}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onChange("")}
              className="shrink-0 rounded-full border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            >
              ล้าง
            </Button>
          </div>
        ) : null}

        <p className="mt-3 text-[11px] text-slate-400">
          {catalogSource === "loading"
            ? "กำลังโหลดรายการสินค้า"
            : "เลือกสินค้าที่ใกล้เคียงที่สุดได้ ทีมงานจะตรวจรายละเอียดก่อนเสนอราคา"}
        </p>
      </div>
    </div>
  );
}