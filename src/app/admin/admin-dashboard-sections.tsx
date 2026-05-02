"use client";

import Link from "next/link";
import { type ReactNode } from "react";
import Image from "next/image";
import { CircleHelp, type LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type {
  AdminOverviewPage,
  AdminOverviewRow,
  OverviewFilterKey,
} from "@/lib/admin-overview";
import {
  getLeadDesignRoutingSummary,
  getLeadAiDisplayPrompt,
  hasLeadAiSeedPrompt,
} from "@/lib/lead-ai-prompt";
import {
  getConversationActionLabel,
  getJobActionLabel,
  getQuoteActionLabel,
} from "@/lib/admin-action-labels";
import type {
  BackofficeSnapshot,
  SnapshotConversation,
  SnapshotEscalation,
  SnapshotJob,
  SnapshotLead,
  SnapshotProductionEvent,
  SnapshotQuote,
} from "@/lib/backoffice-snapshot";
import { PRODUCTION_EVENT_TYPE_LABELS } from "@/lib/production-review";
import {
  BILLING_ENTITY_TYPE_LABELS,
  DESIGN_STATUS_LABELS,
  DOCUMENT_REQUEST_TYPE_LABELS,
  JOB_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_TERM_LABELS,
  PRODUCT_TYPES,
  WORKFLOW_STATE_LABELS,
  type BillingEntityType,
  type DocumentRequestType,
} from "@/lib/types";
import { formatBangkokDate, formatBangkokDateTime } from "@/lib/bangkok-date-time";
import { cn, firstRow } from "@/lib/utils";

import AdminConversationActions from "./conversation-actions";
import AdminJobActions from "./job-actions";
import LeadAiPreviewActions from "./lead-ai-preview-actions";
import AdminLeadDesignActions from "./lead-design-actions";
import LeadPromptActions from "./lead-prompt-actions";
import LeadSendPreviewActions from "./lead-send-preview-actions";
import ProductionLinkCopy from "./production-link-copy";
import ProductionReviewActions from "./production-review-actions";
import AdminQuoteActions from "./quote-actions";

const LEAD_STATUS_LABELS: Record<string, string> = {
  new: "ต้องจัดการ",
  quoted: "ออกใบเสนอราคาแล้ว",
  approved: "อนุมัติแล้ว",
  in_progress: "กำลังดำเนินงาน",
  completed: "เสร็จสมบูรณ์",
  cancelled: "ยกเลิก",
  superseded: "ถูกแทนที่",
};

const QUOTE_STATUS_LABELS: Record<string, string> = {
  draft: "ร่างใบเสนอราคา",
  sent: "รอลูกค้าอนุมัติ",
  approved: "อนุมัติแล้ว",
  rejected: "ปฏิเสธแล้ว",
  expired: "หมดอายุ",
};

const REVIEW_STATUS_LABELS: Record<string, string> = {
  pending: "รอตรวจ",
  approved: "อนุมัติแล้ว",
  rejected: "ตีกลับ",
  sent: "ส่งให้ลูกค้าแล้ว",
};

const THAI_NUMBER_FORMATTER = new Intl.NumberFormat("th-TH-u-nu-latn");
const OVERVIEW_ACTION_LINK_CLASS =
  "inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 shadow-[0_1px_0_rgba(15,23,42,0.04)] transition hover:border-slate-300 hover:bg-slate-50";

type OverviewAccentTone = "neutral" | "info" | "warning" | "danger" | "success" | "accent";

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

function OverviewInlinePill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "accent";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium leading-none",
        tone === "accent"
          ? "border-cyan-200 bg-cyan-50 text-cyan-700"
          : "border-slate-200 bg-slate-50 text-slate-600"
      )}
    >
      {children}
    </span>
  );
}

function OverviewCellFrame({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: OverviewAccentTone;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[20px] border px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]",
        tone === "danger" && "border-rose-100 bg-white/88",
        tone === "warning" && "border-amber-100 bg-white/88",
        tone === "info" && "border-sky-100 bg-white/88",
        tone === "success" && "border-emerald-100 bg-white/88",
        tone === "accent" && "border-violet-100 bg-white/88",
        tone === "neutral" && "border-slate-200/80 bg-white/82",
        className
      )}
    >
      {children}
    </div>
  );
}

function OverviewMobileLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 xl:hidden">
      {children}
    </p>
  );
}

function getOverviewCellClassName(className?: string) {
  return cn(
    "block px-4 py-3 align-top whitespace-normal xl:table-cell xl:px-4 xl:py-4",
    className
  );
}

function getOverviewActionCellClassName(className?: string) {
  return cn(
    "block border-t border-slate-200/70 px-4 pt-3 pb-4 align-top whitespace-normal xl:table-cell xl:border-0 xl:px-4 xl:py-4",
    className
  );
}

function getOverviewRowClassName(className?: string) {
  return cn(
    "group block overflow-hidden rounded-[24px] border shadow-[0_16px_34px_rgba(15,23,42,0.06)] transition-colors xl:table-row xl:rounded-none xl:border-x-0 xl:border-t-0 xl:shadow-none",
    className
  );
}

function OverviewActionRail({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-stretch gap-1.5 sm:flex-row sm:flex-wrap sm:justify-start sm:gap-2 xl:justify-end",
        className
      )}
    >
      {children}
    </div>
  );
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

function getRequestedDocumentLabel(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return DOCUMENT_REQUEST_TYPE_LABELS[value as DocumentRequestType] || value;
}

function getBillingEntityLabel(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return BILLING_ENTITY_TYPE_LABELS[value as BillingEntityType] || value;
}

function formatLiffContextType(value: string | null | undefined) {
  switch (value) {
    case "utou":
      return "LIFF 1:1";
    case "group":
      return "LIFF Group";
    case "room":
      return "LIFF Room";
    case "external":
      return "External Browser";
    case "none":
      return "Other LINE Surface";
    default:
      return null;
  }
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

function formatDateTime(value: string | null | undefined) {
  return formatBangkokDateTime(value);
}

function formatDate(value: string | null | undefined) {
  return formatBangkokDate(value);
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

function formatCurrency(value: number | string) {
  return `฿${THAI_NUMBER_FORMATTER.format(Number(value))}`;
}

function getOverviewMetaChips(
  row: Pick<
    AdminOverviewRow,
    | "documentRequestType"
    | "billingEntityType"
    | "liffContextType"
    | "liffAppLanguage"
    | "lineFriendshipStatus"
  >
) {
  const chips = [
    getRequestedDocumentLabel(row.documentRequestType),
    getBillingEntityLabel(row.billingEntityType),
    formatLiffContextType(row.liffContextType),
    row.liffAppLanguage ? `lang ${row.liffAppLanguage}` : null,
    row.lineFriendshipStatus === true
      ? "OA friend"
      : row.lineFriendshipStatus === false
        ? "OA not-friend"
        : null,
  ].filter((value): value is string => Boolean(value));

  return chips;
}

function OverviewMetaChips({
  row,
}: {
  row: Pick<
    AdminOverviewRow,
    | "documentRequestType"
    | "billingEntityType"
    | "liffContextType"
    | "liffAppLanguage"
    | "lineFriendshipStatus"
  >;
}) {
  const chips = getOverviewMetaChips(row);

  if (chips.length === 0) {
    return null;
  }

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {chips.map((chip) => (
        <span
          key={chip}
          className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600"
        >
          {chip}
        </span>
      ))}
    </div>
  );
}

function getLeadAssetSummary(lead: SnapshotLead) {
  const uploadedReferenceCount = Array.isArray(lead.lead_media_assets)
    ? lead.lead_media_assets.length
    : 0;
  const aiPreviewCount = Array.isArray(lead.ai_generated_images)
    ? lead.ai_generated_images.length
    : 0;

  if (uploadedReferenceCount > 0) {
    return `ไฟล์ลูกค้า ${uploadedReferenceCount}`;
  }

  if (aiPreviewCount > 0) {
    return `AI preview ${aiPreviewCount}`;
  }

  return hasLeadAiSeedPrompt(lead) ? "มี AI prompt" : "manual design";
}

function getLeadAiPrompt(lead: SnapshotLead) {
  return getLeadAiDisplayPrompt(lead);
}

function getLeadPreviewImageUrl(lead: SnapshotLead) {
  const uploadedPreview = lead.lead_media_assets?.find(
    (asset) => asset.signed_url && asset.mime_type?.startsWith("image/")
  );

  if (uploadedPreview?.signed_url) {
    return uploadedPreview.signed_url;
  }

  return Array.isArray(lead.ai_generated_images) ? lead.ai_generated_images[0] || null : null;
}

function getProductionEventPreviewImageUrl(event: SnapshotProductionEvent) {
  return event.job_media_assets?.find((asset) => asset.signed_url)?.signed_url || null;
}

function getConversationBundle(snapshot: BackofficeSnapshot, conversationId: string) {
  const lead = snapshot.leads.find((candidate) => candidate.conversation_id === conversationId) || null;
  const quote = snapshot.quotes.find((candidate) => candidate.leads?.conversation_id === conversationId) || null;
  const job = snapshot.jobs.find((candidate) => candidate.quotes?.leads?.conversation_id === conversationId) || null;
  return { lead, quote, job };
}

export type AdminViewStripItem = {
  key: string;
  label: string;
  description: string;
  count: number;
  icon: LucideIcon;
  active: boolean;
};

export type AdminSummaryStripTone = "neutral" | "info" | "success" | "warning" | "danger";

export type AdminSummaryStripItem = {
  label: string;
  value: number;
  hint?: string;
  tone?: AdminSummaryStripTone;
};

function InlineHint({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex size-5 items-center justify-center rounded-full border border-current/15 bg-current/5 text-current/60 transition hover:bg-current/10 hover:text-current"
          aria-label="ดูคำอธิบายเพิ่มเติม"
        >
          <CircleHelp className="size-3" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={8}>
        <p className="max-w-72 leading-5">{text}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export function SurfaceSection({
  title,
  description,
  count,
  children,
  action,
}: {
  title: string;
  description?: string;
  count?: number;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Card
      size="sm"
      className="min-w-0 w-full rounded-[28px] border border-cyan-100/80 bg-white/95 py-0 shadow-[0_16px_42px_rgba(0,62,93,0.08)]"
    >
      <CardHeader className="gap-3 border-b border-slate-100 px-4 py-4">
        {action ? <CardAction>{action}</CardAction> : null}
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-lg font-semibold text-slate-950">{title}</CardTitle>
          {description ? <InlineHint text={description} /> : null}
          {typeof count === "number" ? (
            <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">
              {count} รายการ
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="px-4 py-5">{children}</CardContent>
    </Card>
  );
}

export function AdminSectionBlock(props: {
  title: string;
  description?: string;
  count?: number;
  children: ReactNode;
  action?: ReactNode;
}) {
  return <SurfaceSection {...props} />;
}

export function AdminEmptyStateBlock({ title }: { title: string }) {
  return (
    <div className="rounded-[24px] border border-dashed border-cyan-200 bg-cyan-50/40 px-4 py-8 text-center text-sm text-slate-500">
      {title}
    </div>
  );
}

export function AdminViewStripBlock({
  items,
  onSelect,
}: {
  items: AdminViewStripItem[];
  onSelect: (key: string) => void;
}) {
  return (
    <div className="px-4 py-3">
      <div className="rounded-[24px] border border-cyan-100 bg-white/95 p-2.5 shadow-[0_16px_40px_rgba(0,62,93,0.08)]">
        <div className="flex flex-wrap gap-2">
          {items.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onSelect(item.key)}
                className={cn(
                  "inline-flex min-w-fit items-center gap-2 rounded-full px-3.5 py-2 text-left text-sm font-semibold transition",
                  item.active
                    ? "bg-[linear-gradient(135deg,#00AEEF_0%,#0098d0_100%)] text-white shadow-[0_14px_30px_rgba(0,94,140,0.2)]"
                    : "bg-white text-slate-700 hover:bg-cyan-50"
                )}
              >
                <div className={cn("rounded-full p-1.5", item.active ? "bg-white/12" : "bg-cyan-50") }>
                  <Icon className="size-3.5" />
                </div>
                <span>{item.label}</span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-medium",
                    item.active
                      ? "bg-white/15 text-white"
                      : "border border-cyan-100 bg-white text-cyan-700"
                  )}
                >
                  {item.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function AdminSummaryStripBlock({ items }: { items: AdminSummaryStripItem[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className={cn(
            "relative overflow-hidden rounded-[24px] border p-5 shadow-[0_16px_34px_rgba(15,23,42,0.05)]",
            item.tone === "success" && "border-emerald-200 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_34%),linear-gradient(180deg,rgba(236,253,245,0.92),rgba(255,255,255,0.96))]",
            item.tone === "warning" && "border-amber-200 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.14),transparent_34%),linear-gradient(180deg,rgba(255,251,235,0.95),rgba(255,255,255,0.98))]",
            item.tone === "danger" && "border-rose-200 bg-[radial-gradient(circle_at_top_left,rgba(244,63,94,0.12),transparent_34%),linear-gradient(180deg,rgba(255,241,242,0.95),rgba(255,255,255,0.98))]",
            (!item.tone || item.tone === "neutral") && "border-cyan-100 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.10),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))]"
          )}
        >
          <div className="flex items-center gap-1.5 text-slate-500">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em]">{item.label}</p>
            {item.hint ? <InlineHint text={item.hint} /> : null}
          </div>
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
          {item.hint ? (
            <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-500">{item.hint}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

const OVERVIEW_QUEUE_FILTERS: Array<{
  key: OverviewFilterKey;
  label: string;
  description: string;
}> = [
  {
    key: "all",
    label: "ทั้งหมด",
    description: "มองทุกคิวในมุมเดียวเพื่อจัดลำดับว่าสิ่งไหนต้องขยับก่อนในรอบนี้",
  },
  {
    key: "escalation",
    label: "Escalation",
    description: "เคสที่ลูกค้าหรือระบบส่งกลับมาให้ทีมตอบทันทีและไม่ควรปล่อยค้าง",
  },
  {
    key: "blocked",
    label: "Workflow ติดค้าง",
    description: "งานที่ flow เดินต่อไม่ได้จนกว่าจะมีคนปลดล็อกหรือเลือกทางไปต่อ",
  },
  {
    key: "waiting-customer",
    label: "รอลูกค้า",
    description: "คิวที่ฝั่งทีมส่งคำถามหรือแบบกลับไปแล้วและกำลังรอข้อมูลเพิ่มจากลูกค้า",
  },
  {
    key: "quote",
    label: "Quote",
    description: "ใบเสนอราคาที่ต้องตามการอนุมัติ การจ่ายเงิน หรือการเปิดงานต่อจากเอกสาร",
  },
  {
    key: "production-review",
    label: "Review",
    description: "หลักฐานจากหน้างานที่ยังรอตรวจ ตีกลับ หรือยังต้องส่งต่อให้ลูกค้าเห็น",
  },
  {
    key: "running-job",
    label: "งานรันอยู่",
    description: "งาน active ที่มี owner ต้องตาม prompt, preview, production link และสถานะหน้างาน",
  },
];

export function OverviewCombinedQueueTable({
  overview,
  baseUrl,
}: {
  overview: AdminOverviewPage;
  baseUrl: string;
}) {
  const activeFilter =
    OVERVIEW_QUEUE_FILTERS.find((item) => item.key === overview.filter) || OVERVIEW_QUEUE_FILTERS[0];
  const paginationStart = overview.totalCount === 0
    ? 0
    : (overview.page - 1) * overview.pageSize + 1;
  const paginationEnd = Math.min(
    overview.page * overview.pageSize,
    overview.totalCount
  );

  function buildOverviewHref(filter: OverviewFilterKey, page: number) {
    const params = new URLSearchParams();

    if (filter !== "all") {
      params.set("filter", filter);
    }

    if (page > 1) {
      params.set("page", String(page));
    }

    const query = params.toString();
    return query ? `/admin?${query}` : "/admin";
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[24px] border border-cyan-100/80 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.12),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.95))] p-3.5 shadow-[0_16px_36px_rgba(0,62,93,0.08)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Queue focus</p>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-slate-950">{activeFilter.label}</h3>
              <Badge variant="outline" className="border-cyan-200 bg-white text-cyan-700">
                {overview.counts[activeFilter.key]} รายการ
              </Badge>
            </div>
            <p className="max-w-3xl text-sm leading-6 text-slate-500">{activeFilter.description}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:min-w-70">
            <div className="rounded-[18px] border border-slate-200 bg-white/85 px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">ตอนนี้แสดง</p>
              <p className="mt-1 text-lg font-semibold text-slate-950">{overview.rows.length}</p>
            </div>
            <div className="rounded-[18px] border border-slate-200 bg-white/85 px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">หน้า</p>
              <p className="mt-1 text-lg font-semibold text-slate-950">{overview.page}/{overview.totalPages}</p>
            </div>
          </div>
        </div>
        <div className="mt-3 overflow-x-auto pb-1">
          <div className="flex min-w-max gap-2 lg:min-w-0 lg:flex-wrap">
            {OVERVIEW_QUEUE_FILTERS.map((item) => {
              const count = overview.counts[item.key];

              return (
                <Link
                  key={item.key}
                  href={buildOverviewHref(item.key, 1)}
                  prefetch={false}
                  aria-current={overview.filter === item.key ? "page" : undefined}
                  className={cn(
                    "inline-flex min-w-fit items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-semibold whitespace-nowrap transition",
                    overview.filter === item.key
                      ? "border-cyan-200 bg-[linear-gradient(135deg,#00AEEF_0%,#0098d0_100%)] text-white shadow-[0_14px_30px_rgba(0,94,140,0.2)]"
                      : "border-cyan-100 bg-white text-slate-600 hover:border-cyan-200 hover:bg-cyan-50/80"
                  )}
                >
                  <span>{item.label}</span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                      overview.filter === item.key ? "bg-white/15 text-white" : "border border-cyan-100 bg-cyan-50 text-cyan-700"
                    )}
                  >
                    {count}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
      <AdminOperationalTable
        columns={["คิว", "ลูกค้า", "บริบท", "สถานะ", "Actions"]}
        emptyTitle="ตอนนี้ยังไม่มีรายการในตารางหลัก"
        rows={
          overview.rows.length > 0
            ? overview.rows.map((row: AdminOverviewRow, index) => {
                if (row.kind === "escalation") {
                  return (
                    <TableRow
                      key={`overview-escalation-${row.id}-${index}`}
                      className={getOverviewRowClassName(
                        "border-rose-100 bg-rose-50/60 hover:bg-rose-50/80 xl:border-slate-100 xl:bg-rose-50/30 xl:hover:bg-rose-50/45"
                      )}
                    >
                      <TableCell className={getOverviewCellClassName()}>
                        <OverviewMobileLabel>คิว</OverviewMobileLabel>
                        <OverviewCellFrame tone="danger" className="min-w-36 space-y-2">
                          <Badge className="border border-rose-200 bg-rose-100 text-rose-800">Escalation</Badge>
                          <p className="text-xs font-medium text-rose-700">{formatDateTime(row.createdAt)}</p>
                        </OverviewCellFrame>
                      </TableCell>
                      <TableCell className={getOverviewCellClassName()}>
                        <OverviewMobileLabel>ลูกค้า</OverviewMobileLabel>
                        <OverviewCellFrame className="min-w-44">
                          <p className="text-sm font-semibold text-slate-950">{row.customerLabel}</p>
                          <p className="mt-1 text-xs text-slate-500">{getProductLabel(row.productLabel)}</p>
                          <OverviewMetaChips row={row} />
                        </OverviewCellFrame>
                      </TableCell>
                      <TableCell className={getOverviewCellClassName()}>
                        <OverviewMobileLabel>บริบท</OverviewMobileLabel>
                        <OverviewCellFrame tone="danger" className="min-w-64 space-y-1.5">
                          <p className="text-sm text-rose-900">{row.reason}</p>
                          <p className="text-xs text-slate-500">
                            {row.quoteStatus && row.paymentStatus
                              ? `${getQuoteStatusLabel(row.quoteStatus)} · ${PAYMENT_STATUS_LABELS[row.paymentStatus]}`
                              : "ยังไม่มี quote ผูก"}
                          </p>
                          {row.billingName ? (
                            <p className="text-xs text-slate-500">ออกเอกสาร: {truncateText(row.billingName, 48)}</p>
                          ) : null}
                        </OverviewCellFrame>
                      </TableCell>
                      <TableCell className={getOverviewCellClassName()}>
                        <OverviewMobileLabel>สถานะ</OverviewMobileLabel>
                        <OverviewCellFrame tone="danger" className="space-y-2">
                          <Badge className="border border-rose-200 bg-rose-50 text-rose-700">ต้องตอบตอนนี้</Badge>
                          {row.conversationState ? <p className="text-xs text-slate-500">{WORKFLOW_STATE_LABELS[row.conversationState]}</p> : null}
                        </OverviewCellFrame>
                      </TableCell>
                      <TableCell className={getOverviewActionCellClassName()}>
                        <OverviewMobileLabel>Actions</OverviewMobileLabel>
                        {row.conversationId && row.conversationState ? (
                          <OverviewActionRail>
                            <AdminConversationActions
                              conversationId={row.conversationId}
                              currentState={row.conversationState}
                              compact
                              buttonVariant="default"
                              buttonLabel={getConversationActionLabel(row.conversationState, "escalation")}
                            />
                          </OverviewActionRail>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                }

                if (row.kind === "conversation") {
                  const note = truncateText(row.note, 100);

                  return (
                    <TableRow
                      key={`overview-conversation-${row.filterKey}-${row.id}-${index}`}
                      className={getOverviewRowClassName(
                        cn(
                          row.filterKey === "blocked"
                            ? "border-amber-100 bg-amber-50/60 hover:bg-amber-50/80 xl:border-slate-100 xl:bg-amber-50/20 xl:hover:bg-amber-50/40"
                            : "border-sky-100 bg-sky-50/60 hover:bg-sky-50/80 xl:border-slate-100 xl:bg-sky-50/20 xl:hover:bg-sky-50/40"
                        )
                      )}
                    >
                      <TableCell className={getOverviewCellClassName()}>
                        <OverviewMobileLabel>คิว</OverviewMobileLabel>
                        <OverviewCellFrame tone={row.filterKey === "blocked" ? "warning" : "info"} className="min-w-36 space-y-2">
                          <Badge
                            className={cn(
                              "border",
                              row.filterKey === "blocked"
                                ? "border-amber-200 bg-amber-100 text-amber-800"
                                : "border-sky-200 bg-sky-100 text-sky-800"
                            )}
                          >
                            {row.filterKey === "blocked" ? "Workflow ติดค้าง" : "รอลูกค้าตอบ"}
                          </Badge>
                          <p className="text-xs font-medium text-slate-600">{formatDateTime(row.messageAt)}</p>
                        </OverviewCellFrame>
                      </TableCell>
                      <TableCell className={getOverviewCellClassName()}>
                        <OverviewMobileLabel>ลูกค้า</OverviewMobileLabel>
                        <OverviewCellFrame className="min-w-44">
                          <p className="text-sm font-semibold text-slate-950">{row.customerLabel}</p>
                          <p className="mt-1 text-xs text-slate-500">{getProductLabel(row.productLabel)}</p>
                          <OverviewMetaChips row={row} />
                        </OverviewCellFrame>
                      </TableCell>
                      <TableCell className={getOverviewCellClassName()}>
                        <OverviewMobileLabel>บริบท</OverviewMobileLabel>
                        <OverviewCellFrame tone={row.filterKey === "blocked" ? "warning" : "info"} className="min-w-64 space-y-1.5">
                          <p className="line-clamp-2 text-sm text-slate-700">
                            {note || (row.filterKey === "blocked" ? "ยังต้องมีคนปลดล็อก workflow นี้" : "กำลังรอข้อมูลหรือ feedback เพิ่มจากลูกค้า")}
                          </p>
                          <p className="text-xs text-slate-500">
                            {row.quoteStatus && row.paymentStatus
                              ? `${getQuoteStatusLabel(row.quoteStatus)} · ${PAYMENT_STATUS_LABELS[row.paymentStatus]}`
                              : "ยังไม่มี quote ผูก"}
                          </p>
                          {row.billingName ? (
                            <p className="text-xs text-slate-500">ออกเอกสาร: {truncateText(row.billingName, 48)}</p>
                          ) : null}
                        </OverviewCellFrame>
                      </TableCell>
                      <TableCell className={getOverviewCellClassName()}>
                        <OverviewMobileLabel>สถานะ</OverviewMobileLabel>
                        <OverviewCellFrame tone={row.filterKey === "blocked" ? "warning" : "info"} className="space-y-2">
                          <Badge className={cn("border", statusToneClass(row.conversationState))}>{WORKFLOW_STATE_LABELS[row.conversationState]}</Badge>
                          <p className="text-xs text-slate-500">
                            {row.jobStatus ? JOB_STATUS_LABELS[row.jobStatus] || row.jobStatus : "ยังไม่มี job"}
                          </p>
                        </OverviewCellFrame>
                      </TableCell>
                      <TableCell className={getOverviewActionCellClassName()}>
                        <OverviewMobileLabel>Actions</OverviewMobileLabel>
                        <OverviewActionRail>
                          <AdminConversationActions
                            conversationId={row.conversationId}
                            currentState={row.conversationState}
                            compact
                            buttonVariant="default"
                            buttonLabel={getConversationActionLabel(row.conversationState, row.filterKey)}
                          />
                        </OverviewActionRail>
                      </TableCell>
                    </TableRow>
                  );
                }

                if (row.kind === "quote") {
                  return (
                    <TableRow
                      key={`overview-quote-${row.quoteId}-${index}`}
                      className={getOverviewRowClassName(
                        "border-violet-100 bg-violet-50/60 hover:bg-violet-50/80 xl:border-slate-100 xl:bg-violet-50/20 xl:hover:bg-violet-50/35"
                      )}
                    >
                      <TableCell className={getOverviewCellClassName()}>
                        <OverviewMobileLabel>คิว</OverviewMobileLabel>
                        <OverviewCellFrame tone="accent" className="min-w-36 space-y-2">
                          <Badge className="border border-violet-200 bg-violet-100 text-violet-800">Quote ติดค้าง</Badge>
                          <p className="text-xs font-medium text-violet-700">{formatDateTime(row.createdAt)}</p>
                        </OverviewCellFrame>
                      </TableCell>
                      <TableCell className={getOverviewCellClassName()}>
                        <OverviewMobileLabel>ลูกค้า</OverviewMobileLabel>
                        <OverviewCellFrame className="min-w-44">
                          <p className="text-sm font-semibold text-slate-950">{row.customerLabel}</p>
                          <p className="mt-1 text-xs text-slate-500">{getProductLabel(row.productLabel)}</p>
                          <OverviewMetaChips row={row} />
                        </OverviewCellFrame>
                      </TableCell>
                      <TableCell className={getOverviewCellClassName()}>
                        <OverviewMobileLabel>บริบท</OverviewMobileLabel>
                        <OverviewCellFrame tone="accent" className="min-w-64 space-y-1.5">
                          <p className="text-sm text-slate-700">ยอด {formatCurrency(row.total)} · {PAYMENT_TERM_LABELS[row.paymentTerms]}</p>
                          <p className="text-xs text-slate-500">Track {formatTrackingCode(row.publicToken)}</p>
                          {row.billingName ? (
                            <p className="text-xs text-slate-500">ออกเอกสาร: {truncateText(row.billingName, 48)}</p>
                          ) : null}
                        </OverviewCellFrame>
                      </TableCell>
                      <TableCell className={getOverviewCellClassName()}>
                        <OverviewMobileLabel>สถานะ</OverviewMobileLabel>
                        <OverviewCellFrame tone="accent" className="space-y-2">
                          <Badge className={cn("border", statusToneClass(row.quoteStatus))}>{getQuoteStatusLabel(row.quoteStatus)}</Badge>
                          <p className="text-xs text-slate-500">{PAYMENT_STATUS_LABELS[row.paymentStatus]} · {row.hasJob ? "มี job แล้ว" : "ยังไม่สร้าง job"}</p>
                        </OverviewCellFrame>
                      </TableCell>
                      <TableCell className={getOverviewActionCellClassName()}>
                        <OverviewMobileLabel>Actions</OverviewMobileLabel>
                        <OverviewActionRail className="xl:min-w-52">
                          <AdminQuoteActions
                            quoteId={row.quoteId}
                            publicToken={row.publicToken}
                            quoteStatus={row.quoteStatus}
                            paymentTerms={row.paymentTerms}
                            paymentStatus={row.paymentStatus}
                            hasJob={row.hasJob}
                            requestedDocumentType={row.documentRequestType}
                            commercialOrder={row.commercialOrder}
                            commercialReceiverEntities={overview.commercialReceiverEntities}
                            buttonVariant="default"
                            buttonLabel={getQuoteActionLabel(
                              row.quoteStatus,
                              row.paymentTerms,
                              row.paymentStatus,
                              row.hasJob
                            )}
                          />
                          <a href={`${baseUrl}/quote/${row.publicToken}`} target="_blank" rel="noreferrer" className={OVERVIEW_ACTION_LINK_CLASS}>
                            เปิด quote
                          </a>
                        </OverviewActionRail>
                      </TableCell>
                    </TableRow>
                  );
                }

                if (row.kind === "production-review") {
                  return (
                    <TableRow
                      key={`overview-review-${row.eventId}-${index}`}
                      className={getOverviewRowClassName(
                        "border-cyan-100 bg-cyan-50/55 hover:bg-cyan-50/75 xl:border-slate-100 xl:bg-cyan-50/25 xl:hover:bg-cyan-50/38"
                      )}
                    >
                      <TableCell className={getOverviewCellClassName()}>
                        <OverviewMobileLabel>คิว</OverviewMobileLabel>
                        <OverviewCellFrame tone="info" className="min-w-36 space-y-2">
                          <Badge className="border border-cyan-200 bg-cyan-100 text-cyan-800">Production Review</Badge>
                          <p className="text-xs font-medium text-cyan-700">{formatDateTime(row.createdAt)}</p>
                        </OverviewCellFrame>
                      </TableCell>
                      <TableCell className={getOverviewCellClassName()}>
                        <OverviewMobileLabel>ลูกค้า</OverviewMobileLabel>
                        <OverviewCellFrame className="min-w-44">
                          <p className="text-sm font-semibold text-slate-950">{row.customerLabel}</p>
                          <p className="mt-1 text-xs text-slate-500">{getProductLabel(row.productLabel)}</p>
                          <OverviewMetaChips row={row} />
                        </OverviewCellFrame>
                      </TableCell>
                      <TableCell className={getOverviewCellClassName()}>
                        <OverviewMobileLabel>บริบท</OverviewMobileLabel>
                        <OverviewCellFrame tone="info" className="min-w-64 space-y-1.5">
                          <p className="text-sm text-slate-700">{PRODUCTION_EVENT_TYPE_LABELS[row.eventType]} · ไฟล์ {row.assetCount} ชิ้น</p>
                          <p className="line-clamp-2 text-xs text-slate-500">{row.note || (row.submittedByLabel ? `ส่งโดย ${row.submittedByLabel}` : "ยังไม่มี note เพิ่มเติม")}</p>
                          {row.billingName ? (
                            <p className="text-xs text-slate-500">ออกเอกสาร: {truncateText(row.billingName, 48)}</p>
                          ) : null}
                        </OverviewCellFrame>
                      </TableCell>
                      <TableCell className={getOverviewCellClassName()}>
                        <OverviewMobileLabel>สถานะ</OverviewMobileLabel>
                        <OverviewCellFrame tone="info" className="space-y-2">
                          <Badge className={cn("border", statusToneClass(row.reviewStatus))}>{getReviewStatusLabel(row.reviewStatus)}</Badge>
                          {row.sentToCustomerAt ? <p className="text-xs text-slate-500">ส่งลูกค้า {formatDate(row.sentToCustomerAt)}</p> : null}
                        </OverviewCellFrame>
                      </TableCell>
                      <TableCell className={getOverviewActionCellClassName()}>
                        <OverviewMobileLabel>Actions</OverviewMobileLabel>
                        <OverviewActionRail className="xl:min-w-56">
                          <ProductionReviewActions
                            eventId={row.eventId}
                            reviewStatus={row.reviewStatus}
                            buttonVariant="default"
                            buttonLabel="ตรวจหลักฐาน"
                          />
                          {row.statusToken ? (
                            <a href={`${baseUrl}/status/${row.statusToken}`} target="_blank" rel="noreferrer" className={OVERVIEW_ACTION_LINK_CLASS}>
                              เปิดหน้า status
                            </a>
                          ) : null}
                          {row.productionLinkUrl ? <ProductionLinkCopy url={row.productionLinkUrl} compact buttonVariant="secondary" /> : null}
                        </OverviewActionRail>
                      </TableCell>
                    </TableRow>
                  );
                }

                if (row.kind === "running-job") {
                  const promptPreview = truncateText(
                    row.promptText?.replace(/\s*\n+\s*/g, " · "),
                    96
                  );

                  return (
                    <TableRow
                      key={`overview-running-job-${row.jobId}-${index}`}
                      className={getOverviewRowClassName(
                        "border-emerald-100 bg-emerald-50/55 hover:bg-emerald-50/75 xl:border-slate-100 xl:bg-emerald-50/20 xl:hover:bg-emerald-50/34"
                      )}
                    >
                      <TableCell className={getOverviewCellClassName()}>
                        <OverviewMobileLabel>คิว</OverviewMobileLabel>
                        <OverviewCellFrame tone="success" className="min-w-36 space-y-2">
                          <Badge className="border border-emerald-200 bg-emerald-100 text-emerald-800">งานที่กำลังรันอยู่</Badge>
                          <p className="text-xs font-medium text-emerald-700">เริ่ม {formatDate(row.createdAt)}</p>
                        </OverviewCellFrame>
                      </TableCell>
                      <TableCell className={getOverviewCellClassName()}>
                        <OverviewMobileLabel>ลูกค้า</OverviewMobileLabel>
                        <OverviewCellFrame className="min-w-44 space-y-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-950">{row.customerLabel}</p>
                            <p className="mt-1 text-xs text-slate-500">{getProductLabel(row.productLabel)}</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {row.previewImageUrl ? (
                              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pr-3 pl-1 text-xs font-medium text-slate-700">
                                <Image src={row.previewImageUrl} alt="Running job preview" width={32} height={32} unoptimized className="h-8 w-8 rounded-full object-cover" />
                                <span>มี preview ล่าสุด</span>
                              </div>
                            ) : null}
                            <OverviewInlinePill>
                              {row.uploadedReferenceCount > 0
                                ? `ไฟล์ลูกค้า ${row.uploadedReferenceCount}`
                                : "ยังไม่มีไฟล์ลูกค้า"}
                            </OverviewInlinePill>
                            {row.previewImageCount > 0 ? (
                              <OverviewInlinePill tone="accent">AI preview {row.previewImageCount}</OverviewInlinePill>
                            ) : null}
                          </div>
                          <OverviewMetaChips row={row} />
                        </OverviewCellFrame>
                      </TableCell>
                      <TableCell className={getOverviewCellClassName()}>
                        <OverviewMobileLabel>บริบท</OverviewMobileLabel>
                        <OverviewCellFrame tone="success" className="min-w-64 space-y-2">
                          <div className="flex flex-wrap gap-2">
                            <OverviewInlinePill tone="accent">Track {formatTrackingCode(row.publicToken)}</OverviewInlinePill>
                            <OverviewInlinePill>
                              {row.pendingReviewCount > 0 ? `รอตรวจ ${row.pendingReviewCount}` : "ไม่มี review ค้าง"}
                            </OverviewInlinePill>
                            <OverviewInlinePill>
                              {row.assignedTo ? `owner ${row.assignedTo}` : "ยังไม่ assign owner"}
                            </OverviewInlinePill>
                            {row.aiImageStatus && row.aiImageStatus !== "not_requested" ? (
                              <OverviewInlinePill>AI {row.aiImageStatus}</OverviewInlinePill>
                            ) : null}
                          </div>
                          {row.promptRoutingLabel ? (
                            <p className="text-xs font-medium text-slate-600">{row.promptRoutingLabel}</p>
                          ) : null}
                          {row.billingName ? (
                            <p className="text-xs text-slate-500">ออกเอกสาร: {truncateText(row.billingName, 48)}</p>
                          ) : null}
                          {promptPreview ? (
                            <p className="line-clamp-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-3 py-2 text-xs leading-5 text-slate-500">
                              Prompt: {promptPreview}
                            </p>
                          ) : null}
                        </OverviewCellFrame>
                      </TableCell>
                      <TableCell className={getOverviewCellClassName()}>
                        <OverviewMobileLabel>สถานะ</OverviewMobileLabel>
                        <OverviewCellFrame tone="success" className="space-y-2">
                          <Badge className={cn("border", statusToneClass(row.jobStatus))}>{JOB_STATUS_LABELS[row.jobStatus] || row.jobStatus}</Badge>
                          <p className="text-xs text-slate-500">
                            {row.productionStatus ? `production ${row.productionStatus}` : "ยังไม่ตั้ง production state"}
                          </p>
                        </OverviewCellFrame>
                      </TableCell>
                      <TableCell className={getOverviewActionCellClassName()}>
                        <OverviewMobileLabel>Actions</OverviewMobileLabel>
                        <div className="min-w-0 space-y-1.5 sm:space-y-2 xl:min-w-60">
                          <OverviewActionRail>
                            <LeadSendPreviewActions
                              leadId={row.leadId}
                              previewCount={row.previewImageCount}
                              buttonVariant={row.previewImageCount > 0 ? "default" : "outline"}
                            />
                            <AdminJobActions
                              jobId={row.jobId}
                              currentStatus={row.jobStatus}
                              buttonVariant={row.previewImageCount > 0 ? "secondary" : "default"}
                              buttonLabel={getJobActionLabel(row.jobStatus)}
                            />
                          </OverviewActionRail>
                          <OverviewActionRail>
                            <LeadAiPreviewActions
                              leadId={row.leadId}
                              prompt={row.promptText}
                              status={row.aiImageStatus || "not_requested"}
                              buttonVariant="secondary"
                            />
                            <LeadPromptActions
                              leadId={row.leadId}
                              prompt={row.promptText}
                              promptRoutingLabel={row.promptRoutingLabel}
                              buttonVariant="outline"
                              buttonLabel="ดู/แก้ prompt"
                            />
                          </OverviewActionRail>
                          <OverviewActionRail>
                            {row.productionLinkUrl ? <ProductionLinkCopy url={row.productionLinkUrl} compact buttonVariant="secondary" /> : null}
                            {row.previewImageUrl ? (
                              <a href={row.previewImageUrl} target="_blank" rel="noreferrer" className={OVERVIEW_ACTION_LINK_CLASS}>
                                เปิด preview
                              </a>
                            ) : null}
                            {row.publicToken ? (
                              <a href={`${baseUrl}/status/${row.publicToken}`} target="_blank" rel="noreferrer" className={OVERVIEW_ACTION_LINK_CLASS}>
                                เปิดหน้า status
                              </a>
                            ) : null}
                          </OverviewActionRail>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                }

                return null;
              })
            : null
        }
      />

      <div className="flex flex-col gap-3 rounded-[22px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
        <p>
          แสดง {paginationStart}-{paginationEnd} จาก {overview.totalCount} รายการ
        </p>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {overview.page > 1 ? (
            <Link
              href={buildOverviewHref(overview.filter, overview.page - 1)}
              prefetch={false}
              className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              หน้าก่อน
            </Link>
          ) : (
            <span className="rounded-full border border-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-300">
              หน้าก่อน
            </span>
          )}
          <span className="text-xs font-semibold text-slate-500">
            หน้า {overview.page} / {overview.totalPages}
          </span>
          {overview.page < overview.totalPages ? (
            <Link
              href={buildOverviewHref(overview.filter, overview.page + 1)}
              prefetch={false}
              className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-700 transition hover:bg-cyan-100"
            >
              หน้าถัดไป
            </Link>
          ) : (
            <span className="rounded-full border border-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-300">
              หน้าถัดไป
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function AdminMetricCard({
  title,
  value,
  accent,
}: {
  title: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="flex min-h-16 items-center gap-3 rounded-[20px] border border-cyan-200/20 bg-white/10 px-3 py-2.5 backdrop-blur-sm">
      <p className={cn("shrink-0 text-2xl font-bold leading-none", accent)}>{value}</p>
      <p className="text-[11px] leading-4 text-white/72">{title}</p>
    </div>
  );
}

export type AdminStuckQueueItem =
  | { type: "quote"; quote: SnapshotQuote }
  | { type: "conversation"; conversation: SnapshotConversation };

export function AdminMustDoNowQueueContent({ items }: { items: SnapshotLead[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <>
      {items.map((lead) => (
        <QueueCard
          key={lead.id}
          title={customerName(lead.customers)}
          meta={`${getProductLabel(lead.product_type)} · ${getLeadStatusLabel(lead.status)}`}
          badge={
            <Badge className={cn("border", statusToneClass(lead.design_status || lead.status))}>
              {DESIGN_STATUS_LABELS[lead.design_status || "not_started"] || getLeadStatusLabel(lead.status)}
            </Badge>
          }
          footer={
            <div className="flex flex-wrap items-center gap-2">
              <LeadAiPreviewActions
                leadId={lead.id}
                prompt={getLeadAiPrompt(lead)}
                status={lead.ai_image_status || "not_requested"}
              />
              <LeadSendPreviewActions
                leadId={lead.id}
                previewCount={lead.ai_generated_images?.length || 0}
              />
              <AdminLeadDesignActions leadId={lead.id} designStatus={lead.design_status || "not_started"} />
            </div>
          }
        >
          <p className="text-xs text-slate-500">
            {getLeadDesignRoutingSummary(lead)}
          </p>
        </QueueCard>
      ))}
    </>
  );
}

export type AdminWaitingCustomerQueueItem =
  | { type: "lead"; lead: SnapshotLead }
  | { type: "conversation"; conversation: SnapshotConversation };

export function AdminWaitingCustomerQueueContent({
  items,
}: {
  items: AdminWaitingCustomerQueueItem[];
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <>
      {items.map((item) => {
        if (item.type === "lead") {
          return (
            <QueueCard
              key={item.lead.id}
              title={customerName(item.lead.customers)}
              meta={`${getProductLabel(item.lead.product_type)} · ${item.lead.design_status ? DESIGN_STATUS_LABELS[item.lead.design_status] : "รอลูกค้า"}`}
              badge={
                <Badge className={cn("border", statusToneClass(item.lead.design_status || item.lead.status))}>
                  {item.lead.design_status ? DESIGN_STATUS_LABELS[item.lead.design_status] : "รอลูกค้า"}
                </Badge>
              }
              footer={
                <div className="flex flex-wrap items-center gap-2">
                  <LeadAiPreviewActions
                    leadId={item.lead.id}
                    prompt={getLeadAiPrompt(item.lead)}
                    status={item.lead.ai_image_status || "not_requested"}
                  />
                  <AdminLeadDesignActions
                    leadId={item.lead.id}
                    designStatus={item.lead.design_status || "not_started"}
                  />
                </div>
              }
            >
              <p className="text-xs text-slate-500">
                {item.lead.hold_reason || "ลูกค้ากำลังตรวจแบบหรือต้องส่งข้อมูลเพิ่ม"}
              </p>
            </QueueCard>
          );
        }

        return (
          <QueueCard
            key={item.conversation.id}
            title={`LINE ${item.conversation.line_user_id.slice(0, 12)}...`}
            meta={WORKFLOW_STATE_LABELS[item.conversation.state]}
            badge={
              <Badge className={cn("border", statusToneClass(item.conversation.state))}>
                {WORKFLOW_STATE_LABELS[item.conversation.state]}
              </Badge>
            }
            footer={
              <div className="flex justify-end">
                <AdminConversationActions
                  conversationId={item.conversation.id}
                  currentState={item.conversation.state}
                  compact
                />
              </div>
            }
          >
            <p className="text-xs text-slate-500">รอข้อความหรือการตอบกลับจากลูกค้า</p>
          </QueueCard>
        );
      })}
    </>
  );
}

export function AdminStuckQueueContent({
  items,
  snapshot,
  baseUrl,
}: {
  items: AdminStuckQueueItem[];
  snapshot: BackofficeSnapshot;
  baseUrl: string;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <>
      <div className="space-y-3 xl:hidden">
        {items.map((item) => {
          if (item.type === "quote") {
            const quote = item.quote;
            return (
              <QueueCard
                key={quote.id}
                title={customerName(quote.leads?.customers)}
                meta={`${getProductLabel(quote.leads?.product_type)} · ${formatCurrency(quote.total)} · Track ${formatTrackingCode(quote.public_token)}`}
                badge={<Badge className={cn("border", statusToneClass(quote.status))}>{getQuoteStatusLabel(quote.status)}</Badge>}
                footer={
                  <div className="flex items-center justify-between gap-2">
                    <a href={`${baseUrl}/quote/${quote.public_token}`} target="_blank" rel="noreferrer" className={OVERVIEW_ACTION_LINK_CLASS}>
                      เปิด quote
                    </a>
                    <AdminQuoteActions
                      quoteId={quote.id}
                      publicToken={quote.public_token}
                      quoteStatus={quote.status}
                      paymentTerms={quote.payment_terms}
                      paymentStatus={quote.payment_status}
                      hasJob={Array.isArray(quote.jobs) && quote.jobs.length > 0}
                      requestedDocumentType={quote.leads?.requested_document_type || null}
                      commercialOrder={quote.commercialOrder || null}
                      commercialReceiverEntities={snapshot.commercialReceiverEntities}
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

      <div className="hidden xl:block">
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
                          <a href={`${baseUrl}/quote/${quote.public_token}`} target="_blank" rel="noreferrer" className={OVERVIEW_ACTION_LINK_CLASS}>
                            เปิด quote
                          </a>
                          <AdminQuoteActions
                            quoteId={quote.id}
                            publicToken={quote.public_token}
                            quoteStatus={quote.status}
                            paymentTerms={quote.payment_terms}
                            paymentStatus={quote.payment_status}
                            hasJob={Array.isArray(quote.jobs) && quote.jobs.length > 0}
                            requestedDocumentType={quote.leads?.requested_document_type || null}
                            commercialOrder={quote.commercialOrder || null}
                            commercialReceiverEntities={snapshot.commercialReceiverEntities}
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

export function AdminEscalationsQueueContent({ items }: { items: SnapshotEscalation[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <>
      <div className="space-y-3 xl:hidden">
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

      <div className="hidden xl:block">
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

export function AdminProductionReviewQueueContent({ items }: { items: SnapshotProductionEvent[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <>
      <div className="space-y-3 xl:hidden">
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

      <div className="hidden xl:block">
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
                    <td className="max-w-65 px-4 py-3 text-slate-600">
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

function AdminOperationalTable({
  columns,
  rows,
  emptyTitle,
}: {
  columns: string[];
  rows: ReactNode;
  emptyTitle: string;
}) {
  return (
    <div className="rounded-[26px] border border-slate-200/90 bg-white/70 p-3 shadow-[0_1px_0_rgba(15,23,42,0.02)] xl:overflow-hidden xl:bg-white xl:p-0">
      <div className="overflow-visible xl:overflow-x-auto">
        <Table className="border-separate [border-spacing:0_0.75rem] xl:border-collapse xl:[border-spacing:0] [&_td]:align-top [&_tr]:border-slate-100">
          <TableHeader className="hidden bg-slate-50/85 xl:table-header-group">
            <TableRow className="hover:bg-slate-50/85">
              {columns.map((column) => (
                <TableHead key={column} className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {column}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody className="block space-y-3 xl:table-row-group xl:space-y-0 [&_tr:last-child]:border-0">
            {rows || (
              <TableRow className="block rounded-[22px] border border-dashed border-cyan-200 bg-cyan-50/40 xl:table-row xl:rounded-none xl:border-0 xl:bg-transparent">
                <TableCell colSpan={columns.length} className="block px-4 py-8 text-center text-sm text-slate-500 xl:table-cell">
                  {emptyTitle}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function DesignQueueTable({ leads }: { leads: SnapshotLead[] }) {
  return (
    <AdminOperationalTable
      columns={["ลูกค้า", "งาน", "สถานะ", "สัญญาณ", "หลักฐาน", "Actions"]}
      emptyTitle="ตอนนี้ไม่มีคิวแบบที่ทีมต้องขยับ"
      rows={
        leads.length > 0
          ? leads.map((lead) => {
              const previewImageUrl = getLeadPreviewImageUrl(lead);
              const leadNote = truncateText(
                lead.note_from_form || lead.reference_info || lead.note_from_chat,
                88
              );

              return (
                <TableRow key={lead.id} className="align-top">
                  <TableCell className="px-4 py-4 align-top whitespace-normal">
                    <div className="min-w-44">
                      <p className="text-sm font-semibold text-slate-950">{customerName(lead.customers)}</p>
                      <p className="mt-1 text-xs text-slate-500">{getLeadStatusLabel(lead.status)}</p>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-4 align-top whitespace-normal">
                    <div className="min-w-52">
                      <p className="text-sm font-medium text-slate-900">{getProductLabel(lead.product_type)}</p>
                      <p className="mt-1 text-xs text-slate-500">{formatLeadDimensions(lead)}</p>
                      {leadNote ? <p className="mt-2 text-xs leading-5 text-slate-500">{leadNote}</p> : null}
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-4 align-top whitespace-normal">
                    <div className="space-y-2">
                      <Badge className={cn("border", statusToneClass(lead.design_status || lead.status))}>
                        {DESIGN_STATUS_LABELS[lead.design_status || "not_started"] || "ยังไม่เริ่มแบบ"}
                      </Badge>
                      {lead.ai_image_status ? (
                        <p className="text-xs text-slate-500">AI {lead.ai_image_status}</p>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-4 align-top whitespace-normal">
                    <div className="space-y-1 text-xs text-slate-600">
                      <p>{lead.assigned_designer ? `designer ${lead.assigned_designer}` : "ยังไม่ assign designer"}</p>
                      <p>{lead.due_date ? `กำหนดใช้ ${formatDate(lead.due_date)}` : "ยังไม่มีกำหนดใช้"}</p>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-4 align-top whitespace-normal">
                    <div className="flex min-w-36 items-start gap-3">
                      {previewImageUrl ? (
                        <a
                          href={previewImageUrl}
                          target="_blank"
                          rel="noreferrer"
                          aria-label="เปิด preview ของ lead ในแท็บใหม่"
                          title="เปิด preview ของ lead ในแท็บใหม่"
                          className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
                        >
                          <Image src={previewImageUrl} alt="Lead preview" width={56} height={56} unoptimized className="h-14 w-14 object-cover" />
                        </a>
                      ) : null}
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-slate-700">{getLeadAssetSummary(lead)}</p>
                        <p className="text-xs text-slate-500">
                          {Array.isArray(lead.lead_media_assets) && lead.lead_media_assets.length > 0
                            ? "อ้างอิงจากลูกค้า"
                            : Array.isArray(lead.ai_generated_images) && lead.ai_generated_images.length > 0
                              ? "preview พร้อมส่ง"
                              : "ยังไม่มี preview asset"}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-4 align-top whitespace-normal">
                    <div className="flex min-w-48 flex-wrap items-center justify-end gap-2">
                      <LeadAiPreviewActions leadId={lead.id} prompt={getLeadAiPrompt(lead)} status={lead.ai_image_status || "not_requested"} />
                      <LeadSendPreviewActions
                        leadId={lead.id}
                        previewCount={lead.ai_generated_images?.length || 0}
                      />
                      <AdminLeadDesignActions leadId={lead.id} designStatus={lead.design_status || "not_started"} />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          : null
      }
    />
  );
}

export function WaitingCustomerDesignTable({ leads }: { leads: SnapshotLead[] }) {
  return (
    <AdminOperationalTable
      columns={["ลูกค้า", "งาน", "เหตุผลที่รอ", "หลักฐาน", "Actions"]}
      emptyTitle="ตอนนี้ไม่มีงานที่รอลูกค้าตรวจแบบ"
      rows={
        leads.length > 0
          ? leads.map((lead) => {
              const previewImageUrl = getLeadPreviewImageUrl(lead);
              const waitingNote = truncateText(
                lead.hold_reason || lead.note_from_form || lead.note_from_chat,
                100
              );

              return (
                <TableRow key={lead.id} className="align-top">
                  <TableCell className="px-4 py-4 align-top whitespace-normal">
                    <div className="min-w-44">
                      <p className="text-sm font-semibold text-slate-950">{customerName(lead.customers)}</p>
                      <p className="mt-1 text-xs text-slate-500">{getProductLabel(lead.product_type)}</p>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-4 align-top whitespace-normal">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-slate-900">{formatLeadDimensions(lead)}</p>
                      <Badge className={cn("border", statusToneClass(lead.design_status || lead.status))}>
                        {lead.design_status ? DESIGN_STATUS_LABELS[lead.design_status] : "รอลูกค้า"}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-4 align-top whitespace-normal">
                    <div className="min-w-56">
                      <p className="text-sm text-slate-700">{lead.hold_reason || "ลูกค้ากำลังตรวจแบบ"}</p>
                      {waitingNote ? <p className="mt-2 text-xs leading-5 text-slate-500">{waitingNote}</p> : null}
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-4 align-top whitespace-normal">
                    <div className="flex min-w-36 items-start gap-3">
                      {previewImageUrl ? (
                        <a href={previewImageUrl} target="_blank" rel="noreferrer" className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                          <Image src={previewImageUrl} alt="Customer waiting preview" width={56} height={56} unoptimized className="h-14 w-14 object-cover" />
                        </a>
                      ) : null}
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-slate-700">{getLeadAssetSummary(lead)}</p>
                        <p className="text-xs text-slate-500">{lead.ai_generated_images?.length ? `มีภาพ ${lead.ai_generated_images.length} แบบ` : "รอ feedback จากลูกค้า"}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-4 align-top whitespace-normal">
                    <div className="flex min-w-48 flex-wrap items-center justify-end gap-2">
                      <LeadAiPreviewActions leadId={lead.id} prompt={getLeadAiPrompt(lead)} status={lead.ai_image_status || "not_requested"} />
                      <LeadSendPreviewActions
                        leadId={lead.id}
                        previewCount={lead.ai_generated_images?.length || 0}
                      />
                      <AdminLeadDesignActions leadId={lead.id} designStatus={lead.design_status || "not_started"} />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          : null
      }
    />
  );
}

export function ProductionReviewTable({ items, baseUrl }: { items: SnapshotProductionEvent[]; baseUrl: string }) {
  return (
    <AdminOperationalTable
      columns={["ลูกค้า", "ประเภท", "ไฟล์", "รีวิว", "Actions"]}
      emptyTitle="ยังไม่มีหลักฐานจาก production ที่รอ review"
      rows={
        items.length > 0
          ? items.map((event) => {
              const job = firstRow(event.jobs);
              const quote = firstRow(job?.quotes);
              const lead = firstRow(quote?.leads);
              const previewImageUrl = getProductionEventPreviewImageUrl(event);

              return (
                <TableRow key={event.id} className="align-top">
                  <TableCell className="px-4 py-4 align-top whitespace-normal">
                    <div className="min-w-44">
                      <p className="text-sm font-semibold text-slate-950">{customerName(lead?.customers)}</p>
                      <p className="mt-1 text-xs text-slate-500">{getProductLabel(lead?.product_type)}</p>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-4 align-top whitespace-normal">
                    <div className="min-w-44 space-y-2">
                      <p className="text-sm font-medium text-slate-900">{PRODUCTION_EVENT_TYPE_LABELS[event.event_type]}</p>
                      <p className="text-xs text-slate-500">{formatDateTime(event.created_at)}</p>
                      {event.submitted_by_label ? <p className="text-xs text-slate-500">ส่งโดย {event.submitted_by_label}</p> : null}
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-4 align-top whitespace-normal">
                    <div className="flex min-w-52 items-start gap-3">
                      {previewImageUrl ? (
                        <a href={previewImageUrl} target="_blank" rel="noreferrer" className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                          <Image src={previewImageUrl} alt="Production review preview" width={56} height={56} unoptimized className="h-14 w-14 object-cover" />
                        </a>
                      ) : null}
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-slate-700">ไฟล์ {event.job_media_assets?.length || 0} ชิ้น</p>
                        <p className="text-xs text-slate-500">{event.note || "ยังไม่มี note เพิ่มเติม"}</p>
                        {event.sent_to_customer_at ? <p className="text-xs text-emerald-600">ส่งลูกค้า {formatDate(event.sent_to_customer_at)}</p> : null}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-4 align-top whitespace-normal">
                    <Badge className={cn("border", statusToneClass(event.review_status))}>{getReviewStatusLabel(event.review_status)}</Badge>
                  </TableCell>
                  <TableCell className="px-4 py-4 align-top whitespace-normal">
                    <div className="flex min-w-56 flex-wrap items-center justify-end gap-2">
                      <ProductionReviewActions eventId={event.id} reviewStatus={event.review_status} />
                      {event.production_link_url ? <ProductionLinkCopy url={event.production_link_url} compact /> : null}
                      {quote?.public_token ? <a href={`${baseUrl}/status/${quote.public_token}`} target="_blank" rel="noreferrer" className={OVERVIEW_ACTION_LINK_CLASS}>เปิดหน้า status</a> : null}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          : null
      }
    />
  );
}

export function ProductionJobsTable({ jobs, baseUrl }: { jobs: SnapshotJob[]; baseUrl: string }) {
  return (
    <AdminOperationalTable
      columns={["ลูกค้า", "งาน", "สถานะ", "สัญญาณ", "Actions"]}
      emptyTitle="ยังไม่มีงานในระบบ"
      rows={
        jobs.length > 0
          ? jobs.map((job) => {
              const pendingReviewCount =
                job.job_media_events?.filter((event) => event.review_status === "pending").length || 0;

              return (
                <TableRow key={job.id} className="align-top">
                  <TableCell className="px-4 py-4 align-top whitespace-normal">
                    <div className="min-w-44">
                      <p className="text-sm font-semibold text-slate-950">{customerName(job.quotes?.leads?.customers)}</p>
                      <p className="mt-1 text-xs text-slate-500">เริ่มเมื่อ {formatDate(job.created_at)}</p>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-4 align-top whitespace-normal">
                    <div className="min-w-48 space-y-1">
                      <p className="text-sm font-medium text-slate-900">{getProductLabel(job.quotes?.leads?.product_type)}</p>
                      <p className="text-xs text-slate-500">Track {formatTrackingCode(job.quotes?.public_token)}</p>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-4 align-top whitespace-normal">
                    <div className="space-y-2">
                      <Badge className={cn("border", statusToneClass(job.status))}>{JOB_STATUS_LABELS[job.status] || job.status}</Badge>
                      {job.production_status ? <p className="text-xs text-slate-500">production {job.production_status}</p> : null}
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-4 align-top whitespace-normal">
                    <div className="min-w-48 space-y-1 text-xs text-slate-600">
                      <p>{pendingReviewCount > 0 ? `รอตรวจ ${pendingReviewCount}` : "ไม่มี review ค้าง"}</p>
                      <p>{job.assigned_to ? `owner ${job.assigned_to}` : "ยังไม่ assign owner"}</p>
                      <p>{job.fulfillment_status ? `fulfillment ${job.fulfillment_status}` : "ยังไม่ตั้ง fulfillment"}</p>
                      {job.completed_at ? <p>เสร็จเมื่อ {formatDateTime(job.completed_at)}</p> : null}
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-4 align-top whitespace-normal">
                    <div className="flex min-w-56 flex-wrap items-center justify-end gap-2">
                      {job.production_link_url ? <ProductionLinkCopy url={job.production_link_url} compact /> : null}
                      {job.quotes?.public_token ? <a href={`${baseUrl}/status/${job.quotes.public_token}`} target="_blank" rel="noreferrer" className={OVERVIEW_ACTION_LINK_CLASS}>เปิดหน้า status</a> : null}
                      <AdminJobActions jobId={job.id} currentStatus={job.status} />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          : null
      }
    />
  );
}

export function SalesQuotesTable({
  quotes,
  baseUrl,
  commercialReceiverEntities = [],
}: {
  quotes: SnapshotQuote[];
  baseUrl: string;
  commercialReceiverEntities?: BackofficeSnapshot["commercialReceiverEntities"];
}) {
  return (
    <AdminOperationalTable
      columns={["ลูกค้า", "งาน", "สถานะ quote", "การเงิน", "สัญญาณ", "Actions"]}
      emptyTitle="ยังไม่มี quote ในระบบ"
      rows={
        quotes.length > 0
          ? quotes.map((quote) => {
              const hasJob = Array.isArray(quote.jobs) && quote.jobs.length > 0;

              return (
                <TableRow key={quote.id} className="align-top">
                  <TableCell className="px-4 py-4 align-top whitespace-normal">
                    <div className="min-w-44">
                      <p className="text-sm font-semibold text-slate-950">{customerName(quote.leads?.customers)}</p>
                      <p className="mt-1 text-xs text-slate-500">สร้างเมื่อ {formatDate(quote.created_at)}</p>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-4 align-top whitespace-normal">
                    <div className="min-w-52 space-y-1">
                      <p className="text-sm font-medium text-slate-900">{getProductLabel(quote.leads?.product_type)}</p>
                      <p className="text-xs text-slate-500">ยอด {formatCurrency(quote.total)}</p>
                      <p className="text-xs text-slate-500">Track {formatTrackingCode(quote.public_token)}</p>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-4 align-top whitespace-normal">
                    <div className="space-y-2">
                      <Badge className={cn("border", statusToneClass(quote.status))}>{getQuoteStatusLabel(quote.status)}</Badge>
                      <p className="text-xs text-slate-500">
                        {quote.quote_items?.length
                          ? `มี ${quote.quote_items.length} รายการในใบเสนอราคา`
                          : "ยังไม่มีรายการสินค้าใน snapshot นี้"}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-4 align-top whitespace-normal">
                    <div className="min-w-44 space-y-1 text-xs text-slate-600">
                      <p>{PAYMENT_TERM_LABELS[quote.payment_terms]}</p>
                      <p>{PAYMENT_STATUS_LABELS[quote.payment_status]}</p>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-4 align-top whitespace-normal">
                    <div className="min-w-40 space-y-1 text-xs text-slate-600">
                      <p>{hasJob ? "มี job แล้ว" : "ยังไม่สร้าง job"}</p>
                      <p>{quote.payment_status === "paid" ? "พร้อมปลดล็อกได้ทันที" : quote.payment_status === "partial" ? "ต้องเช็กเงื่อนไขปลดล็อก" : "ยังต้องตาม payment"}</p>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-4 align-top whitespace-normal">
                    <div className="flex min-w-52 flex-wrap items-center justify-end gap-2">
                      <a href={`${baseUrl}/quote/${quote.public_token}`} target="_blank" rel="noreferrer" className={OVERVIEW_ACTION_LINK_CLASS}>เปิด quote</a>
                      <AdminQuoteActions
                        quoteId={quote.id}
                        publicToken={quote.public_token}
                        quoteStatus={quote.status}
                        paymentTerms={quote.payment_terms}
                        paymentStatus={quote.payment_status}
                        hasJob={hasJob}
                        requestedDocumentType={quote.leads?.requested_document_type || null}
                        commercialOrder={quote.commercialOrder || null}
                        commercialReceiverEntities={commercialReceiverEntities}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          : null
      }
    />
  );
}

export function SalesLeadsTable({ leads }: { leads: SnapshotLead[] }) {
  return (
    <AdminOperationalTable
      columns={["ลูกค้า", "งาน", "สถานะ", "สัญญาณ", "โน้ต", "Actions"]}
      emptyTitle="ยังไม่มี lead ที่ active อยู่"
      rows={
        leads.length > 0
          ? leads.map((lead) => {
              const leadNote = truncateText(
                lead.note_from_form || lead.reference_info || lead.note_from_chat
              );

              return (
                <TableRow key={lead.id} className="align-top">
                  <TableCell className="px-4 py-4 align-top whitespace-normal">
                    <div className="min-w-44">
                      <p className="text-sm font-semibold text-slate-950">{customerName(lead.customers)}</p>
                      <p className="mt-1 text-xs text-slate-500">{getLeadStatusLabel(lead.status)}</p>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-4 align-top whitespace-normal">
                    <div className="min-w-52 space-y-1">
                      <p className="text-sm font-medium text-slate-900">{getProductLabel(lead.product_type)}</p>
                      <p className="text-xs text-slate-500">{formatLeadDimensions(lead)}</p>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-4 align-top whitespace-normal">
                    <div className="space-y-2">
                      <Badge className={cn("border", statusToneClass(lead.design_status || lead.status))}>{getLeadStatusLabel(lead.status)}</Badge>
                      {lead.design_status ? (
                        <p className="text-xs text-slate-500">แบบ {DESIGN_STATUS_LABELS[lead.design_status]}</p>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-4 align-top whitespace-normal">
                    <div className="min-w-44 space-y-1 text-xs text-slate-600">
                      <p>{lead.due_date ? `กำหนดใช้ ${formatDate(lead.due_date)}` : "ยังไม่มีกำหนดใช้"}</p>
                      <p>{lead.assigned_designer ? `designer ${lead.assigned_designer}` : "ยังไม่ assign designer"}</p>
                      <p>{lead.ai_image_status ? `AI ${lead.ai_image_status}` : "ยังไม่มีสถานะ AI"}</p>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-4 align-top whitespace-normal">
                    <div className="min-w-56">
                      <p className="text-xs leading-5 text-slate-500">{leadNote || "ยังไม่มี note เพิ่มเติม"}</p>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-4 align-top whitespace-normal">
                    <div className="flex min-w-48 flex-wrap items-center justify-end gap-2">
                      <LeadAiPreviewActions leadId={lead.id} prompt={getLeadAiPrompt(lead)} status={lead.ai_image_status || "not_requested"} />
                      <LeadSendPreviewActions
                        leadId={lead.id}
                        previewCount={lead.ai_generated_images?.length || 0}
                      />
                      <AdminLeadDesignActions leadId={lead.id} designStatus={lead.design_status || "not_started"} />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          : null
      }
    />
  );
}

export function OverviewSalesSnapshotTable({
  quotes,
  baseUrl,
  commercialReceiverEntities = [],
}: {
  quotes: SnapshotQuote[];
  baseUrl: string;
  commercialReceiverEntities?: BackofficeSnapshot["commercialReceiverEntities"];
}) {
  return (
    <AdminOperationalTable
      columns={["ลูกค้า", "บริบท", "Actions"]}
      emptyTitle="ยังไม่มี quote ที่ต้องจับตา"
      rows={
        quotes.length > 0
          ? quotes.map((quote) => {
              const hasJob = Array.isArray(quote.jobs) && quote.jobs.length > 0;

              return (
                <TableRow key={quote.id} className="align-top">
                  <TableCell className="px-4 py-4 align-top whitespace-normal">
                    <div className="min-w-40">
                      <p className="text-sm font-semibold text-slate-950">{customerName(quote.leads?.customers)}</p>
                      <p className="mt-1 text-xs text-slate-500">{getProductLabel(quote.leads?.product_type)}</p>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-4 align-top whitespace-normal">
                    <div className="min-w-44 space-y-2">
                      <Badge className={cn("border", statusToneClass(quote.status))}>{getQuoteStatusLabel(quote.status)}</Badge>
                      <div className="space-y-1 text-xs text-slate-600">
                        <p>{formatCurrency(quote.total)} · {PAYMENT_TERM_LABELS[quote.payment_terms]}</p>
                        <p>{PAYMENT_STATUS_LABELS[quote.payment_status]} · {hasJob ? "มี job แล้ว" : "ยังไม่สร้าง job"}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-4 align-top whitespace-normal">
                    <div className="flex min-w-44 flex-wrap items-center justify-end gap-2">
                      <a href={`${baseUrl}/quote/${quote.public_token}`} target="_blank" rel="noreferrer" className={OVERVIEW_ACTION_LINK_CLASS}>เปิด quote</a>
                      <AdminQuoteActions
                        quoteId={quote.id}
                        publicToken={quote.public_token}
                        quoteStatus={quote.status}
                        paymentTerms={quote.payment_terms}
                        paymentStatus={quote.payment_status}
                        hasJob={hasJob}
                        requestedDocumentType={quote.leads?.requested_document_type || null}
                        commercialOrder={quote.commercialOrder || null}
                        commercialReceiverEntities={commercialReceiverEntities}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          : null
      }
    />
  );
}

export function OverviewDesignSnapshotTable({ leads }: { leads: SnapshotLead[] }) {
  return (
    <AdminOperationalTable
      columns={["ลูกค้า", "บริบท", "Actions"]}
      emptyTitle="ยังไม่มีคิวแบบที่ต้องขยับ"
      rows={
        leads.length > 0
          ? leads.map((lead) => (
              <TableRow key={lead.id} className="align-top">
                <TableCell className="px-4 py-4 align-top whitespace-normal">
                  <div className="min-w-40">
                    <p className="text-sm font-semibold text-slate-950">{customerName(lead.customers)}</p>
                    <p className="mt-1 text-xs text-slate-500">{getProductLabel(lead.product_type)}</p>
                  </div>
                </TableCell>
                <TableCell className="px-4 py-4 align-top whitespace-normal">
                  <div className="min-w-44 space-y-2">
                    <Badge className={cn("border", statusToneClass(lead.design_status || lead.status))}>
                      {DESIGN_STATUS_LABELS[lead.design_status || "not_started"] || getLeadStatusLabel(lead.status)}
                    </Badge>
                    <div className="space-y-1 text-xs text-slate-600">
                      <p>{lead.assigned_designer ? `owner ${lead.assigned_designer}` : "ยังไม่ assign designer"}</p>
                      <p>{lead.ai_image_status ? `AI ${lead.ai_image_status}` : "ยังไม่มีสถานะ AI"}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="px-4 py-4 align-top whitespace-normal">
                  <div className="flex min-w-44 flex-wrap items-center justify-end gap-2">
                    <LeadAiPreviewActions leadId={lead.id} prompt={getLeadAiPrompt(lead)} status={lead.ai_image_status || "not_requested"} />
                    <LeadSendPreviewActions
                      leadId={lead.id}
                      previewCount={lead.ai_generated_images?.length || 0}
                    />
                    <AdminLeadDesignActions leadId={lead.id} designStatus={lead.design_status || "not_started"} />
                  </div>
                </TableCell>
              </TableRow>
            ))
          : null
      }
    />
  );
}

export function OverviewProductionSnapshotTable({
  jobs,
  baseUrl,
}: {
  jobs: SnapshotJob[];
  baseUrl: string;
}) {
  return (
    <AdminOperationalTable
      columns={["ลูกค้า", "บริบท", "Actions"]}
      emptyTitle="ยังไม่มีงานในคิวผลิต"
      rows={
        jobs.length > 0
          ? jobs.map((job) => {
              const pendingReviewCount =
                job.job_media_events?.filter((event) => event.review_status === "pending").length || 0;

              return (
                <TableRow key={job.id} className="align-top">
                  <TableCell className="px-4 py-4 align-top whitespace-normal">
                    <div className="min-w-40">
                      <p className="text-sm font-semibold text-slate-950">{customerName(job.quotes?.leads?.customers)}</p>
                      <p className="mt-1 text-xs text-slate-500">{getProductLabel(job.quotes?.leads?.product_type)}</p>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-4 align-top whitespace-normal">
                    <div className="min-w-44 space-y-2">
                      <Badge className={cn("border", statusToneClass(job.status))}>{JOB_STATUS_LABELS[job.status] || job.status}</Badge>
                      <div className="space-y-1 text-xs text-slate-600">
                        <p>{job.assigned_to ? `owner ${job.assigned_to}` : "ยังไม่ assign owner"}</p>
                        <p>{pendingReviewCount > 0 ? `รอตรวจ ${pendingReviewCount}` : "ไม่มี review ค้าง"}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-4 align-top whitespace-normal">
                    <div className="flex min-w-44 flex-wrap items-center justify-end gap-2">
                      {job.production_link_url ? <ProductionLinkCopy url={job.production_link_url} compact /> : null}
                      {job.quotes?.public_token ? <a href={`${baseUrl}/status/${job.quotes.public_token}`} target="_blank" rel="noreferrer" className={OVERVIEW_ACTION_LINK_CLASS}>เปิดหน้า status</a> : null}
                      <AdminJobActions jobId={job.id} currentStatus={job.status} />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          : null
      }
    />
  );
}

export function InboxUrgentTable({
  snapshot,
  escalations,
  blockedConversations,
  waitingCustomerConversations,
}: {
  snapshot: BackofficeSnapshot;
  escalations: SnapshotEscalation[];
  blockedConversations: SnapshotConversation[];
  waitingCustomerConversations: SnapshotConversation[];
}) {
  const rows = [
    ...escalations.map((escalation) => ({ kind: "escalation" as const, escalation })),
    ...blockedConversations.map((conversation) => ({ kind: "conversation" as const, lane: "blocked" as const, conversation })),
    ...waitingCustomerConversations.map((conversation) => ({ kind: "conversation" as const, lane: "waiting-customer" as const, conversation })),
  ];

  return (
    <AdminOperationalTable
      columns={["ประเภท", "ลูกค้า", "บริบท", "สถานะ", "สัญญาณ", "Actions"]}
      emptyTitle="ตอนนี้ยังไม่มีเคสเร่งด่วนใน inbox"
      rows={
        rows.length > 0
          ? rows.map((row, index) => {
              if (row.kind === "escalation") {
                const conversation = row.escalation.conversations;
                const bundle = conversation ? getConversationBundle(snapshot, conversation.id) : null;

                return (
                  <TableRow key={`escalation-${row.escalation.id}-${index}`} className="bg-rose-50/30 align-top">
                    <TableCell className="px-4 py-4 align-top whitespace-normal">
                      <div className="min-w-32 space-y-1">
                        <p className="text-sm font-semibold text-rose-900">Escalation</p>
                        <p className="text-xs text-rose-700">ต้องใช้คนเข้าเคลียร์</p>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-4 align-top whitespace-normal">
                      <div className="min-w-44">
                        <p className="text-sm font-semibold text-slate-950">
                          {bundle?.lead ? customerName(bundle.lead.customers) : conversation ? `LINE ${conversation.line_user_id.slice(0, 12)}...` : "ลูกค้า"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">{formatDateTime(row.escalation.created_at)}</p>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-4 align-top whitespace-normal">
                      <div className="min-w-64">
                        <p className="text-sm text-rose-900">{row.escalation.reason}</p>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-4 align-top whitespace-normal">
                      <Badge className="border border-rose-200 bg-rose-50 text-rose-700">ต้องตอบตอนนี้</Badge>
                    </TableCell>
                    <TableCell className="px-4 py-4 align-top whitespace-normal">
                      <div className="min-w-40 space-y-1 text-xs text-slate-600">
                        <p>{conversation ? WORKFLOW_STATE_LABELS[conversation.state] : "ยังไม่มี conversation ผูก"}</p>
                        <p>{bundle?.quote ? getQuoteStatusLabel(bundle.quote.status) : "ยังไม่มี quote"}</p>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-4 align-top whitespace-normal">
                      {conversation ? (
                        <div className="flex justify-end">
                          <AdminConversationActions conversationId={conversation.id} currentState={conversation.state} compact />
                        </div>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              }

              const bundle = getConversationBundle(snapshot, row.conversation.id);
              const note = truncateText(
                bundle.lead?.hold_reason || bundle.lead?.note_from_chat,
                100
              );

              return (
                <TableRow
                  key={`${row.lane}-${row.conversation.id}-${index}`}
                  className={cn(
                    "align-top",
                    row.lane === "blocked" && "bg-amber-50/20",
                    row.lane === "waiting-customer" && "bg-sky-50/20"
                  )}
                >
                  <TableCell className="px-4 py-4 align-top whitespace-normal">
                    <div className="min-w-32 space-y-1">
                      <p className="text-sm font-semibold text-slate-900">
                        {row.lane === "blocked" ? "Workflow ติดค้าง" : "รอลูกค้าตอบ"}
                      </p>
                      <p className="text-xs text-slate-500">อัปเดต {formatDateTime(row.conversation.last_message_at)}</p>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-4 align-top whitespace-normal">
                    <div className="min-w-44">
                      <p className="text-sm font-semibold text-slate-950">
                        {bundle.lead ? customerName(bundle.lead.customers) : `LINE ${row.conversation.line_user_id.slice(0, 12)}...`}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{bundle.lead ? getProductLabel(bundle.lead.product_type) : "ยังไม่มี lead ผูก"}</p>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-4 align-top whitespace-normal">
                    <div className="min-w-64 space-y-1">
                      <p className="text-sm text-slate-700">{note || (row.lane === "blocked" ? "ยังต้องมีคนปลดล็อก workflow นี้" : "กำลังรอข้อมูลหรือ feedback เพิ่มจากลูกค้า")}</p>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-4 align-top whitespace-normal">
                    <Badge className={cn("border", statusToneClass(row.conversation.state))}>{WORKFLOW_STATE_LABELS[row.conversation.state]}</Badge>
                  </TableCell>
                  <TableCell className="px-4 py-4 align-top whitespace-normal">
                    <div className="min-w-44 space-y-1 text-xs text-slate-600">
                      <p>{bundle.quote ? getQuoteStatusLabel(bundle.quote.status) : "ยังไม่มี quote"}</p>
                      <p>{bundle.quote ? PAYMENT_STATUS_LABELS[bundle.quote.payment_status] : "ยังไม่มี payment state"}</p>
                      <p>{bundle.job ? JOB_STATUS_LABELS[bundle.job.status] || bundle.job.status : "ยังไม่มี job"}</p>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-4 align-top whitespace-normal">
                    <div className="flex justify-end">
                      <AdminConversationActions conversationId={row.conversation.id} currentState={row.conversation.state} compact />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          : null
      }
    />
  );
}

export function ConversationBacklogTable({
  snapshot,
  conversations,
}: {
  snapshot: BackofficeSnapshot;
  conversations: SnapshotConversation[];
}) {
  return (
    <AdminOperationalTable
      columns={["ลูกค้า", "workflow", "งานที่ผูก", "บริบท", "Actions"]}
      emptyTitle="ยังไม่มี conversation backlog นอกคิวเร่งด่วน"
      rows={
        conversations.length > 0
          ? conversations.map((conversation) => {
              const bundle = getConversationBundle(snapshot, conversation.id);
              const holdNote = truncateText(bundle.lead?.hold_reason, 100);

              return (
                <TableRow key={conversation.id} className="align-top">
                  <TableCell className="px-4 py-4 align-top whitespace-normal">
                    <div className="min-w-44">
                      <p className="text-sm font-semibold text-slate-950">
                        {bundle.lead ? customerName(bundle.lead.customers) : `LINE ${conversation.line_user_id.slice(0, 12)}...`}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{bundle.lead ? getProductLabel(bundle.lead.product_type) : "ยังไม่มี lead ผูก"}</p>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-4 align-top whitespace-normal">
                    <div className="space-y-2">
                      <Badge className={cn("border", statusToneClass(conversation.state))}>{WORKFLOW_STATE_LABELS[conversation.state]}</Badge>
                      <p className="text-xs text-slate-500">อัปเดตล่าสุด {formatDateTime(conversation.last_message_at)}</p>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-4 align-top whitespace-normal">
                    <div className="min-w-48 space-y-1 text-xs text-slate-600">
                      <p>{bundle.quote ? `${getQuoteStatusLabel(bundle.quote.status)} · ${PAYMENT_STATUS_LABELS[bundle.quote.payment_status]}` : "ยังไม่มี quote ผูก"}</p>
                      <p>{bundle.job ? JOB_STATUS_LABELS[bundle.job.status] || bundle.job.status : "ยังไม่มี job"}</p>
                      <p>{bundle.lead?.design_status ? `แบบ ${DESIGN_STATUS_LABELS[bundle.lead.design_status]}` : "ยังไม่มีสถานะแบบ"}</p>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-4 align-top whitespace-normal">
                    <div className="min-w-56">
                      <p className="text-xs leading-5 text-slate-500">{holdNote || "ไม่มี hold note เพิ่มเติมใน backlog นี้"}</p>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-4 align-top whitespace-normal">
                    <div className="flex justify-end">
                      <AdminConversationActions conversationId={conversation.id} currentState={conversation.state} compact />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          : null
      }
    />
  );
}

export function QueueCard({
  title,
  meta,
  badge,
  children,
  footer,
  tone = "default",
}: {
  title: string;
  meta?: string;
  badge?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  tone?: "default" | "warning" | "danger";
}) {
  return (
    <Card
      size="sm"
      className={cn(
        "rounded-[24px] py-0 shadow-sm transition-shadow duration-200 hover:shadow-md motion-reduce:transition-none",
        tone === "warning" && "border-amber-200 bg-amber-50/40",
        tone === "danger" && "border-rose-200 bg-rose-50/40",
        tone === "default" && "border-cyan-100 bg-cyan-50/35"
      )}
    >
      <CardHeader className="gap-3 px-4 py-4">
        {badge ? <CardAction>{badge}</CardAction> : null}
        <CardTitle className="text-sm font-semibold text-slate-950">{title}</CardTitle>
        {meta ? <CardDescription className="text-xs text-slate-500">{meta}</CardDescription> : null}
      </CardHeader>
      {children ? <CardContent className="px-4 pb-4 pt-0">{children}</CardContent> : null}
      {footer ? <CardFooter className="border-t border-slate-200/80 px-4 py-4">{footer}</CardFooter> : null}
    </Card>
  );
}