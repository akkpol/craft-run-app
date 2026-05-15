"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Props = { token: string };

export function InstallProofUploader({ token }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [markDone, setMarkDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.files?.[0] ?? null;
    if (!next) return;
    if (next.size > 10 * 1024 * 1024) {
      setError("ไฟล์ใหญ่เกิน 10 MB");
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
      setError("เลือกรูปก่อน");
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (note.trim()) formData.append("note", note.trim());
      if (markDone) formData.append("markDone", "1");
      const res = await fetch(`/api/install/${token}/proof`, {
        method: "POST",
        body: formData,
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error || "อัปโหลดไม่สำเร็จ");
      }
      setMessage(
        markDone
          ? "บันทึกหลักฐาน + ปิดงานแล้ว ✓"
          : `อัปโหลดแล้ว — รวม ${payload.photoCount} รูป`
      );
      setFile(null);
      setNote("");
      setMarkDone(false);
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "อัปโหลดไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        capture="environment"
        onChange={handleFileChange}
        className="block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-sky-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-sky-700"
      />
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="หมายเหตุ (ออปชั่น) เช่น ตำแหน่งติดตั้ง / ปัญหา"
        rows={2}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-400"
      />
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={markDone}
          onChange={(e) => setMarkDone(e.target.checked)}
          className="size-4"
        />
        <span>ติดตั้งเสร็จแล้ว ปิดงาน</span>
      </label>
      <button
        type="button"
        onClick={submit}
        disabled={loading || !file}
        className="w-full rounded-full bg-sky-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-950 disabled:opacity-40"
      >
        {loading ? "กำลังอัปโหลด..." : markDone ? "ส่งหลักฐาน + ปิดงาน" : "ส่งหลักฐาน"}
      </button>

      {message ? (
        <p className="rounded-xl bg-emerald-100 px-3 py-2 text-sm text-emerald-800">{message}</p>
      ) : null}
      {error ? (
        <p className="rounded-xl bg-rose-100 px-3 py-2 text-sm text-rose-800">{error}</p>
      ) : null}
    </div>
  );
}
