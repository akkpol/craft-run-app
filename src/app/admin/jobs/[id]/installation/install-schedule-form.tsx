"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Initial = {
  scheduledAt: string | null;
  installTeam: string | null;
  onSiteAddress: string | null;
  onSiteContactName: string | null;
  onSiteContactPhone: string | null;
  notes: string | null;
};

function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    // Convert to Bangkok local input value (YYYY-MM-DDTHH:mm)
    const bangkok = new Date(d.getTime() + 7 * 60 * 60 * 1000);
    return bangkok.toISOString().slice(0, 16);
  } catch {
    return "";
  }
}

function fromDatetimeLocalValue(value: string): string | null {
  if (!value) return null;
  // Treat user input as Bangkok wall-clock then convert to UTC ISO.
  const asIfUTC = new Date(`${value}:00Z`);
  if (Number.isNaN(asIfUTC.getTime())) return null;
  const utc = new Date(asIfUTC.getTime() - 7 * 60 * 60 * 1000);
  return utc.toISOString();
}

export function InstallScheduleForm({
  jobId,
  initial,
}: {
  jobId: string;
  initial: Initial;
}) {
  const router = useRouter();
  const [scheduledAt, setScheduledAt] = useState(toDatetimeLocalValue(initial.scheduledAt));
  const [installTeam, setInstallTeam] = useState(initial.installTeam ?? "");
  const [onSiteAddress, setOnSiteAddress] = useState(initial.onSiteAddress ?? "");
  const [onSiteContactName, setOnSiteContactName] = useState(initial.onSiteContactName ?? "");
  const [onSiteContactPhone, setOnSiteContactPhone] = useState(initial.onSiteContactPhone ?? "");
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch(`/api/admin/jobs/${jobId}/installation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduledAt: fromDatetimeLocalValue(scheduledAt),
          installTeam: installTeam.trim() || null,
          onSiteAddress: onSiteAddress.trim() || null,
          onSiteContactName: onSiteContactName.trim() || null,
          onSiteContactPhone: onSiteContactPhone.trim() || null,
          notes: notes.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "บันทึกไม่สำเร็จ");
      }
      setMessage("บันทึกแล้ว ✓ ทีมหน้างานเปิดลิงก์ติดตั้งได้");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className="text-slate-700">วัน-เวลานัดติดตั้ง</span>
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-slate-700">ทีมงาน / ผู้รับผิดชอบ</span>
          <input
            type="text"
            value={installTeam}
            onChange={(e) => setInstallTeam(e.target.value)}
            placeholder="เช่น ทีม A / คุณสมชาย"
            maxLength={200}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          />
        </label>
      </div>

      <label className="grid gap-1 text-sm">
        <span className="text-slate-700">ที่อยู่หน้างาน</span>
        <textarea
          value={onSiteAddress}
          onChange={(e) => setOnSiteAddress(e.target.value)}
          rows={2}
          maxLength={1000}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
        />
      </label>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className="text-slate-700">ผู้ติดต่อหน้างาน</span>
          <input
            type="text"
            value={onSiteContactName}
            onChange={(e) => setOnSiteContactName(e.target.value)}
            maxLength={200}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-slate-700">เบอร์ติดต่อ</span>
          <input
            type="tel"
            value={onSiteContactPhone}
            onChange={(e) => setOnSiteContactPhone(e.target.value)}
            maxLength={50}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          />
        </label>
      </div>

      <label className="grid gap-1 text-sm">
        <span className="text-slate-700">หมายเหตุ</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          maxLength={1000}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
        />
      </label>

      <button
        type="button"
        onClick={submit}
        disabled={loading}
        className="rounded-full bg-[#1a1a2e] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#16213e] disabled:opacity-50"
      >
        {loading ? "กำลังบันทึก..." : "บันทึกข้อมูลติดตั้ง"}
      </button>

      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
    </div>
  );
}
