"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Initial = {
  provider: string | null;
  trackingUrl: string | null;
  trackingNumber: string | null;
  dispatchedAt: string | null;
  notes: string | null;
};

const PROVIDER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "ยังไม่ระบุ" },
  { value: "lalamove", label: "Lalamove" },
  { value: "grab", label: "Grab Express" },
  { value: "kerry", label: "Kerry Express" },
  { value: "flash", label: "Flash Express" },
  { value: "thaipost", label: "ไปรษณีย์ไทย" },
  { value: "inhouse", label: "ทีมร้าน (in-house)" },
  { value: "other", label: "อื่นๆ" },
];

function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const bangkok = new Date(d.getTime() + 7 * 60 * 60 * 1000);
    return bangkok.toISOString().slice(0, 16);
  } catch {
    return "";
  }
}

function fromDatetimeLocalValue(value: string): string | null {
  if (!value) return null;
  const asIfUTC = new Date(`${value}:00Z`);
  if (Number.isNaN(asIfUTC.getTime())) return null;
  return new Date(asIfUTC.getTime() - 7 * 60 * 60 * 1000).toISOString();
}

export function DeliveryTrackingForm({ jobId, initial }: { jobId: string; initial: Initial }) {
  const router = useRouter();
  const [provider, setProvider] = useState(initial.provider ?? "");
  const [trackingUrl, setTrackingUrl] = useState(initial.trackingUrl ?? "");
  const [trackingNumber, setTrackingNumber] = useState(initial.trackingNumber ?? "");
  const [dispatchedAt, setDispatchedAt] = useState(toDatetimeLocalValue(initial.dispatchedAt));
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch(`/api/admin/jobs/${jobId}/delivery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: provider || null,
          trackingUrl: trackingUrl.trim() || null,
          trackingNumber: trackingNumber.trim() || null,
          dispatchedAt: fromDatetimeLocalValue(dispatchedAt),
          notes: notes.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "บันทึกไม่สำเร็จ");
      }
      setMessage("บันทึกแล้ว ✓ ลูกค้าเห็น tracking ในหน้า status ทันที");
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
          <span className="text-slate-700">ผู้ให้บริการขนส่ง</span>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            {PROVIDER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-slate-700">วันเวลาออกจากร้าน</span>
          <input
            type="datetime-local"
            value={dispatchedAt}
            onChange={(e) => setDispatchedAt(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          />
        </label>
      </div>

      <label className="grid gap-1 text-sm">
        <span className="text-slate-700">Tracking URL</span>
        <input
          type="url"
          value={trackingUrl}
          onChange={(e) => setTrackingUrl(e.target.value)}
          placeholder="เช่น https://www.lalamove.com/track/..."
          maxLength={2000}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
        />
      </label>

      <label className="grid gap-1 text-sm">
        <span className="text-slate-700">เลขพัสดุ / Booking number</span>
        <input
          type="text"
          value={trackingNumber}
          onChange={(e) => setTrackingNumber(e.target.value)}
          placeholder="เช่น THE0123456789 หรือ LM12345"
          maxLength={200}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
        />
      </label>

      <label className="grid gap-1 text-sm">
        <span className="text-slate-700">หมายเหตุ</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          maxLength={1000}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          placeholder="เช่น พัสดุชิ้นใหญ่ระวังการเปิด, ส่งช่วงเย็น"
        />
      </label>

      <button
        type="button"
        onClick={submit}
        disabled={loading}
        className="rounded-full bg-[#1a1a2e] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#16213e] disabled:opacity-50"
      >
        {loading ? "กำลังบันทึก..." : "บันทึกข้อมูลส่ง"}
      </button>

      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
    </div>
  );
}
