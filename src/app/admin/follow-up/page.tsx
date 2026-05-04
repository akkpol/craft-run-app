"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatBangkokDateTime } from "@/lib/bangkok-date-time";
import { getAdminQueueContract } from "@/lib/admin-queue-contract";

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

type FollowUpPreview = {
  idleHours: number;
  totalCount: number;
  queueCounts: Record<"quote-decision" | "customer-waiting", number>;
  conversations: Array<{
    id: string;
    state: string;
    lineUserId: string;
    lastMessageAt: string;
    queueKey: "quote-decision" | "customer-waiting";
    queueLabel: string;
  }>;
};

const STATE_LABELS: Record<string, string> = {
  WAITING_QUOTE_APPROVAL: "รออนุมัติใบเสนอราคา",
  ON_HOLD_CUSTOMER_INPUT: "รอข้อมูลลูกค้า",
};

const quoteDecisionQueue = getAdminQueueContract("quote-decision");
const customerWaitingQueue = getAdminQueueContract("customer-waiting");

function formatQueueLabel(state: string) {
  return STATE_LABELS[state] ?? state;
}

export default function FollowUpPage() {
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [preview, setPreview] = useState<FollowUpPreview | null>(null);
  const [result, setResult] = useState<FollowUpResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPreview() {
      setPreviewLoading(true);
      setPreviewError(null);

      try {
        const res = await fetch("/api/admin/follow-up", { method: "GET" });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error ?? "Unknown error");
        }

        if (!cancelled) {
          setPreview(data as FollowUpPreview);
        }
      } catch (err) {
        if (!cancelled) {
          setPreviewError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) {
          setPreviewLoading(false);
        }
      }
    }

    void loadPreview();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleTrigger() {
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/follow-up", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unknown error");
      setResult(data as FollowUpResult);
      setConfirmed(false);
      setPreviewError(null);
      setPreviewLoading(true);
      const previewRes = await fetch("/api/admin/follow-up", { method: "GET" });
      const previewData = await previewRes.json();
      if (previewRes.ok) {
        setPreview(previewData as FollowUpPreview);
      }
      setPreviewLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPreviewLoading(false);
    } finally {
      setLoading(false);
    }
  }

  const totalCount = preview?.totalCount ?? 0;
  const canSend = Boolean(preview && totalCount > 0 && confirmed && !loading && !previewLoading);

  return (
    <div className="admin-shell min-h-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="mx-auto max-w-4xl">
          <Link
            href="/admin"
            className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
          >
            ← กลับแดชบอร์ด
          </Link>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">
            {customerWaitingQueue.ownerLabel}
          </p>
          <h1 className="text-xl font-bold text-slate-900">{customerWaitingQueue.label} Follow-up</h1>
          <p className="mt-1 text-sm text-slate-500">
            ส่ง LINE push message ให้ลูกค้าที่ค้างนานกว่า {preview?.idleHours ?? 24} ชั่วโมงในคิว {quoteDecisionQueue.label} และ {customerWaitingQueue.label}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="admin-panel space-y-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">ทั้งหมด</p>
              <p className="mt-1 text-2xl font-semibold text-slate-950">
                {previewLoading ? "…" : totalCount}
              </p>
            </div>
            <div className="rounded-[18px] border border-violet-100 bg-violet-50/80 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-500">
                {quoteDecisionQueue.label}
              </p>
              <p className="mt-1 text-2xl font-semibold text-violet-900">
                {previewLoading ? "…" : preview?.queueCounts["quote-decision"] ?? 0}
              </p>
            </div>
            <div className="rounded-[18px] border border-blue-100 bg-blue-50/80 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-500">
                {customerWaitingQueue.label}
              </p>
              <p className="mt-1 text-2xl font-semibold text-blue-900">
                {previewLoading ? "…" : preview?.queueCounts["customer-waiting"] ?? 0}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Quote decision</p>
              <p className="mt-1 font-medium text-slate-950">{quoteDecisionQueue.description}</p>
            </div>
            <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Customer waiting</p>
              <p className="mt-1 font-medium text-slate-950">{customerWaitingQueue.description}</p>
            </div>
          </div>

          {previewError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              โหลด preview ไม่สำเร็จ: {previewError}
            </div>
          ) : null}

          <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
            <strong>หมายเหตุ:</strong> หน้านี้จะแสดง recipient preview ก่อนส่งเสมอ และปุ่มส่งจะปลดล็อกเมื่อคุณยืนยันว่าตรวจจำนวนและแยกคิวแล้ว
          </div>

          <label className="flex items-start gap-3 rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              className="mt-1 size-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
            />
            <span>
              ฉันตรวจ preview แล้ว และยืนยันว่าต้องการส่ง follow-up ให้เฉพาะรายชื่อที่แสดงด้านบน
            </span>
          </label>

          <button
            onClick={handleTrigger}
            disabled={!canSend}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <>
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                กำลังส่ง…
              </>
            ) : (
              `ส่ง Follow-up ${totalCount > 0 ? `${totalCount} ราย` : ""}`.trim()
            )}
          </button>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              เกิดข้อผิดพลาด: {error}
            </div>
          )}

          {preview && preview.conversations.length > 0 && (
            <div className="space-y-3 rounded-[20px] border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 font-medium text-violet-700">
                  {quoteDecisionQueue.label}: {preview.queueCounts["quote-decision"]}
                </span>
                <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 font-medium text-blue-700">
                  {customerWaitingQueue.label}: {preview.queueCounts["customer-waiting"]}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs font-medium text-slate-500">
                      <th className="pb-2 pr-4">Queue</th>
                      <th className="pb-2 pr-4">LINE User ID</th>
                      <th className="pb-2 pr-4">อัปเดตล่าสุด</th>
                      <th className="pb-2">สถานะ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {preview.conversations.map((item) => (
                      <tr key={item.id}>
                        <td className="py-2 pr-4 text-slate-700">{item.queueLabel}</td>
                        <td className="py-2 pr-4 font-mono text-xs text-slate-500">{item.lineUserId}</td>
                        <td className="py-2 pr-4 text-slate-600">{formatBangkokDateTime(item.lastMessageAt)}</td>
                        <td className="py-2">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                            {formatQueueLabel(item.state)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {preview && preview.totalCount === 0 && !previewLoading && !previewError && (
            <p className="text-sm text-slate-500">
              ✅ ไม่มีลูกค้าที่ค้างนานเกิน {preview.idleHours} ชั่วโมงในขณะนี้
            </p>
          )}

          {result && (
            <div className="space-y-4">
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

              {result.conversations.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-left text-xs font-medium text-slate-500">
                        <th className="pb-2 pr-4">Queue</th>
                        <th className="pb-2 pr-4">LINE User ID</th>
                        <th className="pb-2">ผล</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {result.conversations.map((c) => (
                        <tr key={c.id}>
                          <td className="py-2 pr-4 text-slate-700">
                            {c.state === "WAITING_QUOTE_APPROVAL"
                              ? quoteDecisionQueue.label
                              : c.state === "ON_HOLD_CUSTOMER_INPUT"
                                ? customerWaitingQueue.label
                                : STATE_LABELS[c.state] ?? c.state}
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
