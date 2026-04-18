"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  quoteToken: string;
  canResolveHold: boolean;
  canApproveDesign: boolean;
};

export default function CustomerStatusActions({
  quoteToken,
  canResolveHold,
  canApproveDesign,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  async function submitAction(
    action:
      | "resolve_hold"
      | "approve_design"
      | "request_design_revision"
  ) {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/quotes/public/${quoteToken}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error || "ดำเนินการไม่สำเร็จ");
        return;
      }

      setMessage(payload.message || "อัปเดตเรียบร้อย");
      setNote("");
      router.refresh();
    } catch {
      setError("ดำเนินการไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div>
        <p className="text-sm font-semibold text-slate-900">ตอบกลับทีมงานจากหน้านี้</p>
        <p className="mt-1 text-xs text-slate-500">
          ใส่รายละเอียดเพิ่มได้ถ้าต้องการให้ทีมงานปรับแบบหรือปลด hold ต่อได้เร็วขึ้น
        </p>
      </div>

      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        rows={3}
        placeholder="เช่น เปลี่ยนสีพื้นหลังเป็นโทนเข้ม หรือได้แนบข้อมูลเพิ่มแล้ว"
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-slate-400"
      />

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}

      <div className="grid gap-2 sm:grid-cols-3">
        {canResolveHold ? (
          <button
            type="button"
            disabled={loading}
            onClick={() => submitAction("resolve_hold")}
            className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm font-medium text-amber-800 transition hover:border-amber-300 disabled:opacity-50"
          >
            ส่งข้อมูลเพิ่มแล้ว
          </button>
        ) : null}

        {canApproveDesign ? (
          <button
            type="button"
            disabled={loading}
            onClick={() => submitAction("approve_design")}
            className="rounded-xl bg-[#1a1a2e] px-3 py-2 text-sm font-medium text-white transition hover:bg-[#16213e] disabled:opacity-50"
          >
            อนุมัติแบบ
          </button>
        ) : null}

        {canApproveDesign ? (
          <button
            type="button"
            disabled={loading}
            onClick={() => submitAction("request_design_revision")}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 disabled:opacity-50"
          >
            ขอแก้แบบ
          </button>
        ) : null}
      </div>
    </div>
  );
}