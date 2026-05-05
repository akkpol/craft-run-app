"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatBangkokDateTime } from "@/lib/bangkok-date-time";
import { getAdminQueueContract } from "@/lib/admin-queue-contract";
import {
  getWorkflowOwnerContract,
  type WorkflowAutomationMode,
  type WorkflowNextActionOwner,
} from "@/lib/workflow-owner-map";
import type { WorkflowState } from "@/lib/workflow-state";
import { cn } from "@/lib/utils";

type FollowUpQueueKey = "quote-decision" | "customer-waiting";

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

type FollowUpPreviewConversation = {
  id: string;
  state: string;
  lineUserId: string;
  lastMessageAt: string;
  queueKey: FollowUpQueueKey;
  queueLabel: string;
};

type FollowUpPreview = {
  idleHours: number;
  totalCount: number;
  queueCounts: Record<FollowUpQueueKey, number>;
  conversations: FollowUpPreviewConversation[];
};

const STATE_LABELS: Record<string, string> = {
  WAITING_QUOTE_APPROVAL: "รออนุมัติใบเสนอราคา",
  ON_HOLD_CUSTOMER_INPUT: "รอข้อมูลลูกค้า",
};

const FOLLOW_UP_STOP_REASON_COPY: Record<WorkflowState, string> = {
  NEW_MESSAGE: "ข้อความแรกเข้ามาแล้ว แต่ระบบยังไม่ควรส่ง follow-up จากหน้านี้",
  COLLECTING_REQUIREMENTS: "ลูกค้ายังอยู่ในช่วงกรอก requirement; follow-up หน้านี้ยังไม่ใช่ด่านหลัก",
  REQUIREMENTS_REVIEW: "ระบบกำลังประเมิน requirement; ถ้าติดจริงจะเปลี่ยนไป queue อื่น",
  WAITING_QUOTE_APPROVAL: "ลูกค้ายังไม่ตัดสินใจ quote หรือยังไม่ได้ตอบกลับหลังเห็นราคา",
  WAITING_PAYMENT: "ยังติด payment gate; หน้านี้ไม่ควรใช้ตาม payment",
  IN_DESIGN: "งานอยู่ใน design loop; follow-up นี้ใช้เฉพาะตอนรอลูกค้าตอบกลับ",
  IN_PRODUCTION: "งานอยู่หน้างานผลิต; ไม่ใช่ recipient ของ follow-up automation นี้",
  READY_FOR_FULFILLMENT: "งานพร้อมส่งมอบ; follow-up นี้ไม่ใช่ surface หลัก",
  ON_HOLD_CUSTOMER_INPUT: "ทีมกำลังรอข้อมูล, revision detail หรือ feedback เพิ่มจากลูกค้า",
  HUMAN_REVIEW_REQUIRED: "เคสนี้ต้องมีคนรีวิวโดยตรง ไม่ควรยิง follow-up อัตโนมัติ",
  COMPLETED: "งานปิดแล้ว ไม่ควรอยู่ใน recipient preview",
  CANCELLED: "งานยกเลิกแล้ว ไม่ควรอยู่ใน recipient preview",
};

const FOLLOW_UP_AUTOMATION_MODE_LABELS: Record<WorkflowAutomationMode, string> = {
  auto_run: "ระบบกำลังวิ่งเอง",
  customer_waiting: "รอลูกค้าตอบ",
  human_gate: "ต้องมีคนปล่อยงาน",
  terminal: "สถานะปิดแล้ว",
};

const FOLLOW_UP_NEXT_ACTION_LABELS: Record<WorkflowNextActionOwner, string> = {
  system: "ระบบ",
  customer: "ลูกค้า",
  internal: "ทีมงาน",
  none: "ไม่มี action ต่อ",
};

const FOLLOW_UP_QUEUE_VISUALS: Record<
  FollowUpQueueKey,
  {
    panelClassName: string;
    badgeClassName: string;
    countClassName: string;
    signalClassName: string;
  }
> = {
  "quote-decision": {
    panelClassName: "border-violet-200 bg-violet-50/70",
    badgeClassName: "border-violet-200 bg-violet-100 text-violet-800",
    countClassName: "text-violet-900",
    signalClassName: "border-violet-200 bg-white text-violet-700",
  },
  "customer-waiting": {
    panelClassName: "border-sky-200 bg-sky-50/70",
    badgeClassName: "border-sky-200 bg-sky-100 text-sky-800",
    countClassName: "text-sky-900",
    signalClassName: "border-sky-200 bg-white text-sky-700",
  },
};

const RESULT_BADGE_CLASSNAMES = {
  sent: "border-emerald-200 bg-emerald-100 text-emerald-700",
  skipped: "border-slate-200 bg-slate-100 text-slate-600",
  error: "border-rose-200 bg-rose-100 text-rose-700",
} as const;

const quoteDecisionQueue = getAdminQueueContract("quote-decision");
const customerWaitingQueue = getAdminQueueContract("customer-waiting");

function formatQueueLabel(state: string) {
  return STATE_LABELS[state] ?? state;
}

function toFollowUpWorkflowState(value: string): WorkflowState | null {
  return value === "WAITING_QUOTE_APPROVAL" || value === "ON_HOLD_CUSTOMER_INPUT"
    ? value
    : null;
}

function getFollowUpContract(state: string) {
  const workflowState = toFollowUpWorkflowState(state);
  return workflowState ? getWorkflowOwnerContract(workflowState) : null;
}

function getPreviewItemsForQueue(
  preview: FollowUpPreview | null,
  queueKey: FollowUpQueueKey
) {
  return preview?.conversations.filter((item) => item.queueKey === queueKey) ?? [];
}

function getResultBadgeClassName(result: string) {
  if (result === "sent") {
    return RESULT_BADGE_CLASSNAMES.sent;
  }

  if (result.startsWith("error")) {
    return RESULT_BADGE_CLASSNAMES.error;
  }

  return RESULT_BADGE_CLASSNAMES.skipped;
}

function getResultLabel(result: string) {
  if (result === "sent") {
    return "ส่งแล้ว";
  }

  if (result === "skipped") {
    return "ข้าม";
  }

  return result;
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
          <h1 className="text-xl font-bold text-slate-900">Follow-up Control Surface</h1>
          <p className="mt-1 text-sm text-slate-500">
            surface นี้ใช้ตามลูกค้าที่ค้างนานกว่า {preview?.idleHours ?? 24} ชั่วโมงในคิว {quoteDecisionQueue.label} และ {customerWaitingQueue.label} โดยยังไม่แตะ workflow เองจนกว่าคุณจะยืนยันการส่ง
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-700">
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
              owner {customerWaitingQueue.ownerLabel}
            </span>
            <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-violet-800">
              {quoteDecisionQueue.label}
            </span>
            <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-sky-800">
              {customerWaitingQueue.label}
            </span>
          </div>
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
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Quote decision lane</p>
              <p className="mt-1 font-medium text-slate-950">{quoteDecisionQueue.description}</p>
            </div>
            <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Customer waiting lane</p>
              <p className="mt-1 font-medium text-slate-950">{customerWaitingQueue.description}</p>
            </div>
          </div>

          {previewError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              โหลด preview ไม่สำเร็จ: {previewError}
            </div>
          ) : null}

          <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
            <strong>หมายเหตุ:</strong> หน้านี้จะแสดง recipient preview ก่อนส่งเสมอ และปุ่มส่งจะปลดล็อกเมื่อคุณยืนยันว่าตรวจ owner lane, stop reason และจำนวน recipient แล้ว
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
            <div className="space-y-4">
              {(["quote-decision", "customer-waiting"] as const).map((queueKey) => {
                const items = getPreviewItemsForQueue(preview, queueKey);

                if (items.length === 0) {
                  return null;
                }

                const queue = getAdminQueueContract(queueKey);
                const visuals = FOLLOW_UP_QUEUE_VISUALS[queueKey];

                return (
                  <section
                    key={queueKey}
                    className={cn("rounded-[24px] border p-4 shadow-sm", visuals.panelClassName)}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="max-w-2xl space-y-2">
                        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                          <span className={cn("rounded-full border px-3 py-1", visuals.badgeClassName)}>
                            {queue.label}
                          </span>
                          <span className="rounded-full border border-white/80 bg-white/70 px-3 py-1 text-slate-600">
                            owner {queue.ownerLabel}
                          </span>
                          <span className="rounded-full border border-white/80 bg-white/70 px-3 py-1 text-slate-600">
                            next action {queue.nextActionOwner === "customer" ? "ลูกค้า" : "ทีมงาน"}
                          </span>
                        </div>
                        <div>
                          <h2 className="text-lg font-semibold text-slate-950">{queue.label}</h2>
                          <p className="mt-1 text-sm leading-6 text-slate-600">{queue.description}</p>
                        </div>
                      </div>
                      <div className="rounded-[18px] border border-white/80 bg-white/80 px-4 py-3 text-right shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">recipient</p>
                        <p className={cn("mt-1 text-2xl font-semibold", visuals.countClassName)}>{items.length}</p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
                      {items.map((item) => {
                        const contract = getFollowUpContract(item.state);

                        return (
                          <article
                            key={item.id}
                            className="rounded-[20px] border border-white/90 bg-white/90 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.06)]"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={cn("rounded-full border px-3 py-1 text-xs font-semibold", visuals.signalClassName)}>
                                {formatQueueLabel(item.state)}
                              </span>
                              {contract ? (
                                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                                  {FOLLOW_UP_AUTOMATION_MODE_LABELS[contract.automationMode]}
                                </span>
                              ) : null}
                            </div>

                            <div className="mt-3 space-y-3">
                              <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">LINE recipient</p>
                                <p className="mt-1 break-all font-mono text-xs text-slate-600">{item.lineUserId}</p>
                              </div>

                              <div className="grid gap-2 sm:grid-cols-2">
                                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-3">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">อัปเดตล่าสุด</p>
                                  <p className="mt-1 text-sm font-medium text-slate-900">{formatBangkokDateTime(item.lastMessageAt)}</p>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-3">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">owner / next action</p>
                                  <p className="mt-1 text-sm font-medium text-slate-900">
                                    {contract?.ownerLabel || queue.ownerLabel}
                                  </p>
                                  <p className="mt-1 text-xs text-slate-500">
                                    ต่อไป: {FOLLOW_UP_NEXT_ACTION_LABELS[contract?.nextActionOwner || queue.nextActionOwner]}
                                  </p>
                                </div>
                              </div>

                              <div className="rounded-[18px] border border-slate-200 bg-white px-3 py-3">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">หยุดเพราะ</p>
                                <p className="mt-1 text-sm font-medium text-slate-900">
                                  {FOLLOW_UP_STOP_REASON_COPY[toFollowUpWorkflowState(item.state) || "NEW_MESSAGE"]}
                                </p>
                                {contract ? (
                                  <p className="mt-2 text-xs leading-5 text-slate-500">{contract.summary}</p>
                                ) : null}
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          )}

          {preview && preview.totalCount === 0 && !previewLoading && !previewError && (
            <div className="rounded-[20px] border border-emerald-200 bg-emerald-50/70 p-4 text-sm text-emerald-800">
              ไม่มีลูกค้าที่ค้างนานเกิน {preview.idleHours} ชั่วโมงในขณะนี้
            </div>
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
                <div className="grid gap-3 lg:grid-cols-2">
                  {result.conversations.map((conversation) => {
                    const queueKey =
                      conversation.state === "WAITING_QUOTE_APPROVAL"
                        ? "quote-decision"
                        : conversation.state === "ON_HOLD_CUSTOMER_INPUT"
                          ? "customer-waiting"
                          : null;
                    const queue = queueKey ? getAdminQueueContract(queueKey) : null;

                    return (
                      <article
                        key={conversation.id}
                        className="rounded-[18px] border border-slate-200 bg-white px-4 py-4 shadow-sm"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                            {queue?.label || formatQueueLabel(conversation.state)}
                          </span>
                          <span
                            className={cn(
                              "rounded-full border px-3 py-1 text-xs font-semibold",
                              getResultBadgeClassName(conversation.result)
                            )}
                          >
                            {getResultLabel(conversation.result)}
                          </span>
                        </div>

                        <p className="mt-3 break-all font-mono text-xs text-slate-500">
                          {conversation.lineUserId}
                        </p>
                        <p className="mt-2 text-sm text-slate-600">
                          {queue ? `${queue.ownerLabel} รับรู้ผลการส่งแล้ว` : "บันทึกผลการส่ง follow-up"}
                        </p>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
