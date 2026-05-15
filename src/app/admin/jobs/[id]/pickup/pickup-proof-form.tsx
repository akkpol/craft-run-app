"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  jobId: string;
  defaultRecipientName: string | null;
  defaultRecipientPhone: string | null;
};

export function PickupProofForm({
  jobId,
  defaultRecipientName,
  defaultRecipientPhone,
}: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [recipientName, setRecipientName] = useState(defaultRecipientName ?? "");
  const [recipientPhone, setRecipientPhone] = useState(defaultRecipientPhone ?? "");
  const [note, setNote] = useState("");
  const [markDone, setMarkDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setMessage(null);

    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("ต้องแนบรูปอย่างน้อย 1 ไฟล์");
      return;
    }
    if (markDone && recipientName.trim().length === 0) {
      setError("กรุณากรอกชื่อผู้รับก่อนปิดงาน");
      return;
    }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (recipientName.trim()) fd.append("recipientName", recipientName.trim());
      if (recipientPhone.trim()) fd.append("recipientPhone", recipientPhone.trim());
      if (note.trim()) fd.append("note", note.trim());
      if (markDone) fd.append("markDone", "1");

      const res = await fetch(`/api/admin/jobs/${jobId}/pickup`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.detail || data?.error || "บันทึกไม่สำเร็จ");
      }

      const lines = [`บันทึกแล้ว ✓ มีหลักฐานทั้งหมด ${data.photoCount ?? "?"} ไฟล์`];
      if (data.autoTransition) {
        lines.push("• fulfillment_status flipped → picked_up");
      }
      setMessage(lines.join("\n"));
      if (fileRef.current) fileRef.current.value = "";
      setNote("");
      setMarkDone(false);
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
          <span className="text-slate-700">
            ชื่อผู้รับ {markDone ? <span className="text-rose-600">*</span> : null}
          </span>
          <input
            type="text"
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            placeholder="เช่น คุณสมชาย ใจดี"
            maxLength={200}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-slate-700">เบอร์ผู้รับ</span>
          <input
            type="tel"
            value={recipientPhone}
            onChange={(e) => setRecipientPhone(e.target.value)}
            placeholder="เช่น 081-234-5678"
            maxLength={50}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          />
        </label>
      </div>

      <label className="grid gap-1 text-sm">
        <span className="text-slate-700">รูปการส่งมอบ (ภาพถ่ายขณะลูกค้ารับสินค้า)</span>
        <input
          type="file"
          ref={fileRef}
          accept="image/*,application/pdf"
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
        />
        <span className="text-[11px] text-slate-500">
          สูงสุด 10MB ต่อไฟล์ — รองรับ jpg/png/webp/heic/pdf
        </span>
      </label>

      <label className="grid gap-1 text-sm">
        <span className="text-slate-700">หมายเหตุ</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          maxLength={500}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          placeholder="เช่น ลูกค้ามาเอง 2 คน รับเรียบร้อย"
        />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={markDone}
          onChange={(e) => setMarkDone(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300"
        />
        <span className="text-slate-800">
          ปิดงาน — flip fulfillment_status เป็น <strong>picked_up</strong> หลังบันทึก
        </span>
      </label>

      <button
        type="button"
        onClick={submit}
        disabled={loading}
        className="rounded-full bg-[#1a1a2e] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#16213e] disabled:opacity-50"
      >
        {loading ? "กำลังบันทึก..." : markDone ? "บันทึกและปิดงาน" : "บันทึกหลักฐาน"}
      </button>

      {message ? (
        <p className="whitespace-pre-line text-sm text-emerald-700">{message}</p>
      ) : null}
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
    </div>
  );
}
