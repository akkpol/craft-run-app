"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  token: string;
};

export function QuotePaymentSlipUploader({ token }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0] ?? null;
    if (!next) return;
    if (next.size > 5 * 1024 * 1024) {
      setError("ไฟล์ใหญ่เกิน 5 MB");
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setError(null);
    setMessage(null);
    setFile(next);
  }

  async function submit() {
    if (!file) {
      setError("เลือกไฟล์สลิปก่อน");
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (note.trim()) formData.append("note", note.trim());
      const res = await fetch(`/api/quotes/${token}/slip`, {
        method: "POST",
        body: formData,
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error || "อัปโหลดสลิปไม่สำเร็จ");
      }
      setMessage("ส่งสลิปให้ทีมงานตรวจสอบแล้ว — ทีมจะยืนยันภายในไม่นาน");
      setFile(null);
      setNote("");
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "อัปโหลดสลิปไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-3 rounded-2xl border border-sky-200 bg-sky-50/70 px-4 py-3 text-sm">
      <p className="font-semibold text-sky-950">📎 อัปโหลดสลิปโอนเงิน</p>
      <p className="mt-1 text-xs leading-relaxed text-sky-900/80">
        หลังโอนแล้ว แนบรูปสลิป (PNG/JPG/PDF ไม่เกิน 5 MB) ที่นี่
        ทีมงานจะตรวจสอบและยืนยันการชำระให้
      </p>

      <div className="mt-3 flex flex-col gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/heic,image/heif,application/pdf"
          onChange={handleFileChange}
          className="w-full rounded-lg border border-sky-200 bg-white px-3 py-2 text-xs file:mr-3 file:rounded-md file:border-0 file:bg-sky-100 file:px-3 file:py-1 file:text-xs file:font-medium file:text-sky-700"
        />
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="หมายเหตุ (ออปชั่น) — เช่น โอนเวลา 14:30 บัญชี กสิกร"
          rows={2}
          className="w-full rounded-lg border border-sky-200 bg-white px-3 py-2 text-xs outline-none focus:border-sky-400"
        />
        <button
          type="button"
          onClick={submit}
          disabled={loading || !file}
          className="self-start rounded-full bg-sky-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-sky-950 disabled:opacity-40"
        >
          {loading ? "กำลังอัปโหลด..." : "ส่งสลิปให้ทีมงาน"}
        </button>
      </div>

      {message ? (
        <p className="mt-2 rounded-md bg-emerald-100 px-3 py-2 text-xs text-emerald-800">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-2 rounded-md bg-rose-100 px-3 py-2 text-xs text-rose-800">
          {error}
        </p>
      ) : null}
    </div>
  );
}
