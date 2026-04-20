"use client";

import { useEffect, useMemo, useState } from "react";
import {
  PRODUCT_TYPES,
  type ProductCategoryValue,
  type ProductTypeValue,
} from "@/lib/types";

type ProductTypePickerProps = {
  value: string;
  onChange: (value: ProductTypeValue) => void;
  initialCategory?: string;
  initialProduct?: string;
};

type ProductCategoryOption = {
  value: "all" | ProductCategoryValue;
  label: string;
};

function normalizeCategory(
  value: string | undefined
): "all" | ProductCategoryValue {
  if (!value) {
    return "all";
  }

  return (
    PRODUCT_TYPES.find((item) => item.category === value)?.category || "all"
  );
}

function normalizeProduct(value: string | undefined): ProductTypeValue | null {
  if (!value) {
    return null;
  }

  return (
    PRODUCT_TYPES.find((item) => item.value === value)?.value || null
  );
}

export default function ProductTypePicker({
  value,
  onChange,
  initialCategory,
  initialProduct,
}: ProductTypePickerProps) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<"all" | ProductCategoryValue>(
    normalizeCategory(initialCategory)
  );

  useEffect(() => {
    const presetProduct = normalizeProduct(initialProduct);

    if (presetProduct && !value) {
      onChange(presetProduct);
    }
  }, [initialProduct, onChange, value]);

  useEffect(() => {
    setActiveCategory(normalizeCategory(initialCategory));
  }, [initialCategory]);

  const selectedProduct = useMemo(
    () => PRODUCT_TYPES.find((item) => item.value === value) || null,
    [value]
  );

  const categoryOptions = useMemo<ProductCategoryOption[]>(() => {
    const seen = new Set<string>();
    const categories: ProductCategoryOption[] = [
      { value: "all", label: "ทั้งหมด" },
    ];

    for (const item of PRODUCT_TYPES) {
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
  }, []);

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return PRODUCT_TYPES.filter((item) => {
      if (activeCategory !== "all" && item.category !== activeCategory) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const haystack = [
        item.label,
        item.description,
        item.categoryLabel,
        ...item.keywords,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [activeCategory, query]);

  return (
    <div className="space-y-4">
      <div className="rounded-[24px] border border-emerald-100 bg-[linear-gradient(135deg,rgba(236,253,245,0.96),rgba(255,255,255,0.94))] p-4 shadow-[0_14px_34px_rgba(5,150,105,0.08)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
              Product Selector
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {selectedProduct
                ? selectedProduct.label
                : "เลือกหมวดก่อน แล้วแตะประเภทงานที่ใกล้เคียงที่สุด"}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              {selectedProduct
                ? selectedProduct.description
                : "เริ่มจากหมวดงานด้านล่าง แล้วเลือกรายการที่ตรงกับงานของคุณได้ทันทีโดยไม่ต้องเปิด modal เพิ่ม"}
            </p>
          </div>

          <div className="inline-flex rounded-full border border-emerald-200 bg-white/90 px-3 py-1.5 text-xs font-semibold text-emerald-700">
            {selectedProduct ? `เลือกแล้ว: ${selectedProduct.categoryLabel}` : "เลือก 1 ประเภทงาน"}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {categoryOptions.map((category) => {
            const isActive = category.value === activeCategory;

            return (
              <button
                key={category.value}
                type="button"
                onClick={() => setActiveCategory(category.value)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  isActive
                    ? "border-emerald-600 bg-emerald-600 text-white shadow-[0_10px_24px_rgba(5,150,105,0.18)]"
                    : "border-emerald-200 bg-white text-emerald-800 hover:border-emerald-300 hover:bg-emerald-50"
                }`}
              >
                {category.label}
              </button>
            );
          })}
        </div>

        <div className="mt-4 space-y-2">
          <label htmlFor="product-type-search" className="block text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
            ค้นหาประเภทงาน
          </label>
          <input
            id="product-type-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ค้นหา เช่น ป้าย, sticker, อะคริลิค"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
          />
          <p className="text-xs leading-5 text-slate-500">
            ใช้ร่วมกับ LINE list menu ได้ โดยส่ง query เช่น `?category=signage`
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {filteredProducts.length > 0 ? (
          filteredProducts.map((item) => {
            const isSelected = item.value === value;

            return (
              <button
                key={item.value}
                type="button"
                onClick={() => onChange(item.value)}
                className={`rounded-[24px] border px-4 py-4 text-left transition ${
                  isSelected
                    ? "border-emerald-500 bg-emerald-50 shadow-[0_14px_34px_rgba(5,150,105,0.12)]"
                    : "border-slate-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/40"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {item.label}
                    </p>
                    <p className="mt-1 text-xs font-medium text-emerald-700">
                      {item.categoryLabel}
                    </p>
                  </div>
                  {isSelected ? (
                    <span className="rounded-full bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white">
                      เลือกแล้ว
                    </span>
                  ) : null}
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {item.description}
                </p>
              </button>
            );
          })
        ) : (
          <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500 sm:col-span-2">
            ยังไม่พบประเภทงานที่ตรงคำค้น ลองเปลี่ยนหมวดหรือพิมพ์คำกว้างขึ้น
          </div>
        )}
      </div>
    </div>
  );
}