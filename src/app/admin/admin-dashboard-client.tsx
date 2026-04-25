"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  AlertTriangle,
  Archive,
  ArrowRight,
  CircleDashed,
  Factory,
  Inbox,
  Layers3,
  MessageSquareMore,
  Sparkles,
  WalletCards,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn, firstRow } from "@/lib/utils";
import { isTerminalConversationState } from "@/lib/workflow-transitions";
import { getDesignQueueLeads } from "@/lib/admin-dashboard-queues";
import {
  DESIGN_STATUS_LABELS,
  JOB_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_TERM_LABELS,
  PRODUCT_TYPES,
  WORKFLOW_STATE_LABELS,
} from "@/lib/types";
import type {
  BackofficeSnapshot,
  SnapshotConversation,
  SnapshotEscalation,
  SnapshotLead,
  SnapshotProductionEvent,
  SnapshotQuote,
} from "@/lib/backoffice-snapshot";
import { PRODUCTION_EVENT_TYPE_LABELS } from "@/lib/production-review";

import AdminConversationActions from "./conversation-actions";
import AdminJobActions from "./job-actions";
import LeadAiPreviewActions from "./lead-ai-preview-actions";
import AdminLeadDesignActions from "./lead-design-actions";
import ProductionLinkCopy from "./production-link-copy";
import ProductionReviewActions from "./production-review-actions";
import AdminQuoteActions from "./quote-actions";

type DashboardKpis = {
  leadsCount: number;
  quotesWaitingApproval: number;
  activeJobsCount: number;
  escalationsCount: number;
  blockedCount: number;
};

type AdminView = "overview" | "sales" | "design" | "production" | "inbox";

type DashboardProps = {
  baseUrl: string;
  kpis: DashboardKpis;
  snapshot: BackofficeSnapshot;
};

const VIEW_ORDER: Array<{
  key: AdminView;
  label: string;
  icon: typeof Layers3;
  description: string;
}> = [
  { key: "overview", label: "Overview", icon: Layers3, description: "คิวหลักทั้งหมด" },
  { key: "sales", label: "Sales", icon: WalletCards, description: "quotes และงานขาย" },
  { key: "design", label: "Design", icon: Sparkles, description: "คิวแบบและการอนุมัติ" },
  { key: "production", label: "Production", icon: Factory, description: "รีวิวหลักฐานและงานผลิต" },
  { key: "inbox", label: "Inbox", icon: Inbox, description: "escalations และ workflow ที่ติดค้าง" },
];

const QUOTE_STATUS_LABELS: Record<string, string> = {
  draft: "ร่างใบเสนอราคา",
  sent: "รอลูกค้าอนุมัติ",
  approved: "อนุมัติแล้ว",
  rejected: "ปฏิเสธแล้ว",
  expired: "หมดอายุ",
};

const LEAD_STATUS_LABELS: Record<string, string> = {
  new: "ต้องจัดการ",
  quoted: "ออกใบเสนอราคาแล้ว",
  approved: "อนุมัติแล้ว",
  in_progress: "กำลังดำเนินงาน",
  completed: "เสร็จสมบูรณ์",
  cancelled: "ยกเลิก",
  superseded: "ถูกแทนที่",
};

const REVIEW_STATUS_LABELS: Record<string, string> = {
  pending: "รอตรวจ",
  approved: "อนุมัติแล้ว",
  rejected: "ตีกลับ",
  sent: "ส่งให้ลูกค้าแล้ว",
};

type SignalTone = "neutral" | "info" | "success" | "warning" | "danger";

type SignalPillItem = {
  label: string;
  tone?: SignalTone;
};

type SummaryStripItem = {
  label: string;
  value: number;
  hint: string;
  tone?: SignalTone;
};

function compactPills(items: Array<SignalPillItem | null | undefined | false>) {
  return items.filter((item): item is SignalPillItem => Boolean(item));
}

function formatCurrency(value: number | string) {
  return `฿${Number(value).toLocaleString()}`;
}

function formatLeadDimensions(
  lead: Pick<SnapshotLead, "width_mm" | "height_mm" | "qty">
) {
  return `${(lead.width_mm / 10).toFixed(0)}×${(lead.height_mm / 10).toFixed(0)} ซม. × ${lead.qty}`;
}

function truncateText(value: string | null | undefined, maxLength = 120) {
  if (!value) {
    return null;
  }

  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1)}...`;
}

function getToneClass(tone: SignalTone = "neutral") {
  if (tone === "success") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (tone === "warning") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (tone === "danger") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  if (tone === "info") {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }

  return "border-slate-200 bg-white text-slate-600";
}

function getProductLabel(productType: string | null | undefined) {
  return PRODUCT_TYPES.find((product) => product.value === productType)?.label || productType || "ไม่ระบุ";
}

function getLeadStatusLabel(status: string) {
  return LEAD_STATUS_LABELS[status] || status;
}

function getQuoteStatusLabel(status: string) {
  return QUOTE_STATUS_LABELS[status] || status;
}

function getReviewStatusLabel(status: string) {
  return REVIEW_STATUS_LABELS[status] || status;
}

function statusToneClass(status: string) {
  if (["approved", "completed", "sent"].includes(status)) {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }

  if (["pending", "WAITING_PAYMENT", "ON_HOLD_CUSTOMER_INPUT", "revision_requested"].includes(status)) {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }

  if (["IN_PRODUCTION", "WAITING_QUOTE_APPROVAL", "preview_sent"].includes(status)) {
    return "bg-blue-50 text-blue-700 border-blue-200";
  }

  if (["IN_DESIGN", "drafting", "not_started"].includes(status)) {
    return "bg-violet-50 text-violet-700 border-violet-200";
  }

  if (["HUMAN_REVIEW_REQUIRED", "rejected", "CANCELLED", "cancelled", "expired"].includes(status)) {
    return "bg-rose-50 text-rose-700 border-rose-200";
  }

  return "bg-slate-100 text-slate-700 border-slate-200";
}

function customerName(value: { display_name: string | null } | null | undefined) {
  return value?.display_name || "ลูกค้า";
}

function getConversationBundle(snapshot: BackofficeSnapshot, conversationId: string) {
  const lead = snapshot.leads.find((candidate) => candidate.conversation_id === conversationId) || null;
  const quote = snapshot.quotes.find((candidate) => candidate.leads?.conversation_id === conversationId) || null;
  const job = snapshot.jobs.find((candidate) => candidate.quotes?.leads?.conversation_id === conversationId) || null;
  return { lead, quote, job };
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleString("th-TH");
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleDateString("th-TH");
}

function formatTrackingCode(token: string | null | undefined) {
  if (!token) {
    return "-";
  }

  if (token.length <= 12) {
    return token.toUpperCase();
  }

  return `${token.slice(0, 6).toUpperCase()}-${token.slice(-4).toUpperCase()}`;
}

function SurfaceSection({
  title,
  description,
  count,
  children,
  action,
}: {
  title: string;
  description: string;
  count?: number;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-cyan-100/80 bg-white/95 p-4 shadow-[0_16px_42px_rgba(0,62,93,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
            {typeof count === "number" ? (
              <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">
                {count} รายการ
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        {action}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function QueueCard({
  title,
  meta,
  badge,
  children,
  footer,
  tone = "default",
}: {
  title: string;
  meta?: string;
  badge?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  tone?: "default" | "warning" | "danger";
}) {
  return (
    <div
      className={cn(
        "rounded-[24px] border p-4 shadow-sm transition-shadow duration-200 hover:shadow-md motion-reduce:transition-none",
        tone === "warning" && "border-amber-200 bg-amber-50/40",
        tone === "danger" && "border-rose-200 bg-rose-50/40",
        tone === "default" && "border-cyan-100 bg-cyan-50/35"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-950">{title}</p>
          {meta ? <p className="mt-1 text-xs text-slate-500">{meta}</p> : null}
        </div>
        {badge}
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
      {footer ? <div className="mt-4">{footer}</div> : null}
    </div>
  );
}

type StuckQueueItem =
  | { type: "quote"; quote: SnapshotQuote }
  | { type: "conversation"; conversation: SnapshotConversation };

function StuckQueueContent({
  items,
  snapshot,
  baseUrl,
}: {
  items: StuckQueueItem[];
  snapshot: BackofficeSnapshot;
  baseUrl: string;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <>
      <div className="space-y-3 md:hidden">
        {items.map((item) => {
          if (item.type === "quote") {
            const quote = item.quote;
            return (
              <QueueCard
                key={quote.id}
                title={customerName(quote.leads?.customers)}
                meta={`${getProductLabel(quote.leads?.product_type)} · ฿${Number(quote.total).toLocaleString()} · Track ${formatTrackingCode(quote.public_token)}`}
                badge={<Badge className={cn("border", statusToneClass(quote.status))}>{getQuoteStatusLabel(quote.status)}</Badge>}
                footer={
                  <div className="flex items-center justify-between gap-2">
                    <a href={`${baseUrl}/quote/${quote.public_token}`} target="_blank" rel="noreferrer" className="text-xs font-medium text-blue-600 underline underline-offset-4">
                      เปิด quote
                    </a>
                    <AdminQuoteActions
                      quoteId={quote.id}
                      publicToken={quote.public_token}
                      quoteStatus={quote.status}
                      paymentTerms={quote.payment_terms}
                      paymentStatus={quote.payment_status}
                      hasJob={Array.isArray(quote.jobs) && quote.jobs.length > 0}
                    />
                  </div>
                }
              >
                <p className="text-xs text-slate-500">
                  {PAYMENT_TERM_LABELS[quote.payment_terms]} · {PAYMENT_STATUS_LABELS[quote.payment_status]}
                </p>
              </QueueCard>
            );
          }

          const bundle = getConversationBundle(snapshot, item.conversation.id);
          return (
            <QueueCard
              key={item.conversation.id}
              title={bundle.lead ? customerName(bundle.lead.customers) : `LINE ${item.conversation.line_user_id.slice(0, 12)}...`}
              meta={WORKFLOW_STATE_LABELS[item.conversation.state]}
              badge={<Badge className={cn("border", statusToneClass(item.conversation.state))}>{WORKFLOW_STATE_LABELS[item.conversation.state]}</Badge>}
              footer={
                <div className="flex items-center justify-end gap-2">
                  <AdminConversationActions conversationId={item.conversation.id} currentState={item.conversation.state} compact />
                </div>
              }
            >
              <p className="text-xs text-slate-500">อัปเดตล่าสุด {formatDateTime(item.conversation.last_message_at)}</p>
            </QueueCard>
          );
        })}
      </div>

      <div className="hidden md:block">
        <div className="overflow-x-auto rounded-[20px] border border-slate-200 bg-white">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">รายการ</th>
                <th className="px-4 py-3 font-semibold">สถานะ</th>
                <th className="px-4 py-3 font-semibold">รายละเอียด</th>
                <th className="px-4 py-3 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => {
                if (item.type === "quote") {
                  const quote = item.quote;
                  return (
                    <tr key={quote.id} className="align-top">
                      <td className="px-4 py-3">
                        <p className="text-sm font-semibold text-slate-900">{customerName(quote.leads?.customers)}</p>
                        <p className="mt-1 text-xs text-slate-500">{getProductLabel(quote.leads?.product_type)} · quote</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={cn("border", statusToneClass(quote.status))}>{getQuoteStatusLabel(quote.status)}</Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <p>{formatCurrency(quote.total)}</p>
                        <p className="mt-1">{PAYMENT_TERM_LABELS[quote.payment_terms]} · {PAYMENT_STATUS_LABELS[quote.payment_status]}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <a href={`${baseUrl}/quote/${quote.public_token}`} target="_blank" rel="noreferrer" className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100">
                            เปิด quote
                          </a>
                          <AdminQuoteActions
                            quoteId={quote.id}
                            publicToken={quote.public_token}
                            quoteStatus={quote.status}
                            paymentTerms={quote.payment_terms}
                            paymentStatus={quote.payment_status}
                            hasJob={Array.isArray(quote.jobs) && quote.jobs.length > 0}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                }

                const conversation = item.conversation;
                const bundle = getConversationBundle(snapshot, conversation.id);
                return (
                  <tr key={conversation.id} className="align-top">
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-slate-900">
                        {bundle.lead ? customerName(bundle.lead.customers) : `LINE ${conversation.line_user_id.slice(0, 12)}...`}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">workflow</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={cn("border", statusToneClass(conversation.state))}>{WORKFLOW_STATE_LABELS[conversation.state]}</Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <p>อัปเดตล่าสุด {formatDateTime(conversation.last_message_at)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <AdminConversationActions conversationId={conversation.id} currentState={conversation.state} compact />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function EscalationsQueueContent({ items }: { items: SnapshotEscalation[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <>
      <div className="space-y-3 md:hidden">
        {items.map((esc) => (
          <QueueCard
            key={esc.id}
            title={esc.conversations ? `LINE ${esc.conversations.line_user_id.slice(0, 12)}...` : "ลูกค้า"}
            meta={formatDateTime(esc.created_at)}
            tone="danger"
            badge={<Badge className="border border-rose-200 bg-rose-50 text-rose-700">ต้องตอบตอนนี้</Badge>}
            footer={
              esc.conversations ? (
                <div className="flex justify-end">
                  <AdminConversationActions conversationId={esc.conversations.id} currentState={esc.conversations.state} compact />
                </div>
              ) : null
            }
          >
            <p className="text-sm text-rose-900">{esc.reason}</p>
          </QueueCard>
        ))}
      </div>

      <div className="hidden md:block">
        <div className="overflow-x-auto rounded-[20px] border border-rose-200 bg-white">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-rose-50 text-rose-700">
              <tr>
                <th className="px-4 py-3 font-semibold">ลูกค้า</th>
                <th className="px-4 py-3 font-semibold">เหตุผล</th>
                <th className="px-4 py-3 font-semibold">เวลา</th>
                <th className="px-4 py-3 font-semibold">สถานะ</th>
                <th className="px-4 py-3 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rose-100">
              {items.map((esc) => (
                <tr key={esc.id} className="bg-rose-50/30 align-top">
                  <td className="px-4 py-3">
                    <p className="text-sm font-semibold text-slate-900">
                      {esc.conversations ? `LINE ${esc.conversations.line_user_id.slice(0, 12)}...` : "ลูกค้า"}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-sm text-rose-900">{esc.reason}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDateTime(esc.created_at)}</td>
                  <td className="px-4 py-3">
                    <Badge className="border border-rose-200 bg-rose-50 text-rose-700">ต้องตอบตอนนี้</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {esc.conversations ? (
                      <div className="flex justify-end">
                        <AdminConversationActions
                          conversationId={esc.conversations.id}
                          currentState={esc.conversations.state}
                          compact
                        />
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function ProductionReviewQueueContent({ items }: { items: SnapshotProductionEvent[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <>
      <div className="space-y-3 md:hidden">
        {items.map((event) => {
          const job = firstRow(event.jobs);
          const quote = firstRow(job?.quotes);
          const lead = firstRow(quote?.leads);
          return (
            <QueueCard
              key={event.id}
              title={customerName(lead?.customers)}
              meta={`${PRODUCTION_EVENT_TYPE_LABELS[event.event_type]} · ${formatDateTime(event.created_at)}`}
              badge={<Badge className={cn("border", statusToneClass(event.review_status))}>{getReviewStatusLabel(event.review_status)}</Badge>}
              footer={
                <div className="flex flex-wrap items-center gap-2">
                  <ProductionReviewActions eventId={event.id} reviewStatus={event.review_status} />
                  {event.production_link_url ? <ProductionLinkCopy url={event.production_link_url} compact /> : null}
                </div>
              }
            >
              <p className="text-xs text-slate-500">{event.note || "รอแอดมินตรวจหลักฐานจากหน้างาน"}</p>
            </QueueCard>
          );
        })}
      </div>

      <div className="hidden md:block">
        <div className="overflow-x-auto rounded-[20px] border border-slate-200 bg-white">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">ลูกค้า</th>
                <th className="px-4 py-3 font-semibold">ประเภท</th>
                <th className="px-4 py-3 font-semibold">เวลา</th>
                <th className="px-4 py-3 font-semibold">สถานะ</th>
                <th className="px-4 py-3 font-semibold">หมายเหตุ</th>
                <th className="px-4 py-3 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((event) => {
                const job = firstRow(event.jobs);
                const quote = firstRow(job?.quotes);
                const lead = firstRow(quote?.leads);
                return (
                  <tr key={event.id} className="align-top">
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-slate-900">{customerName(lead?.customers)}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{PRODUCTION_EVENT_TYPE_LABELS[event.event_type]}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDateTime(event.created_at)}</td>
                    <td className="px-4 py-3">
                      <Badge className={cn("border", statusToneClass(event.review_status))}>{getReviewStatusLabel(event.review_status)}</Badge>
                    </td>
                    <td className="max-w-[260px] px-4 py-3 text-slate-600">
                      <p className="line-clamp-2">{event.note || "รอแอดมินตรวจหลักฐานจากหน้างาน"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <ProductionReviewActions eventId={event.id} reviewStatus={event.review_status} />
                        {event.production_link_url ? <ProductionLinkCopy url={event.production_link_url} compact /> : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function EmptyState({ title }: { title: string }) {
  return (
    <div className="rounded-[24px] border border-dashed border-cyan-200 bg-cyan-50/40 px-4 py-8 text-center text-sm text-slate-500">
      {title}
    </div>
  );
}

function SignalPill({ label, tone = "neutral" }: SignalPillItem) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium",
        getToneClass(tone)
      )}
    >
      {label}
    </span>
  );
}

function SignalPillGroup({ items }: { items: SignalPillItem[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, index) => (
        <SignalPill
          key={`${item.label}-${item.tone ?? "neutral"}-${index}`}
          label={item.label}
          tone={item.tone}
        />
      ))}
    </div>
  );
}

function SummaryStrip({ items }: { items: SummaryStripItem[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className={cn(
            "rounded-[24px] border p-4 shadow-sm",
            item.tone === "success" && "border-emerald-200 bg-emerald-50/60",
            item.tone === "warning" && "border-amber-200 bg-amber-50/60",
            item.tone === "danger" && "border-rose-200 bg-rose-50/60",
            item.tone === "info" && "border-sky-200 bg-sky-50/60",
            (!item.tone || item.tone === "neutral") && "border-cyan-100 bg-white"
          )}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            {item.label}
          </p>
          <p
            className={cn(
              "mt-3 text-2xl font-semibold text-slate-950",
              item.tone === "success" && "text-emerald-700",
              item.tone === "warning" && "text-amber-700",
              item.tone === "danger" && "text-rose-700",
              item.tone === "info" && "text-sky-700"
            )}
          >
            {item.value}
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-500">{item.hint}</p>
        </div>
      ))}
    </div>
  );
}

export default function AdminDashboardClient({ baseUrl, kpis, snapshot }: DashboardProps) {
  const [view, setView] = useState<AdminView>("overview");

  const supersededLeads = snapshot.leads.filter((lead) => Boolean(lead.superseded_at));
  const activeLeads = snapshot.leads.filter((lead) => !lead.superseded_at);
  const sentQuotes = snapshot.quotes.filter((quote) => quote.status === "sent");
  const designQueueLeads = getDesignQueueLeads(snapshot);
  const customerWaitingLeads = activeLeads.filter((lead) => {
    const designStatus = lead.design_status || "not_started";
    return designStatus === "preview_sent" || Boolean(lead.hold_reason);
  });
  const productionQueue = snapshot.jobs.filter((job) => ["IN_PRODUCTION", "READY_FOR_FULFILLMENT"].includes(job.status));
  const productionReviewQueue = snapshot.productionReviewQueue;
  const pendingProductionReviewQueue = productionReviewQueue.filter((event) => event.review_status === "pending");
  const approvedProductionReviewQueue = productionReviewQueue.filter((event) => event.review_status === "approved");
  const blockedConversations = snapshot.conversations.filter((conversation) =>
    ["WAITING_PAYMENT", "HUMAN_REVIEW_REQUIRED"].includes(conversation.state)
  );
  const waitingCustomerConversations = snapshot.conversations.filter((conversation) =>
    conversation.state === "ON_HOLD_CUSTOMER_INPUT"
  );
  const waitingPaymentConversations = snapshot.conversations.filter(
    (conversation) => conversation.state === "WAITING_PAYMENT"
  );
  const humanReviewConversations = snapshot.conversations.filter(
    (conversation) => conversation.state === "HUMAN_REVIEW_REQUIRED"
  );
  const inProductionJobs = snapshot.jobs.filter((job) => job.status === "IN_PRODUCTION");
  const readyForFulfillmentJobs = snapshot.jobs.filter(
    (job) => job.status === "READY_FOR_FULFILLMENT"
  );
  const draftDesignLeads = activeLeads.filter((lead) =>
    ["not_started", "drafting"].includes(lead.design_status || "not_started")
  );
  const revisionRequestedLeads = activeLeads.filter(
    (lead) => lead.design_status === "revision_requested"
  );
  const previewSentLeads = activeLeads.filter(
    (lead) => lead.design_status === "preview_sent"
  );
  const approvedDesignLeads = activeLeads.filter(
    (lead) => lead.design_status === "approved"
  );
  const newLeads = activeLeads.filter((lead) => lead.status === "new");
  const quotesWithJobs = snapshot.quotes.filter(
    (quote) => Array.isArray(quote.jobs) && quote.jobs.length > 0
  );
  const escalatedConversationIds = new Set(
    snapshot.escalations.map((escalation) => escalation.conversation_id)
  );
  const urgentConversationIds = new Set(
    [...blockedConversations, ...waitingCustomerConversations].map(
      (conversation) => conversation.id
    )
  );
  const backlogConversations = snapshot.conversations.filter(
    (conversation) =>
      !isTerminalConversationState(conversation.state) &&
      !escalatedConversationIds.has(conversation.id) &&
      !urgentConversationIds.has(conversation.id)
  );

  const triageSections = [
    {
      key: "must-do-now",
      title: "ต้องทำตอนนี้",
      description: "lead หรือคิวแบบที่ยังต้องให้ทีมขยับต่อในทันที",
      count: designQueueLeads.length,
      view: "design" as const,
      items: designQueueLeads.slice(0, 4),
    },
    {
      key: "stuck",
      title: "ติดค้าง",
      description: "quote ที่ยังค้างลูกค้า หรือ workflow ที่รอการแก้ปมจากทีม",
      count: sentQuotes.length + blockedConversations.length,
      view: "sales" as const,
      items: [
        ...sentQuotes.slice(0, 2).map((quote) => ({ type: "quote" as const, quote })),
        ...blockedConversations.slice(0, 2).map((conversation) => ({ type: "conversation" as const, conversation })),
      ],
    },
    {
      key: "waiting-customer",
      title: "รอลูกค้า",
      description: "งานที่ลูกค้าต้องตอบกลับหรือส่งข้อมูลเพิ่มก่อนเดินต่อ",
      count: customerWaitingLeads.length + waitingCustomerConversations.length,
      view: "inbox" as const,
      items: [
        ...customerWaitingLeads.slice(0, 2).map((lead) => ({ type: "lead" as const, lead })),
        ...waitingCustomerConversations.slice(0, 2).map((conversation) => ({ type: "conversation" as const, conversation })),
      ],
    },
    {
      key: "production-review",
      title: "Production review",
      description: "หลักฐานจากหน้างานที่แอดมินต้อง review ก่อนส่งถึงลูกค้า",
      count: pendingProductionReviewQueue.length,
      view: "production" as const,
      items: pendingProductionReviewQueue.slice(0, 4),
    },
    {
      key: "escalations",
      title: "Escalations",
      description: "เคสที่ลูกค้าขอคุยกับทีมโดยตรงหรือระบบต้องให้คนเข้ามาดู",
      count: snapshot.escalations.length,
      view: "inbox" as const,
      items: snapshot.escalations.slice(0, 4),
    },
  ];

  const triageSection = (
    <div className="px-4 py-4">
      <SurfaceSection
        title="Triage จริงของวันนี้"
        description="จัดคิวบนสุดตามงานที่ทีมต้องตัดสินใจหรือขยับทันที ไม่ใช่แค่ preview ว่ามีอะไรอยู่ในระบบ"
      >
        <div className="grid gap-4 xl:grid-cols-5">
          {triageSections.map((section) => (
            <div key={section.key} className="rounded-[26px] border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-950">{section.title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{section.description}</p>
                </div>
                <Badge variant="outline" className="border-slate-200 bg-white text-slate-600">
                  {section.count}
                </Badge>
              </div>

              <div className="mt-4 space-y-3">
                {section.key === "must-do-now"
                  ? (section.items as SnapshotLead[]).map((lead) => (
                      <QueueCard
                        key={lead.id}
                        title={customerName(lead.customers)}
                        meta={`${getProductLabel(lead.product_type)} · ${getLeadStatusLabel(lead.status)}`}
                        badge={<Badge className={cn("border", statusToneClass(lead.design_status || lead.status))}>{DESIGN_STATUS_LABELS[lead.design_status || "not_started"] || getLeadStatusLabel(lead.status)}</Badge>}
                        footer={
                          <div className="flex flex-wrap items-center gap-2">
                            <LeadAiPreviewActions leadId={lead.id} prompt={lead.ai_image_prompt || ""} status={lead.ai_image_status || "not_requested"} />
                            <AdminLeadDesignActions leadId={lead.id} designStatus={lead.design_status || "not_started"} />
                          </div>
                        }
                      >
                        <p className="text-xs text-slate-500">
                          {lead.ai_image_prompt ? "มี AI prompt พร้อมใช้งาน" : "คิวนี้ขยับต่อด้วยทีมออกแบบได้ทันที"}
                        </p>
                      </QueueCard>
                    ))
                  : null}

                {section.key === "stuck" ? (
                  <StuckQueueContent
                    items={section.items as StuckQueueItem[]}
                    snapshot={snapshot}
                    baseUrl={baseUrl}
                  />
                ) : null}

                {section.key === "waiting-customer"
                  ? (section.items as Array<{ type: "lead"; lead: SnapshotLead } | { type: "conversation"; conversation: SnapshotConversation }>).map((item) => {
                      if (item.type === "lead") {
                        return (
                          <QueueCard
                            key={item.lead.id}
                            title={customerName(item.lead.customers)}
                            meta={`${getProductLabel(item.lead.product_type)} · ${item.lead.design_status ? DESIGN_STATUS_LABELS[item.lead.design_status] : "รอลูกค้า"}`}
                            badge={<Badge className={cn("border", statusToneClass(item.lead.design_status || item.lead.status))}>{item.lead.design_status ? DESIGN_STATUS_LABELS[item.lead.design_status] : "รอลูกค้า"}</Badge>}
                            footer={
                              <div className="flex flex-wrap items-center gap-2">
                                <LeadAiPreviewActions leadId={item.lead.id} prompt={item.lead.ai_image_prompt || ""} status={item.lead.ai_image_status || "not_requested"} />
                                <AdminLeadDesignActions leadId={item.lead.id} designStatus={item.lead.design_status || "not_started"} />
                              </div>
                            }
                          >
                            <p className="text-xs text-slate-500">{item.lead.hold_reason || "ลูกค้ากำลังตรวจแบบหรือต้องส่งข้อมูลเพิ่ม"}</p>
                          </QueueCard>
                        );
                      }

                      return (
                        <QueueCard
                          key={item.conversation.id}
                          title={`LINE ${item.conversation.line_user_id.slice(0, 12)}...`}
                          meta={WORKFLOW_STATE_LABELS[item.conversation.state]}
                          badge={<Badge className={cn("border", statusToneClass(item.conversation.state))}>{WORKFLOW_STATE_LABELS[item.conversation.state]}</Badge>}
                          footer={<div className="flex justify-end"><AdminConversationActions conversationId={item.conversation.id} currentState={item.conversation.state} compact /></div>}
                        >
                          <p className="text-xs text-slate-500">รอข้อความหรือการตอบกลับจากลูกค้า</p>
                        </QueueCard>
                      );
                    })
                  : null}

                {section.key === "production-review" ? (
                  <ProductionReviewQueueContent items={section.items as SnapshotProductionEvent[]} />
                ) : null}

                {section.key === "escalations" ? (
                  <EscalationsQueueContent items={section.items as SnapshotEscalation[]} />
                ) : null}

                {section.count === 0 ? <EmptyState title="ยังไม่มีรายการในคิวนี้" /> : null}
              </div>

              <button
                type="button"
                onClick={() => setView(section.view)}
                className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-slate-600 transition hover:text-slate-950"
              >
                เปิดแท็บที่เกี่ยวข้อง
                <ArrowRight className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      </SurfaceSection>
    </div>
  );

  return (
    <div className="admin-shell pb-8 text-slate-900">
      <div className="mx-4 mt-4 overflow-hidden rounded-[32px] border border-slate-900/90 bg-[linear-gradient(135deg,#0f172a_0%,#172554_52%,#0f766e_100%)] text-white shadow-[0_32px_90px_rgba(15,23,42,0.32)]">
        <div className="flex flex-wrap items-start justify-between gap-4 px-6 py-6">
          <div className="max-w-2xl">
            <Badge className="border-white/10 bg-white/10 text-white">FOGUS Backoffice</Badge>
            <h1 className="mt-3 text-2xl font-bold tracking-tight">คุมคิวหลักให้ทีมเห็นว่าอะไรต้องขยับตอนนี้</h1>
            <p className="mt-2 text-sm leading-6 text-white/75">
              หน้าใหม่นี้แยกตามบทบาทงานจริง: ภาพรวม, การขาย, งานแบบ, งานผลิต และ inbox ที่รอคนเข้าเคลียร์ โดยทุกการ์ดกด action ได้ทันทีจากจุดที่เห็นคิว
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link href="/studio" className="inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15">
              เปิด Studio
            </Link>
            <Link href="/admin/settings" className="inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15">
              เปิด Settings
            </Link>
            <Link href="/flow" target="_blank" className="inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15">
              เปิด Workflow
            </Link>
          </div>
        </div>

        <div className="grid gap-3 border-t border-cyan-200/15 bg-white/10 px-6 py-4 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard title="leads ที่ยัง active" value={kpis.leadsCount} accent="text-cyan-200" />
          <MetricCard title="quote รอลูกค้าอนุมัติ" value={kpis.quotesWaitingApproval} accent="text-amber-200" />
          <MetricCard title="งานที่กำลังทำ" value={kpis.activeJobsCount} accent="text-emerald-200" />
          <MetricCard title="workflow ติดค้าง" value={kpis.blockedCount} accent="text-orange-200" />
          <MetricCard title="escalation เปิดอยู่" value={kpis.escalationsCount} accent="text-rose-200" />
        </div>
      </div>

      <div className="px-4 py-4">
        <div className="rounded-[28px] border border-cyan-100 bg-white/95 p-3 shadow-[0_16px_40px_rgba(0,62,93,0.08)]">
          <div className="flex flex-wrap gap-2">
            {VIEW_ORDER.map((entry) => {
              const Icon = entry.icon;
              const count =
                entry.key === "overview"
                  ? triageSections.reduce((sum, section) => sum + section.count, 0)
                  : entry.key === "sales"
                    ? sentQuotes.length + activeLeads.length
                    : entry.key === "design"
                      ? designQueueLeads.length + customerWaitingLeads.length
                      : entry.key === "production"
                        ? productionQueue.length + productionReviewQueue.length
                        : snapshot.escalations.length + snapshot.recentConversations.length;

              return (
                <button
                  key={entry.key}
                  type="button"
                  onClick={() => setView(entry.key)}
                  className={cn(
                    "flex min-w-[150px] flex-1 items-start gap-3 rounded-[22px] px-4 py-3 text-left transition",
                    view === entry.key
                      ? "bg-[linear-gradient(135deg,#00AEEF_0%,#0098d0_100%)] text-white shadow-[0_18px_40px_rgba(0,94,140,0.24)]"
                      : "bg-white text-slate-700 hover:bg-cyan-50"
                  )}
                >
                    <div className={cn("rounded-2xl p-2", view === entry.key ? "bg-white/12" : "bg-cyan-50") }>
                    <Icon className="size-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">{entry.label}</p>
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", view === entry.key ? "bg-white/15 text-white" : "border border-cyan-100 bg-white text-cyan-700")}>{count}</span>
                    </div>
                    <p className={cn("mt-1 text-xs leading-5", view === entry.key ? "text-white/80" : "text-slate-500")}>{entry.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid items-start gap-4 px-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-3">
          {view === "overview" ? (
            <>
              {triageSection}
              <SummaryStrip
                items={[
                  {
                    label: "ทีมต้องขยับ",
                    value: designQueueLeads.length,
                    hint: "lead และคิวแบบที่ยังเป็น action ของทีมอยู่",
                    tone: "info",
                  },
                  {
                    label: "ค้างฝั่งขาย",
                    value: sentQuotes.length + waitingPaymentConversations.length,
                    hint: "quote ที่ยังรอลูกค้าหรือ payment gate ยังไม่ผ่าน",
                    tone: "warning",
                  },
                  {
                    label: "หลักฐานหน้างาน",
                    value: pendingProductionReviewQueue.length,
                    hint: "รีวิว production ที่ยังต้องมีคนตัดสินใจ",
                    tone: "success",
                  },
                  {
                    label: "ต้องใช้คนเข้าเคลียร์",
                    value: snapshot.escalations.length + humanReviewConversations.length,
                    hint: "escalation และ workflow ที่ระบบยกให้คนปิดงาน",
                    tone: "danger",
                  },
                ]}
              />

              <SurfaceSection
                title="ภาพรวมการขายและการผลิต"
                description="ภาพเดียวที่เห็นทั้ง quote ที่รอปิด การออกแบบที่กำลังเดิน และงานผลิตที่กำลังขยับ"
              >
                <div className="grid gap-4 lg:grid-cols-3">
                  <QuickLane
                    title="Sales"
                    description="quote ที่ใกล้ปิดหรือค้างลูกค้า"
                    items={sentQuotes.slice(0, 4).map((quote) => (
                      <QueueCard
                        key={quote.id}
                        title={customerName(quote.leads?.customers)}
                        meta={`${getProductLabel(quote.leads?.product_type)} · ฿${Number(quote.total).toLocaleString()} · Track ${formatTrackingCode(quote.public_token)}`}
                        badge={<Badge className={cn("border", statusToneClass(quote.status))}>{getQuoteStatusLabel(quote.status)}</Badge>}
                        footer={<div className="flex justify-end"><AdminQuoteActions quoteId={quote.id} publicToken={quote.public_token} quoteStatus={quote.status} paymentTerms={quote.payment_terms} paymentStatus={quote.payment_status} hasJob={Array.isArray(quote.jobs) && quote.jobs.length > 0} /></div>}
                      >
                        <SignalPillGroup
                          items={compactPills([
                            { label: formatCurrency(quote.total), tone: "success" },
                            { label: PAYMENT_TERM_LABELS[quote.payment_terms], tone: "info" },
                            {
                              label: PAYMENT_STATUS_LABELS[quote.payment_status],
                              tone:
                                quote.payment_status === "paid"
                                  ? "success"
                                  : quote.payment_status === "partial"
                                    ? "warning"
                                    : "neutral",
                            },
                          ])}
                        />
                      </QueueCard>
                    ))}
                    empty="ยังไม่มี quote ที่ต้องจับตา"
                  />
                  <QuickLane
                    title="Design"
                    description="lead ที่ทีมออกแบบต้องขยับต่อ"
                    items={designQueueLeads.slice(0, 4).map((lead) => (
                      <QueueCard
                        key={lead.id}
                        title={customerName(lead.customers)}
                        meta={`${getProductLabel(lead.product_type)} · ${DESIGN_STATUS_LABELS[lead.design_status || "not_started"] || "ยังไม่เริ่มแบบ"}`}
                        badge={<Badge className={cn("border", statusToneClass(lead.design_status || lead.status))}>{DESIGN_STATUS_LABELS[lead.design_status || "not_started"] || getLeadStatusLabel(lead.status)}</Badge>}
                        footer={<div className="flex flex-wrap items-center gap-2"><LeadAiPreviewActions leadId={lead.id} prompt={lead.ai_image_prompt || ""} status={lead.ai_image_status || "not_requested"} /><AdminLeadDesignActions leadId={lead.id} designStatus={lead.design_status || "not_started"} /></div>}
                      >
                        <SignalPillGroup
                          items={compactPills([
                            { label: formatLeadDimensions(lead), tone: "neutral" },
                            lead.assigned_designer
                              ? { label: `owner ${lead.assigned_designer}`, tone: "info" }
                              : null,
                            lead.ai_image_status
                              ? { label: `AI ${lead.ai_image_status}`, tone: "warning" }
                              : null,
                          ])}
                        />
                      </QueueCard>
                    ))}
                    empty="ยังไม่มีคิวแบบที่ต้องขยับ"
                  />
                  <QuickLane
                    title="Production"
                    description="งานที่กำลังผลิตหรือพร้อมส่งมอบ"
                    items={productionQueue.slice(0, 4).map((job) => (
                      <QueueCard
                        key={job.id}
                        title={customerName(job.quotes?.leads?.customers)}
                        meta={`${getProductLabel(job.quotes?.leads?.product_type)} · ${formatDate(job.created_at)}`}
                        badge={<Badge className={cn("border", statusToneClass(job.status))}>{JOB_STATUS_LABELS[job.status] || job.status}</Badge>}
                        footer={<div className="flex flex-wrap items-center gap-2">{job.production_link_url ? <ProductionLinkCopy url={job.production_link_url} compact /> : null}<AdminJobActions jobId={job.id} currentStatus={job.status} /></div>}
                      >
                        <SignalPillGroup
                          items={compactPills([
                            job.assigned_to
                              ? { label: `owner ${job.assigned_to}`, tone: "info" }
                              : null,
                            job.fulfillment_status
                              ? { label: `fulfillment ${job.fulfillment_status}`, tone: "neutral" }
                              : null,
                            job.job_media_events?.filter((event) => event.review_status === "pending").length
                              ? {
                                  label: `รอตรวจ ${job.job_media_events.filter((event) => event.review_status === "pending").length}`,
                                  tone: "warning",
                                }
                              : null,
                          ])}
                        />
                      </QueueCard>
                    ))}
                    empty="ยังไม่มีงานในคิวผลิต"
                  />
                </div>
              </SurfaceSection>

              <SurfaceSection
                title="Workflow ที่ยังต้องมีคนปิดงาน"
                description="รวม escalation และ blocked workflow เพื่อไม่ให้ตกหล่นจาก top triage"
              >
                <div className="grid gap-4 lg:grid-cols-2">
                  {snapshot.escalations.length > 0 ? snapshot.escalations.slice(0, 5).map((esc) => (
                    <QueueCard
                      key={esc.id}
                      title={esc.conversations ? `LINE ${esc.conversations.line_user_id.slice(0, 12)}...` : "ลูกค้า"}
                      meta={formatDateTime(esc.created_at)}
                      tone="danger"
                      badge={<Badge className="border border-rose-200 bg-rose-50 text-rose-700">escalation</Badge>}
                      footer={esc.conversations ? <div className="flex justify-end"><AdminConversationActions conversationId={esc.conversations.id} currentState={esc.conversations.state} compact /></div> : null}
                    >
                      <p className="text-sm text-rose-900">{esc.reason}</p>
                    </QueueCard>
                  )) : <EmptyState title="ยังไม่มี escalation ที่เปิดอยู่" />}
                  {blockedConversations.length > 0 ? blockedConversations.slice(0, 5).map((conversation) => (
                    <QueueCard
                      key={conversation.id}
                      title={`LINE ${conversation.line_user_id.slice(0, 12)}...`}
                      meta={formatDateTime(conversation.last_message_at)}
                      badge={<Badge className={cn("border", statusToneClass(conversation.state))}>{WORKFLOW_STATE_LABELS[conversation.state]}</Badge>}
                      footer={<div className="flex justify-end"><AdminConversationActions conversationId={conversation.id} currentState={conversation.state} compact /></div>}
                    />
                  )) : <EmptyState title="ไม่มี workflow ติดค้างที่ต้องเร่งตอบ" />}
                </div>
              </SurfaceSection>
            </>
          ) : null}

          {view === "sales" ? (
            <>
              <SummaryStrip
                items={[
                  {
                    label: "รออนุมัติ",
                    value: sentQuotes.length,
                    hint: "quote ที่ยังต้องรอคำตอบจากลูกค้า",
                    tone: "warning",
                  },
                  {
                    label: "ติด payment gate",
                    value: waitingPaymentConversations.length,
                    hint: "อนุมัติ quote แล้วแต่ยังไม่ปลดล็อกไปงานผลิต",
                    tone: "info",
                  },
                  {
                    label: "lead ใหม่",
                    value: newLeads.length,
                    hint: "lead ที่ยังไม่แตกเป็น quote หรือยังต้องปิด requirement",
                    tone: "neutral",
                  },
                  {
                    label: "แปลงเป็นงานแล้ว",
                    value: quotesWithJobs.length,
                    hint: "quote ที่สร้าง job ต่อสำเร็จแล้ว",
                    tone: "success",
                  },
                ]}
              />

              <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
                <SurfaceSection title="Sales Queue" description="quote ที่กำลังรอลูกค้า, เงื่อนไขการเงิน, และความพร้อมในการปลดล็อกงาน" count={snapshot.quotes.length}>
                  <div className="grid gap-4 xl:grid-cols-2">
                    {snapshot.quotes.map((quote) => (
                      <QueueCard
                        key={quote.id}
                        title={customerName(quote.leads?.customers)}
                        meta={`${getProductLabel(quote.leads?.product_type)} · สร้างเมื่อ ${formatDate(quote.created_at)}`}
                        badge={<Badge className={cn("border", statusToneClass(quote.status))}>{getQuoteStatusLabel(quote.status)}</Badge>}
                        footer={
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-xs text-slate-500">
                              {quote.quote_items?.length
                                ? `มี ${quote.quote_items.length} รายการในใบเสนอราคา`
                                : "ยังไม่มีรายการสินค้าใน snapshot นี้"}
                            </div>
                            <div className="flex items-center gap-2">
                              <a href={`${baseUrl}/quote/${quote.public_token}`} target="_blank" rel="noreferrer" className="text-xs font-medium text-blue-600 underline underline-offset-4">เปิด quote</a>
                              <AdminQuoteActions quoteId={quote.id} publicToken={quote.public_token} quoteStatus={quote.status} paymentTerms={quote.payment_terms} paymentStatus={quote.payment_status} hasJob={Array.isArray(quote.jobs) && quote.jobs.length > 0} />
                            </div>
                          </div>
                        }
                      >
                        <SignalPillGroup
                          items={compactPills([
                            { label: formatCurrency(quote.total), tone: "success" },
                            { label: PAYMENT_TERM_LABELS[quote.payment_terms], tone: "info" },
                            {
                              label: PAYMENT_STATUS_LABELS[quote.payment_status],
                              tone:
                                quote.payment_status === "paid"
                                  ? "success"
                                  : quote.payment_status === "partial"
                                    ? "warning"
                                    : "neutral",
                            },
                            Array.isArray(quote.jobs) && quote.jobs.length > 0
                              ? { label: "มี job แล้ว", tone: "success" }
                              : { label: "ยังไม่สร้าง job", tone: "warning" },
                          ])}
                        />
                      </QueueCard>
                    ))}
                    {snapshot.quotes.length === 0 ? <EmptyState title="ยังไม่มี quote ในระบบ" /> : null}
                  </div>
                </SurfaceSection>

                <SurfaceSection title="Leads ล่าสุด" description="lead ที่ยัง active อยู่ และควรเห็นข้อมูลพอจะตัดสินใจว่าจะขายต่อ, ส่งเข้าแบบ, หรือ hold ไว้" count={activeLeads.length}>
                  <div className="grid gap-4 xl:grid-cols-2">
                    {activeLeads.map((lead) => {
                      const leadNote = truncateText(
                        lead.note_from_form || lead.reference_info || lead.note_from_chat
                      );

                      return (
                        <QueueCard
                          key={lead.id}
                          title={customerName(lead.customers)}
                          meta={`${getProductLabel(lead.product_type)} · ${formatLeadDimensions(lead)}`}
                          badge={<Badge className={cn("border", statusToneClass(lead.design_status || lead.status))}>{getLeadStatusLabel(lead.status)}</Badge>}
                          footer={<div className="flex flex-wrap items-center gap-2"><LeadAiPreviewActions leadId={lead.id} prompt={lead.ai_image_prompt || ""} status={lead.ai_image_status || "not_requested"} /><AdminLeadDesignActions leadId={lead.id} designStatus={lead.design_status || "not_started"} /></div>}
                        >
                          <SignalPillGroup
                            items={compactPills([
                              lead.design_status
                                ? { label: `แบบ ${DESIGN_STATUS_LABELS[lead.design_status]}`, tone: "info" }
                                : null,
                              lead.due_date
                                ? { label: `กำหนดใช้ ${formatDate(lead.due_date)}`, tone: "warning" }
                                : null,
                              lead.assigned_designer
                                ? { label: `designer ${lead.assigned_designer}`, tone: "neutral" }
                                : null,
                              lead.ai_image_status
                                ? { label: `AI ${lead.ai_image_status}`, tone: "success" }
                                : null,
                            ])}
                          />
                          {leadNote ? (
                            <p className="mt-3 text-xs leading-5 text-slate-500">{leadNote}</p>
                          ) : null}
                        </QueueCard>
                      );
                    })}
                    {activeLeads.length === 0 ? <EmptyState title="ยังไม่มี lead ที่ active อยู่" /> : null}
                  </div>
                </SurfaceSection>
              </div>
            </>
          ) : null}

          {view === "design" ? (
            <>
              <SummaryStrip
                items={[
                  {
                    label: "เริ่มทำแบบ",
                    value: draftDesignLeads.length,
                    hint: "ยังไม่เริ่มหรือกำลัง drafting อยู่ในมือทีม",
                    tone: "info",
                  },
                  {
                    label: "รอทีมแก้",
                    value: revisionRequestedLeads.length,
                    hint: "ลูกค้าส่ง feedback แล้วและ ownership กลับมาที่ทีม",
                    tone: "warning",
                  },
                  {
                    label: "รอลูกค้าตรวจ",
                    value: previewSentLeads.length,
                    hint: "preview ถูกส่งแล้วและตอนนี้ต้องตาม feedback จากลูกค้า",
                    tone: "neutral",
                  },
                  {
                    label: "approve แล้ว",
                    value: approvedDesignLeads.length,
                    hint: "แบบผ่านแล้วและพร้อมไหลต่อเมื่อ payment gate ผ่าน",
                    tone: "success",
                  },
                ]}
              />

              <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                <SurfaceSection title="Design Queue" description="lead ที่ฝั่งทีมออกแบบเป็นเจ้าของขั้นตอนต่อไป และควรเห็นข้อมูลพอจะกดงานต่อได้ทันที" count={designQueueLeads.length}>
                  <div className="grid gap-4 xl:grid-cols-2">
                    {designQueueLeads.map((lead) => {
                      const leadNote = truncateText(
                        lead.note_from_form || lead.reference_info || lead.note_from_chat
                      );

                      return (
                        <QueueCard
                          key={lead.id}
                          title={customerName(lead.customers)}
                          meta={`${getProductLabel(lead.product_type)} · ${getLeadStatusLabel(lead.status)}`}
                          badge={<Badge className={cn("border", statusToneClass(lead.design_status || lead.status))}>{DESIGN_STATUS_LABELS[lead.design_status || "not_started"] || "ยังไม่เริ่มแบบ"}</Badge>}
                          footer={<div className="flex flex-wrap items-center gap-2"><LeadAiPreviewActions leadId={lead.id} prompt={lead.ai_image_prompt || ""} status={lead.ai_image_status || "not_requested"} /><AdminLeadDesignActions leadId={lead.id} designStatus={lead.design_status || "not_started"} /></div>}
                        >
                          <SignalPillGroup
                            items={compactPills([
                              { label: formatLeadDimensions(lead), tone: "neutral" },
                              lead.assigned_designer
                                ? { label: `designer ${lead.assigned_designer}`, tone: "info" }
                                : null,
                              lead.ai_image_status
                                ? { label: `AI ${lead.ai_image_status}`, tone: "success" }
                                : null,
                              lead.due_date
                                ? { label: `กำหนดใช้ ${formatDate(lead.due_date)}`, tone: "warning" }
                                : null,
                            ])}
                          />

                          {Array.isArray(lead.lead_media_assets) && lead.lead_media_assets.length > 0 ? (
                            <div className="mt-3">
                              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Customer reference</p>
                              <div className="flex flex-wrap gap-2">
                                {lead.lead_media_assets.slice(0, 4).map((asset) => asset.signed_url ? (
                                  <a key={asset.id} href={asset.signed_url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                                    {asset.mime_type?.startsWith("image/") ? (
                                      <Image src={asset.signed_url} alt={asset.original_file_name || "Customer upload"} width={80} height={80} unoptimized className="h-20 w-20 object-cover" />
                                    ) : (
                                      <span className="flex h-20 w-20 items-center justify-center px-2 text-center text-[11px] font-semibold text-slate-600">เปิดไฟล์</span>
                                    )}
                                  </a>
                                ) : null)}
                              </div>
                            </div>
                          ) : Array.isArray(lead.ai_generated_images) && lead.ai_generated_images.length > 0 ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {lead.ai_generated_images.slice(0, 4).map((imageUrl) => (
                                <a key={imageUrl} href={imageUrl} target="_blank" rel="noreferrer" className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                                  <Image src={imageUrl} alt="AI preview" width={80} height={80} unoptimized className="h-20 w-20 object-cover" />
                                </a>
                              ))}
                            </div>
                          ) : leadNote ? (
                            <p className="mt-3 text-xs leading-5 text-slate-500">{leadNote}</p>
                          ) : (
                            <p className="mt-3 text-xs text-slate-500">{lead.ai_image_prompt ? "มี prompt พร้อมสร้างภาพ AI" : "ไม่มี AI prompt, ทีมดีไซน์เดินงานเองได้ทันที"}</p>
                          )}
                        </QueueCard>
                      );
                    })}
                    {designQueueLeads.length === 0 ? <EmptyState title="ตอนนี้ไม่มีคิวแบบที่ทีมต้องขยับ" /> : null}
                  </div>
                </SurfaceSection>

                <SurfaceSection title="งานที่รอลูกค้าตรวจแบบหรือส่งข้อมูลเพิ่ม" description="คิวฝั่ง design ที่ ownership อยู่กับลูกค้าชั่วคราว แต่ทีมยังต้องเห็นบริบทครบ" count={customerWaitingLeads.length}>
                  <div className="grid gap-4 xl:grid-cols-2">
                    {customerWaitingLeads.map((lead) => {
                      const waitingNote = truncateText(
                        lead.hold_reason || lead.note_from_form || lead.note_from_chat
                      );

                      return (
                        <QueueCard
                          key={lead.id}
                          title={customerName(lead.customers)}
                          meta={`${getProductLabel(lead.product_type)} · ${lead.hold_reason || "ลูกค้ากำลังตรวจแบบ"}`}
                          badge={<Badge className={cn("border", statusToneClass(lead.design_status || lead.status))}>{lead.design_status ? DESIGN_STATUS_LABELS[lead.design_status] : "รอลูกค้า"}</Badge>}
                          footer={<div className="flex flex-wrap items-center gap-2"><LeadAiPreviewActions leadId={lead.id} prompt={lead.ai_image_prompt || ""} status={lead.ai_image_status || "not_requested"} /><AdminLeadDesignActions leadId={lead.id} designStatus={lead.design_status || "not_started"} /></div>}
                        >
                          <SignalPillGroup
                            items={compactPills([
                              { label: formatLeadDimensions(lead), tone: "neutral" },
                              lead.ai_generated_images?.length
                                ? { label: `มีภาพ ${lead.ai_generated_images.length} แบบ`, tone: "info" }
                                : null,
                              lead.due_date
                                ? { label: `กำหนดใช้ ${formatDate(lead.due_date)}`, tone: "warning" }
                                : null,
                              lead.design_status
                                ? { label: DESIGN_STATUS_LABELS[lead.design_status], tone: "success" }
                                : null,
                            ])}
                          />
                          {waitingNote ? (
                            <p className="mt-3 text-xs leading-5 text-slate-500">{waitingNote}</p>
                          ) : null}
                        </QueueCard>
                      );
                    })}
                    {customerWaitingLeads.length === 0 ? <EmptyState title="ตอนนี้ไม่มีงานที่รอลูกค้าตรวจแบบ" /> : null}
                  </div>
                </SurfaceSection>
              </div>
            </>
          ) : null}

          {view === "production" ? (
            <>
              <SummaryStrip
                items={[
                  {
                    label: "รอ review",
                    value: pendingProductionReviewQueue.length,
                    hint: "หลักฐานจากหน้างานที่แอดมินต้องตัดสินใจตอนนี้",
                    tone: "warning",
                  },
                  {
                    label: "review ผ่านแล้ว",
                    value: approvedProductionReviewQueue.length,
                    hint: "หลักฐานที่ผ่านการ review แล้วในรอบปัจจุบัน",
                    tone: "success",
                  },
                  {
                    label: "กำลังผลิต",
                    value: inProductionJobs.length,
                    hint: "job ที่อยู่บน floor ตอนนี้",
                    tone: "info",
                  },
                  {
                    label: "พร้อมส่งมอบ",
                    value: readyForFulfillmentJobs.length,
                    hint: "งานที่จบการผลิตแล้วและรอ close-out",
                    tone: "neutral",
                  },
                ]}
              />

              <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <SurfaceSection title="Production Review Queue" description="หลักฐานจากหน้างานทุกชุดต้องผ่าน queue นี้ก่อนส่งถึงลูกค้า" count={productionReviewQueue.length}>
                  <div className="grid gap-4 xl:grid-cols-2">
                    {productionReviewQueue.map((event) => {
                      const job = firstRow(event.jobs);
                      const quote = firstRow(job?.quotes);
                      const lead = firstRow(quote?.leads);

                      return (
                        <QueueCard
                          key={event.id}
                          title={customerName(lead?.customers)}
                          meta={`${PRODUCTION_EVENT_TYPE_LABELS[event.event_type]} · ${formatDateTime(event.created_at)}`}
                          badge={<Badge className={cn("border", statusToneClass(event.review_status))}>{getReviewStatusLabel(event.review_status)}</Badge>}
                          footer={
                            <div className="flex flex-wrap items-center gap-2">
                              <ProductionReviewActions eventId={event.id} reviewStatus={event.review_status} />
                              {event.production_link_url ? <ProductionLinkCopy url={event.production_link_url} compact /> : null}
                              {quote?.public_token ? <a href={`${baseUrl}/status/${quote.public_token}`} target="_blank" rel="noreferrer" className="text-xs font-medium text-blue-600 underline underline-offset-4">เปิดหน้า status</a> : null}
                            </div>
                          }
                        >
                          <SignalPillGroup
                            items={compactPills([
                              event.submitted_by_label
                                ? { label: `ส่งโดย ${event.submitted_by_label}`, tone: "info" }
                                : null,
                              event.job_media_assets?.length
                                ? { label: `ไฟล์ ${event.job_media_assets.length} ชิ้น`, tone: "neutral" }
                                : null,
                              event.sent_to_customer_at
                                ? { label: `ส่งลูกค้า ${formatDate(event.sent_to_customer_at)}`, tone: "success" }
                                : null,
                            ])}
                          />
                          {Array.isArray(event.job_media_assets) && event.job_media_assets.length > 0 ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {event.job_media_assets.map((asset) => asset.signed_url ? (
                                <a key={asset.id} href={asset.signed_url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                                  <Image src={asset.signed_url} alt="Production upload" width={96} height={96} unoptimized className="h-24 w-24 object-cover" />
                                </a>
                              ) : null)}
                            </div>
                          ) : null}
                          <p className="mt-3 text-xs leading-5 text-slate-500">{event.note || "ยังไม่มีไฟล์ preview ให้ดูจากหน้า dashboard"}</p>
                        </QueueCard>
                      );
                    })}
                    {productionReviewQueue.length === 0 ? <EmptyState title="ยังไม่มีหลักฐานจาก production ที่รอ review" /> : null}
                  </div>
                </SurfaceSection>

                <SurfaceSection title="Production Jobs" description="งานที่กำลังผลิตหรือพร้อมส่งมอบ พร้อม signal สำคัญสำหรับปิดงานให้จบจากการ์ดเดียว" count={snapshot.jobs.length}>
                  <div className="grid gap-4 xl:grid-cols-2">
                    {snapshot.jobs.map((job) => {
                      const pendingReviewCount =
                        job.job_media_events?.filter((event) => event.review_status === "pending")
                          .length || 0;

                      return (
                        <QueueCard
                          key={job.id}
                          title={customerName(job.quotes?.leads?.customers)}
                          meta={`${getProductLabel(job.quotes?.leads?.product_type)} · เริ่มเมื่อ ${formatDate(job.created_at)}`}
                          badge={<Badge className={cn("border", statusToneClass(job.status))}>{JOB_STATUS_LABELS[job.status] || job.status}</Badge>}
                          footer={
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                {job.production_link_url ? <ProductionLinkCopy url={job.production_link_url} compact /> : null}
                              </div>
                              <div className="flex items-center gap-2">
                                {job.quotes?.public_token ? <a href={`${baseUrl}/status/${job.quotes.public_token}`} target="_blank" rel="noreferrer" className="text-xs font-medium text-blue-600 underline underline-offset-4">เปิดหน้า status</a> : null}
                                <AdminJobActions jobId={job.id} currentStatus={job.status} />
                              </div>
                            </div>
                          }
                        >
                          <SignalPillGroup
                            items={compactPills([
                              pendingReviewCount > 0
                                ? { label: `รอตรวจ ${pendingReviewCount}`, tone: "warning" }
                                : null,
                              job.assigned_to
                                ? { label: `owner ${job.assigned_to}`, tone: "info" }
                                : null,
                              job.fulfillment_status
                                ? { label: `fulfillment ${job.fulfillment_status}`, tone: "neutral" }
                                : null,
                              job.production_status
                                ? { label: `production ${job.production_status}`, tone: "success" }
                                : null,
                            ])}
                          />
                          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            {job.completion_package_status ? <span>completion package: {job.completion_package_status}</span> : null}
                            {job.completed_at ? <span>เสร็จเมื่อ {formatDateTime(job.completed_at)}</span> : null}
                          </div>
                        </QueueCard>
                      );
                    })}
                    {snapshot.jobs.length === 0 ? <EmptyState title="ยังไม่มีงานในระบบ" /> : null}
                  </div>
                </SurfaceSection>
              </div>
            </>
          ) : null}

          {view === "inbox" ? (
            <>
              <SummaryStrip
                items={[
                  {
                    label: "escalation",
                    value: snapshot.escalations.length,
                    hint: "ลูกค้าหรือระบบเรียกให้คนเข้าเคลียร์โดยตรง",
                    tone: "danger",
                  },
                  {
                    label: "รอ payment",
                    value: waitingPaymentConversations.length,
                    hint: "conversation ที่ติด payment gate อยู่",
                    tone: "warning",
                  },
                  {
                    label: "รอลูกค้าตอบ",
                    value: waitingCustomerConversations.length,
                    hint: "ต้องตามข้อมูลหรือ feedback เพิ่มจากลูกค้า",
                    tone: "neutral",
                  },
                  {
                    label: "human review",
                    value: humanReviewConversations.length,
                    hint: "workflow ที่ระบบยกให้ทีมเข้ามาตัดสินใจต่อ",
                    tone: "info",
                  },
                ]}
              />

              <div className="grid gap-4 2xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
                <SurfaceSection title="Escalations และเคสติดค้าง" description="ส่วนนี้คือ queue เร่งด่วนของคน ไม่ใช่ backlog ทั่วไป" count={snapshot.escalations.length + blockedConversations.length + waitingCustomerConversations.length}>
                  <div className="grid gap-4 xl:grid-cols-2">
                    {snapshot.escalations.map((esc) => (
                      <QueueCard
                        key={esc.id}
                        title={esc.conversations ? `LINE ${esc.conversations.line_user_id.slice(0, 12)}...` : "ลูกค้า"}
                        meta={formatDateTime(esc.created_at)}
                        tone="danger"
                        badge={<Badge className="border border-rose-200 bg-rose-50 text-rose-700">escalation</Badge>}
                        footer={esc.conversations ? <div className="flex justify-end"><AdminConversationActions conversationId={esc.conversations.id} currentState={esc.conversations.state} compact /></div> : null}
                      >
                        <p className="text-sm text-rose-900">{esc.reason}</p>
                      </QueueCard>
                    ))}

                    {blockedConversations.map((conversation) => {
                      const bundle = getConversationBundle(snapshot, conversation.id);
                      const holdNote = truncateText(bundle.lead?.hold_reason);

                      return (
                        <QueueCard
                          key={conversation.id}
                          title={bundle.lead ? customerName(bundle.lead.customers) : `LINE ${conversation.line_user_id.slice(0, 12)}...`}
                          meta={`อัปเดตล่าสุด ${formatDateTime(conversation.last_message_at)}`}
                          tone="warning"
                          badge={<Badge className={cn("border", statusToneClass(conversation.state))}>{WORKFLOW_STATE_LABELS[conversation.state]}</Badge>}
                          footer={<div className="flex justify-end"><AdminConversationActions conversationId={conversation.id} currentState={conversation.state} compact /></div>}
                        >
                          <SignalPillGroup
                            items={compactPills([
                              bundle.quote
                                ? { label: getQuoteStatusLabel(bundle.quote.status), tone: "info" }
                                : null,
                              bundle.quote
                                ? { label: PAYMENT_STATUS_LABELS[bundle.quote.payment_status], tone: "warning" }
                                : null,
                              bundle.job
                                ? { label: JOB_STATUS_LABELS[bundle.job.status] || bundle.job.status, tone: "success" }
                                : null,
                            ])}
                          />
                          {holdNote ? <p className="mt-3 text-xs leading-5 text-slate-500">{holdNote}</p> : null}
                        </QueueCard>
                      );
                    })}

                    {waitingCustomerConversations.map((conversation) => {
                      const bundle = getConversationBundle(snapshot, conversation.id);
                      const waitingNote = truncateText(
                        bundle.lead?.hold_reason || bundle.lead?.note_from_chat
                      );

                      return (
                        <QueueCard
                          key={conversation.id}
                          title={bundle.lead ? customerName(bundle.lead.customers) : `LINE ${conversation.line_user_id.slice(0, 12)}...`}
                          meta={`อัปเดตล่าสุด ${formatDateTime(conversation.last_message_at)}`}
                          tone="warning"
                          badge={<Badge className={cn("border", statusToneClass(conversation.state))}>{WORKFLOW_STATE_LABELS[conversation.state]}</Badge>}
                          footer={<div className="flex justify-end"><AdminConversationActions conversationId={conversation.id} currentState={conversation.state} compact /></div>}
                        >
                          <SignalPillGroup
                            items={compactPills([
                              bundle.lead
                                ? { label: getProductLabel(bundle.lead.product_type), tone: "neutral" }
                                : null,
                              bundle.quote
                                ? { label: getQuoteStatusLabel(bundle.quote.status), tone: "info" }
                                : null,
                              bundle.job
                                ? { label: JOB_STATUS_LABELS[bundle.job.status] || bundle.job.status, tone: "success" }
                                : null,
                            ])}
                          />
                          {waitingNote ? <p className="mt-3 text-xs leading-5 text-slate-500">{waitingNote}</p> : null}
                        </QueueCard>
                      );
                    })}

                    {snapshot.escalations.length === 0 && blockedConversations.length === 0 && waitingCustomerConversations.length === 0 ? (
                      <EmptyState title="ตอนนี้ยังไม่มีเคสเร่งด่วนใน inbox" />
                    ) : null}
                  </div>
                </SurfaceSection>

                <SurfaceSection title="Conversation Backlog" description="conversation ที่ยัง active แต่ยังไม่เข้า queue เร่งด่วน เพื่อให้ทีมสแกนทั้งระบบได้โดยไม่โดน noise บัง" count={backlogConversations.length}>
                  <div className="grid gap-4 xl:grid-cols-2">
                    {backlogConversations.map((conversation) => {
                      const bundle = getConversationBundle(snapshot, conversation.id);
                      const holdNote = truncateText(bundle.lead?.hold_reason);

                      return (
                        <QueueCard
                          key={conversation.id}
                          title={bundle.lead ? customerName(bundle.lead.customers) : `LINE ${conversation.line_user_id.slice(0, 12)}...`}
                          meta={`อัปเดตล่าสุด ${formatDateTime(conversation.last_message_at)}`}
                          badge={<Badge className={cn("border", statusToneClass(conversation.state))}>{WORKFLOW_STATE_LABELS[conversation.state]}</Badge>}
                          footer={
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-xs text-slate-500">
                                {bundle.quote ? `${getQuoteStatusLabel(bundle.quote.status)} · ${PAYMENT_STATUS_LABELS[bundle.quote.payment_status]}` : "ยังไม่มี quote ผูกกับ conversation นี้"}
                              </div>
                              <AdminConversationActions conversationId={conversation.id} currentState={conversation.state} compact />
                            </div>
                          }
                        >
                          <SignalPillGroup
                            items={compactPills([
                              bundle.lead
                                ? { label: getProductLabel(bundle.lead.product_type), tone: "neutral" }
                                : null,
                              bundle.job
                                ? { label: JOB_STATUS_LABELS[bundle.job.status] || bundle.job.status, tone: "success" }
                                : null,
                              bundle.lead?.design_status
                                ? { label: DESIGN_STATUS_LABELS[bundle.lead.design_status], tone: "info" }
                                : null,
                            ])}
                          />
                          {holdNote ? <p className="mt-3 text-xs leading-5 text-slate-500">{holdNote}</p> : null}
                        </QueueCard>
                      );
                    })}
                    {backlogConversations.length === 0 ? <EmptyState title="ยังไม่มี conversation backlog นอกคิวเร่งด่วน" /> : null}
                  </div>
                </SurfaceSection>
              </div>
            </>
          ) : null}
        </div>

        <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <SurfaceSection title="Secondary Rail" description="ข้อมูลรองที่ควรเปิดดูได้ แต่ไม่ควรแย่งความสนใจจาก queue หลัก">
            <div className="space-y-4">
              <div className="rounded-[24px] border border-cyan-100 bg-cyan-50/35 p-4">
                <div className="flex items-center gap-2">
                  <Archive className="size-4 text-cyan-700" />
                  <h3 className="text-sm font-semibold text-slate-900">Superseded Leads</h3>
                  <Badge variant="outline" className="border-cyan-100 bg-white text-cyan-700">{supersededLeads.length}</Badge>
                </div>
                <div className="mt-4 space-y-3">
                  {supersededLeads.slice(0, 6).map((lead) => (
                    <QueueCard
                      key={lead.id}
                      title={customerName(lead.customers)}
                      meta={`${getProductLabel(lead.product_type)} · ถูกแทนที่เมื่อ ${formatDateTime(lead.superseded_at)}`}
                      badge={<Badge className="border border-cyan-100 bg-white text-cyan-700">archive</Badge>}
                    >
                      <p className="text-xs text-slate-500">{lead.supersede_reason || `แทนที่ด้วย lead ${lead.superseded_by_lead_id?.slice(0, 8) || "ใหม่"}`}</p>
                    </QueueCard>
                  ))}
                  {supersededLeads.length === 0 ? <EmptyState title="ยังไม่มี superseded lead" /> : null}
                </div>
              </div>

              <div className="rounded-[24px] border border-cyan-100 bg-cyan-50/35 p-4">
                <div className="flex items-center gap-2">
                  <MessageSquareMore className="size-4 text-cyan-700" />
                  <h3 className="text-sm font-semibold text-slate-900">Recent Conversations</h3>
                  <Badge variant="outline" className="border-cyan-100 bg-white text-cyan-700">{snapshot.recentConversations.length}</Badge>
                </div>
                <div className="mt-4 space-y-3">
                  {snapshot.recentConversations.map((conversation) => (
                    <QueueCard
                      key={conversation.id}
                      title={`LINE ${conversation.line_user_id.slice(0, 12)}...`}
                      meta={formatDateTime(conversation.last_message_at)}
                      badge={<Badge className={cn("border", statusToneClass(conversation.state))}>{WORKFLOW_STATE_LABELS[conversation.state]}</Badge>}
                    />
                  ))}
                  {snapshot.recentConversations.length === 0 ? <EmptyState title="ยังไม่มี conversation ล่าสุดให้ดู" /> : null}
                </div>
              </div>
            </div>
          </SurfaceSection>

          <SurfaceSection title="Quick Notes" description="ภาษากลางของสถานะที่ใช้ในหน้า admin ใหม่ทั้งหมด">
            <div className="space-y-3 text-sm text-slate-600">
              <div className="rounded-2xl border border-cyan-100 bg-cyan-50/40 p-4">
                <div className="flex items-center gap-2 text-slate-900">
                  <CircleDashed className="size-4 text-cyan-700" />
                  <p className="font-semibold">ภาษาของ status ถูก map เป็นภาษาคนแล้ว</p>
                </div>
                <p className="mt-2 leading-6">quote, lead, workflow, design และ production review จะใช้คำไทยที่อ่านแล้วเข้าใจทันทีในทุก card</p>
              </div>
              <div className="rounded-2xl border border-cyan-100 bg-cyan-50/40 p-4">
                <div className="flex items-center gap-2 text-slate-900">
                  <AlertTriangle className="size-4 text-[#ec008c]" />
                  <p className="font-semibold">ทุก action ยังใช้ logic route เดิม</p>
                </div>
                <p className="mt-2 leading-6">รอบนี้เน้นย้าย UX และ pattern ให้กดงานจากคิวได้ทันที โดยไม่เปลี่ยน business rule ใต้หน้า admin</p>
              </div>
            </div>
          </SurfaceSection>
        </aside>
      </div>
    </div>
  );
}

function MetricCard({ title, value, accent }: { title: string; value: number; accent: string }) {
  return (
    <div className="rounded-[22px] border border-cyan-200/20 bg-white/10 px-4 py-3 backdrop-blur-sm">
      <p className={cn("text-2xl font-bold", accent)}>{value}</p>
      <p className="mt-1 text-xs text-white/70">{title}</p>
    </div>
  );
}

function QuickLane({ title, description, items, empty }: { title: string; description: string; items: React.ReactNode[]; empty: string }) {
  return (
    <div className="rounded-[24px] border border-cyan-100 bg-cyan-50/35 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-white p-2 text-cyan-700">
          {title === "Sales" ? <WalletCards className="size-4" /> : title === "Design" ? <Sparkles className="size-4" /> : <Factory className="size-4" />}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
        </div>
      </div>
      <div className="mt-4 space-y-3">{items.length > 0 ? items : <EmptyState title={empty} />}</div>
    </div>
  );
}
