"use client";

import { useState } from "react";
import Link from "next/link";

type FollowUpResult = {
  sent: number;
  skipped: number;
  errors: number;
  conversations: Array<{
    id: string;
    state: string;
    lineUserId: string;
    result: string;
  }>;
};

const STATE_LABELS: Record<string, string> = {
  WAITING_QUOTE_APPROVAL: "รออนุมัติใบเสนอราคา",
  ON_HOLD_CUSTOMER_INPUT: "รอข้อมูลลูกค้า",
};

export default function FollowUpPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FollowUpResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleTrigger() {
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/follow-up", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unknown error");
      setResult(data as FollowUpResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-shell min-h-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="mx-auto max-w-2xl">
          <Link
            href="/admin"
            className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
          >
            ← กลับแดชบอร์ด
          </Link>
          <h1 className="text-xl font-bold text-slate-900">Follow-up อัตโนมัติ</h1>
          <p className="mt-1 text-sm text-slate-500">
            ส่ง LINE push message ให้ลูกค้าที่ค้างนานกว่า 24 ชั่วโมงใน
            states: รออนุมัติใบเสนอราคา, รอข้อมูลลูกค้า
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <div className="admin-panel space-y-6">
          <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
            <strong>หมายเหตุ:</strong> ระบบจะส่งข้อความผ่าน LINE ไปยังลูกค้าทุกคนที่ค้างอยู่นาน
            เกิน 24 ชั่วโมงใน states ดังกล่าว ตรวจสอบก่อนกดทุกครั้ง
          </div>

          <button
            onClick={handleTrigger}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <>
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                กำลังส่ง…
              </>
            ) : (
              "ส่ง Follow-up ทันที"
            )}
          </button>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              เกิดข้อผิดพลาด: {error}
            </div>
          )}

          {result && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4">
                <div className="admin-kpi-card text-center">
                  <p className="text-xs text-slate-500">ส่งสำเร็จ</p>
                  <p className="mt-1 text-2xl font-bold text-emerald-600">{result.sent}</p>
                </div>
                <div className="admin-kpi-card text-center">
                  <p className="text-xs text-slate-500">ข้าม</p>
                  <p className="mt-1 text-2xl font-bold text-slate-500">{result.skipped}</p>
                </div>
                <div className="admin-kpi-card text-center">
                  <p className="text-xs text-slate-500">ผิดพลาด</p>
                  <p className="mt-1 text-2xl font-bold text-rose-500">{result.errors}</p>
                </div>
              </div>

              {/* Detail list */}
              {result.conversations.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-left text-xs font-medium text-slate-500">
                        <th className="pb-2 pr-4">State</th>
                        <th className="pb-2 pr-4">LINE User ID</th>
                        <th className="pb-2">ผล</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {result.conversations.map((c) => (
                        <tr key={c.id}>
                          <td className="py-2 pr-4 text-slate-700">
                            {STATE_LABELS[c.state] ?? c.state}
                          </td>
                          <td className="py-2 pr-4 font-mono text-xs text-slate-500">
                            {c.lineUserId}
                          </td>
                          <td className="py-2">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                c.result === "sent"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : c.result.startsWith("error")
                                  ? "bg-rose-100 text-rose-700"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {c.result === "sent" ? "ส่งแล้ว" : c.result}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {result.sent === 0 && result.skipped === 0 && result.errors === 0 && (
                <p className="text-sm text-slate-500">
                  ✅ ไม่มีลูกค้าที่ค้างนานเกิน 24 ชั่วโมงในขณะนี้
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
