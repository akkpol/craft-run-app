"use client";

import { Fragment, useCallback, useEffect, useState } from "react";

type Entity = {
  id: string;
  code: string;
  type: "company" | "person";
  role: "MAIN_COMPANY" | "SUB_COMPANY" | "PERSONAL_ACCOUNT";
  legal_name: string;
  display_name: string;
  tax_id: string | null;
  is_vat_registered: boolean;
  branch_type: "HEAD_OFFICE" | "BRANCH";
  branch_code: string | null;
  branch_name: string | null;
  address: string | null;
  bank_account_owner: string | null;
  active: boolean;
};

const ROLE_LABELS: Record<Entity["role"], string> = {
  MAIN_COMPANY: "บริษัทหลัก",
  SUB_COMPANY: "บริษัทย่อย",
  PERSONAL_ACCOUNT: "บัญชีบุคคล",
};

const initialDraft = {
  code: "",
  type: "company" as Entity["type"],
  role: "SUB_COMPANY" as Entity["role"],
  legalName: "",
  displayName: "",
  taxId: "",
  isVatRegistered: false,
  branchType: "HEAD_OFFICE" as Entity["branch_type"],
  branchCode: "",
  branchName: "",
  address: "",
  bankAccountOwner: "",
};

type EntityDraft = typeof initialDraft;

function draftFromEntity(entity: Entity): EntityDraft {
  return {
    code: entity.code,
    type: entity.type,
    role: entity.role,
    legalName: entity.legal_name,
    displayName: entity.display_name,
    taxId: entity.tax_id ?? "",
    isVatRegistered: entity.is_vat_registered,
    branchType: entity.branch_type,
    branchCode: entity.branch_code ?? "",
    branchName: entity.branch_name ?? "",
    address: entity.address ?? "",
    bankAccountOwner: entity.bank_account_owner ?? "",
  };
}

function hasRequiredEntityFields(draft: EntityDraft) {
  return Boolean(
    draft.code.trim() &&
    draft.legalName.trim() &&
    draft.displayName.trim() &&
    (!draft.isVatRegistered || (draft.taxId.trim() && draft.address.trim()))
  );
}

export function CommercialEntitiesEditor() {
  const [entities, setEntities] = useState<Entity[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [draft, setDraft] = useState(initialDraft);
  const [editDraft, setEditDraft] = useState<EntityDraft>(initialDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/commercial-entities", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "โหลดข้อมูลไม่สำเร็จ");
      setEntities(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function createEntity() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/commercial-entities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: draft.code,
          type: draft.type,
          role: draft.role,
          legalName: draft.legalName,
          displayName: draft.displayName,
          taxId: draft.taxId || null,
          isVatRegistered: draft.isVatRegistered,
          branchType: draft.branchType,
          branchCode: draft.branchCode || null,
          branchName: draft.branchName || null,
          address: draft.address || null,
          bankAccountOwner: draft.bankAccountOwner || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || data?.error || "สร้างไม่สำเร็จ");
      setDraft(initialDraft);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "สร้างไม่สำเร็จ");
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(entity: Entity) {
    setBusyId(entity.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/commercial-entities/${entity.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !entity.active }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || data?.error || "อัปเดตไม่สำเร็จ");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "อัปเดตไม่สำเร็จ");
    } finally {
      setBusyId(null);
    }
  }

  function startEdit(entity: Entity) {
    setError(null);
    setEditingId(entity.id);
    setEditDraft(draftFromEntity(entity));
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft(initialDraft);
  }

  async function saveEntity(entity: Entity) {
    setBusyId(entity.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/commercial-entities/${entity.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          legalName: editDraft.legalName,
          displayName: editDraft.displayName,
          taxId: editDraft.role === "PERSONAL_ACCOUNT" ? null : editDraft.taxId || null,
          isVatRegistered: editDraft.role === "PERSONAL_ACCOUNT" ? false : editDraft.isVatRegistered,
          branchType: editDraft.branchType,
          branchCode: editDraft.branchCode || null,
          branchName: editDraft.branchName || null,
          address: editDraft.address || null,
          bankAccountOwner: editDraft.bankAccountOwner || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || data?.error || "อัปเดตไม่สำเร็จ");
      cancelEdit();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "อัปเดตไม่สำเร็จ");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      {error ? (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-800">{error}</p>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-950">รายการปัจจุบัน</h2>
        {loading && !entities ? (
          <p className="mt-2 text-xs text-slate-500">กำลังโหลด...</p>
        ) : !entities || entities.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">ยังไม่มี entity</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-left uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-2 py-2 font-medium">Code</th>
                  <th className="px-2 py-2 font-medium">Role</th>
                  <th className="px-2 py-2 font-medium">Display</th>
                  <th className="px-2 py-2 font-medium">Tax ID</th>
                  <th className="px-2 py-2 font-medium">VAT</th>
                  <th className="px-2 py-2 font-medium">สถานะ</th>
                  <th className="px-2 py-2 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entities.map((entity) => (
                  <Fragment key={entity.id}>
                    <tr className={entity.active ? "" : "bg-slate-50/70 text-slate-500"}>
                      <td className="px-2 py-2 font-mono">{entity.code}</td>
                      <td className="px-2 py-2">{ROLE_LABELS[entity.role]}</td>
                      <td className="px-2 py-2">
                        <div className="font-medium text-slate-900">{entity.display_name}</div>
                        <div className="text-[11px] text-slate-500">{entity.legal_name}</div>
                      </td>
                      <td className="px-2 py-2 font-mono">{entity.tax_id ?? "—"}</td>
                      <td className="px-2 py-2">
                        {entity.is_vat_registered ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800">VAT</span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        {entity.active ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800">เปิดใช้</span>
                        ) : (
                          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-slate-700">ปิด</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => (editingId === entity.id ? cancelEdit() : startEdit(entity))}
                            disabled={busyId === entity.id}
                            className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            {editingId === entity.id ? "ยกเลิก" : "แก้ไข"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void toggleActive(entity)}
                            disabled={busyId === entity.id}
                            className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            {entity.active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {editingId === entity.id ? (
                      <tr className="bg-slate-50">
                        <td colSpan={7} className="px-2 py-4">
                          <div className="grid gap-3 md:grid-cols-2">
                            <label className="grid gap-1 text-xs">
                              <span className="font-medium text-slate-700">Legal name</span>
                              <input
                                type="text"
                                value={editDraft.legalName}
                                onChange={(e) =>
                                  setEditDraft((d) => ({ ...d, legalName: e.target.value }))
                                }
                                maxLength={500}
                                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5"
                              />
                            </label>

                            <label className="grid gap-1 text-xs">
                              <span className="font-medium text-slate-700">Display name</span>
                              <input
                                type="text"
                                value={editDraft.displayName}
                                onChange={(e) =>
                                  setEditDraft((d) => ({ ...d, displayName: e.target.value }))
                                }
                                maxLength={200}
                                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5"
                              />
                            </label>

                            <label className="grid gap-1 text-xs">
                              <span className="font-medium text-slate-700">Tax ID</span>
                              <input
                                type="text"
                                value={editDraft.taxId}
                                onChange={(e) =>
                                  setEditDraft((d) => ({ ...d, taxId: e.target.value }))
                                }
                                maxLength={50}
                                disabled={editDraft.role === "PERSONAL_ACCOUNT"}
                                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 font-mono disabled:bg-slate-100"
                              />
                            </label>

                            <label className="flex items-center gap-2 text-xs">
                              <input
                                type="checkbox"
                                checked={editDraft.isVatRegistered}
                                disabled={editDraft.role === "PERSONAL_ACCOUNT"}
                                onChange={(e) =>
                                  setEditDraft((d) => ({ ...d, isVatRegistered: e.target.checked }))
                                }
                                className="size-4"
                              />
                              <span className="font-medium text-slate-700">VAT registered</span>
                            </label>

                            <label className="grid gap-1 text-xs">
                              <span className="font-medium text-slate-700">Branch type</span>
                              <select
                                value={editDraft.branchType}
                                onChange={(e) =>
                                  setEditDraft((d) => ({
                                    ...d,
                                    branchType: e.target.value as Entity["branch_type"],
                                  }))
                                }
                                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5"
                              >
                                <option value="HEAD_OFFICE">สำนักงานใหญ่</option>
                                <option value="BRANCH">สาขา</option>
                              </select>
                            </label>

                            <label className="grid gap-1 text-xs">
                              <span className="font-medium text-slate-700">Branch code</span>
                              <input
                                type="text"
                                value={editDraft.branchCode}
                                onChange={(e) =>
                                  setEditDraft((d) => ({ ...d, branchCode: e.target.value }))
                                }
                                maxLength={50}
                                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 font-mono"
                              />
                            </label>

                            <label className="grid gap-1 text-xs">
                              <span className="font-medium text-slate-700">Branch name</span>
                              <input
                                type="text"
                                value={editDraft.branchName}
                                onChange={(e) =>
                                  setEditDraft((d) => ({ ...d, branchName: e.target.value }))
                                }
                                maxLength={200}
                                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5"
                              />
                            </label>

                            <label className="md:col-span-2 grid gap-1 text-xs">
                              <span className="font-medium text-slate-700">Address</span>
                              <textarea
                                value={editDraft.address}
                                onChange={(e) =>
                                  setEditDraft((d) => ({ ...d, address: e.target.value }))
                                }
                                rows={2}
                                maxLength={1000}
                                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5"
                              />
                            </label>

                            <label className="md:col-span-2 grid gap-1 text-xs">
                              <span className="font-medium text-slate-700">Bank account owner</span>
                              <input
                                type="text"
                                value={editDraft.bankAccountOwner}
                                onChange={(e) =>
                                  setEditDraft((d) => ({ ...d, bankAccountOwner: e.target.value }))
                                }
                                maxLength={500}
                                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5"
                              />
                            </label>
                          </div>

                          <div className="mt-3 flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              ยกเลิก
                            </button>
                            <button
                              type="button"
                              onClick={() => void saveEntity(entity)}
                              disabled={busyId === entity.id || !hasRequiredEntityFields(editDraft)}
                              className="rounded-full bg-[#1a1a2e] px-4 py-2 text-xs font-semibold text-white hover:bg-[#16213e] disabled:opacity-50"
                            >
                              {busyId === entity.id ? "กำลังบันทึก..." : "บันทึก"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-emerald-950">เพิ่ม entity ใหม่</h2>
        <p className="mt-1 text-xs text-emerald-900/80">
          PERSONAL_ACCOUNT ต้องใช้ type=person และห้าม VAT — MAIN/SUB_COMPANY ต้องใช้ type=company —
          ระบบจะ block ที่ server ถ้าผิด
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-xs">
            <span className="font-medium text-slate-700">Code (unique)</span>
            <input
              type="text"
              value={draft.code}
              onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value }))}
              maxLength={100}
              placeholder="เช่น FOGUS-SUB-2"
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5"
            />
          </label>

          <label className="grid gap-1 text-xs">
            <span className="font-medium text-slate-700">Role</span>
            <select
              value={draft.role}
              onChange={(e) => {
                const role = e.target.value as Entity["role"];
                setDraft((d) => ({
                  ...d,
                  role,
                  type: role === "PERSONAL_ACCOUNT" ? "person" : "company",
                  isVatRegistered: role === "PERSONAL_ACCOUNT" ? false : d.isVatRegistered,
                }));
              }}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5"
            >
              <option value="MAIN_COMPANY">บริษัทหลัก (MAIN_COMPANY)</option>
              <option value="SUB_COMPANY">บริษัทย่อย (SUB_COMPANY)</option>
              <option value="PERSONAL_ACCOUNT">บัญชีบุคคล (PERSONAL_ACCOUNT)</option>
            </select>
          </label>

          <label className="grid gap-1 text-xs">
            <span className="font-medium text-slate-700">Legal name</span>
            <input
              type="text"
              value={draft.legalName}
              onChange={(e) => setDraft((d) => ({ ...d, legalName: e.target.value }))}
              maxLength={500}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5"
            />
          </label>

          <label className="grid gap-1 text-xs">
            <span className="font-medium text-slate-700">Display name</span>
            <input
              type="text"
              value={draft.displayName}
              onChange={(e) => setDraft((d) => ({ ...d, displayName: e.target.value }))}
              maxLength={200}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5"
            />
          </label>

          <label className="grid gap-1 text-xs">
            <span className="font-medium text-slate-700">Tax ID (เลขประจำตัวผู้เสียภาษี)</span>
            <input
              type="text"
              value={draft.taxId}
              onChange={(e) => setDraft((d) => ({ ...d, taxId: e.target.value }))}
              maxLength={50}
              placeholder="0105561234567"
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 font-mono"
              disabled={draft.role === "PERSONAL_ACCOUNT"}
            />
          </label>

          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={draft.isVatRegistered}
              disabled={draft.role === "PERSONAL_ACCOUNT"}
              onChange={(e) => setDraft((d) => ({ ...d, isVatRegistered: e.target.checked }))}
              className="size-4"
            />
            <span className="font-medium text-slate-700">VAT registered (จด VAT)</span>
          </label>

          <label className="grid gap-1 text-xs">
            <span className="font-medium text-slate-700">Branch type</span>
            <select
              value={draft.branchType}
              onChange={(e) =>
                setDraft((d) => ({ ...d, branchType: e.target.value as Entity["branch_type"] }))
              }
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5"
            >
              <option value="HEAD_OFFICE">สำนักงานใหญ่</option>
              <option value="BRANCH">สาขา</option>
            </select>
          </label>

          <label className="grid gap-1 text-xs">
            <span className="font-medium text-slate-700">Branch code</span>
            <input
              type="text"
              value={draft.branchCode}
              onChange={(e) => setDraft((d) => ({ ...d, branchCode: e.target.value }))}
              placeholder="เช่น 00001"
              maxLength={50}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 font-mono"
            />
          </label>

          <label className="grid gap-1 text-xs">
            <span className="font-medium text-slate-700">Branch name</span>
            <input
              type="text"
              value={draft.branchName}
              onChange={(e) => setDraft((d) => ({ ...d, branchName: e.target.value }))}
              placeholder="เช่น สาขาบางนา"
              maxLength={200}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5"
            />
          </label>

          <label className="md:col-span-2 grid gap-1 text-xs">
            <span className="font-medium text-slate-700">Address</span>
            <textarea
              value={draft.address}
              onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))}
              rows={2}
              maxLength={1000}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5"
            />
          </label>

          <label className="md:col-span-2 grid gap-1 text-xs">
            <span className="font-medium text-slate-700">Bank account owner</span>
            <input
              type="text"
              value={draft.bankAccountOwner}
              onChange={(e) => setDraft((d) => ({ ...d, bankAccountOwner: e.target.value }))}
              maxLength={500}
              placeholder="ชื่อบัญชีที่ใช้รับเงิน"
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5"
            />
          </label>
        </div>

        <button
          type="button"
          onClick={() => void createEntity()}
          disabled={creating || !hasRequiredEntityFields(draft)}
          className="mt-4 rounded-full bg-[#1a1a2e] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#16213e] disabled:opacity-50"
        >
          {creating ? "กำลังบันทึก..." : "เพิ่ม entity"}
        </button>
      </section>
    </div>
  );
}
