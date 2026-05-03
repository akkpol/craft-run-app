import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  ClipboardList,
  FileText,
  Headphones,
  Landmark,
  PackageCheck,
  Palette,
  type LucideIcon,
} from "lucide-react";
import type { PublicFlowReadinessSummary } from "@/lib/public-flow-readiness";
import { cn } from "@/lib/utils";

type CustomerFlowCardProps = {
  summary: PublicFlowReadinessSummary;
  actionHref?: string;
  actionLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  className?: string;
};

type StageMeta = {
  label: string;
  owner: string;
  icon: LucideIcon;
  tone: string;
  iconTone: string;
};

const STAGE_META: Record<PublicFlowReadinessSummary["queueKey"], StageMeta> = {
  all: {
    label: "ภาพรวมงาน",
    owner: "ทีม FOGUS",
    icon: ClipboardList,
    tone: "border-slate-200 bg-slate-50/80",
    iconTone: "bg-slate-900 text-white",
  },
  "new-leads": {
    label: "ข้อมูลเริ่มต้น",
    owner: "ทีมประเมินราคา",
    icon: ClipboardList,
    tone: "border-sky-200 bg-sky-50/80",
    iconTone: "bg-sky-700 text-white",
  },
  exceptions: {
    label: "ทีมงานตรวจสอบ",
    owner: "ผู้ดูแลเคส",
    icon: Headphones,
    tone: "border-rose-200 bg-rose-50/80",
    iconTone: "bg-rose-700 text-white",
  },
  "payment-ops": {
    label: "ตรวจชำระเงิน",
    owner: "ทีมการเงิน",
    icon: Landmark,
    tone: "border-amber-200 bg-amber-50/85",
    iconTone: "bg-amber-600 text-white",
  },
  "customer-waiting": {
    label: "รอข้อมูลจากลูกค้า",
    owner: "ทีมประสานงาน",
    icon: Headphones,
    tone: "border-blue-200 bg-blue-50/80",
    iconTone: "bg-blue-700 text-white",
  },
  "quote-decision": {
    label: "ตรวจใบเสนอราคา",
    owner: "ทีมขาย",
    icon: FileText,
    tone: "border-violet-200 bg-violet-50/80",
    iconTone: "bg-violet-700 text-white",
  },
  "commercial-gate": {
    label: "เอกสารและผู้รับชำระ",
    owner: "ทีมเอกสาร",
    icon: Building2,
    tone: "border-emerald-200 bg-emerald-50/80",
    iconTone: "bg-emerald-700 text-white",
  },
  "design-ops": {
    label: "ตรวจแบบ",
    owner: "ทีมออกแบบ",
    icon: Palette,
    tone: "border-fuchsia-200 bg-fuchsia-50/80",
    iconTone: "bg-fuchsia-700 text-white",
  },
  "production-ops": {
    label: "ผลิตและส่งมอบ",
    owner: "ทีมผลิต",
    icon: PackageCheck,
    tone: "border-cyan-200 bg-cyan-50/80",
    iconTone: "bg-cyan-700 text-white",
  },
};

export default function CustomerFlowCard({
  summary,
  actionHref,
  actionLabel,
  secondaryHref,
  secondaryLabel,
  className,
}: CustomerFlowCardProps) {
  const meta = STAGE_META[summary.queueKey];
  const StageIcon = meta.icon;
  const actionCopy = actionLabel || summary.nextActionLabel;

  return (
    <section className={cn("rounded-[22px] border px-4 py-4 sm:px-5", meta.tone, className)}>
      <div className="flex items-start gap-4">
        <div className={cn("flex size-11 shrink-0 items-center justify-center rounded-2xl shadow-sm", meta.iconTone)}>
          <StageIcon className="size-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/80 bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-sm">
              {meta.label}
            </span>
            <span className="rounded-full border border-white/80 bg-white/70 px-2.5 py-1 text-[11px] font-medium text-slate-600 shadow-sm">
              {summary.nextActionOwner === "customer" ? "ต้องการคำตอบจากคุณ" : meta.owner}
            </span>
          </div>
          <h2 className="mt-3 text-base font-semibold leading-6 text-slate-950">
            {summary.headline}
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">{summary.detail}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="rounded-2xl border border-white/80 bg-white/75 px-4 py-3 shadow-sm">
          <p className="text-[11px] font-semibold uppercase text-slate-400">ขั้นตอนถัดไป</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{summary.nextActionLabel}</p>
        </div>

        {(actionHref || secondaryHref) ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            {actionHref ? (
              <Link
                href={actionHref}
                prefetch={false}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
              >
                {actionCopy}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            ) : null}
            {secondaryHref && secondaryLabel ? (
              <Link
                href={secondaryHref}
                prefetch={false}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                {secondaryLabel}
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="hidden items-center gap-2 text-sm font-medium text-slate-500 sm:flex">
            <BadgeCheck className="size-4" aria-hidden="true" />
            <span>{summary.nextActionOwner === "customer" ? "พร้อมให้ตอบกลับ" : "ทีมงานกำลังดูแล"}</span>
          </div>
        )}
      </div>
    </section>
  );
}