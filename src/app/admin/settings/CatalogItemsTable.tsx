"use client";

import { useCallback, useEffect, useState } from "react";

type CatalogItemRow = {
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

type RowState = {
  perSqm: string;
  minCharge: string;
  active: boolean;
  saving: boolean;
  error: string | null;
};

function toRowState(item: CatalogItemRow): RowState {
  return {
    perSqm: String(item.per_sqm ?? 0),
    minCharge: String(item.min_charge ?? 0),
    active: item.active,
    saving: false,
    error: null,
  };
}

function rowIsDirty(item: CatalogItemRow, state: RowState) {
  return (
    Number(state.perSqm) !== Number(item.per_sqm) ||
    Number(state.minCharge) !== Number(item.min_charge) ||
    state.active !== item.active
  );
}

export function CatalogItemsTable({ reloadKey }: { reloadKey?: number }) {
  const [items, setItems] = useState<CatalogItemRow[] | null>(null);
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/product-catalog/items", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "โหลดข้อมูล catalog ไม่สำเร็จ");
      }
      const next: CatalogItemRow[] = data.items ?? [];
      setItems(next);
      setRows(Object.fromEntries(next.map((item) => [item.value, toRowState(item)])));
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, reloadKey]);

  async function saveRow(item: CatalogItemRow) {
    const state = rows[item.value];
    if (!state) return;

    setRows((prev) => ({
      ...prev,
      [item.value]: { ...state, saving: true, error: null },
    }));

    try {
      const res = await fetch(
        `/api/admin/product-catalog/items/${encodeURIComponent(item.value)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            perSqm: Number(state.perSqm),
            minCharge: Number(state.minCharge),
            active: state.active,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "บันทึกไม่สำเร็จ");
      }
      const updated: CatalogItemRow = data.item;
      setItems((prev) =>
        prev ? prev.map((row) => (row.value === item.value ? updated : row)) : prev
      );
      setRows((prev) => ({
        ...prev,
        [item.value]: toRowState(updated),
      }));
    } catch (err) {
      setRows((prev) => ({
        ...prev,
        [item.value]: {
          ...state,
          saving: false,
          error: err instanceof Error ? err.message : "บันทึกไม่สำเร็จ",
        },
      }));
    }
  }

  if (loading && !items) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-500">
        กำลังโหลดรายการสินค้า...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        {error}
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-500">
        ยังไม่มีสินค้าใน catalog — อัปโหลด CSV ด้านบนเพื่อเริ่มต้น
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2 font-medium">สินค้า</th>
            <th className="px-3 py-2 font-medium">หมวด</th>
            <th className="px-3 py-2 font-medium text-right">ราคา/ตร.ม.</th>
            <th className="px-3 py-2 font-medium text-right">ขั้นต่ำ</th>
            <th className="px-3 py-2 font-medium text-center">เปิดใช้</th>
            <th className="px-3 py-2 font-medium" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((item) => {
            const state = rows[item.value] ?? toRowState(item);
            const dirty = rowIsDirty(item, state);
            return (
              <tr key={item.value}>
                <td className="px-3 py-2">
                  <div className="font-medium text-slate-900">{item.label}</div>
                  <div className="text-xs text-slate-500">{item.value}</div>
                </td>
                <td className="px-3 py-2 text-slate-600">{item.category_label}</td>
                <td className="px-3 py-2 text-right">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={state.perSqm}
                    onChange={(e) =>
                      setRows((prev) => ({
                        ...prev,
                        [item.value]: { ...state, perSqm: e.target.value },
                      }))
                    }
                    className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-right outline-none focus:border-slate-400"
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={state.minCharge}
                    onChange={(e) =>
                      setRows((prev) => ({
                        ...prev,
                        [item.value]: { ...state, minCharge: e.target.value },
                      }))
                    }
                    className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-right outline-none focus:border-slate-400"
                  />
                </td>
                <td className="px-3 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={state.active}
                    onChange={(e) =>
                      setRows((prev) => ({
                        ...prev,
                        [item.value]: { ...state, active: e.target.checked },
                      }))
                    }
                    className="h-4 w-4"
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    disabled={!dirty || state.saving}
                    onClick={() => void saveRow(item)}
                    className="rounded-full bg-[#1a1a2e] px-3 py-1 text-xs font-semibold text-white transition hover:bg-[#16213e] disabled:opacity-40"
                  >
                    {state.saving ? "..." : "บันทึก"}
                  </button>
                  {state.error ? (
                    <p className="mt-1 text-xs text-rose-600">{state.error}</p>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
