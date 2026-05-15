import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  Factory,
  PackageCheck,
  Palette,
  Truck,
  Wrench,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { formatBangkokDateTime } from "@/lib/bangkok-date-time";
import { resolveProductCatalogLabel } from "@/lib/product-catalog";
import { fetchCommercialAdminContextForQuoteIds } from "@/lib/commercial-admin-context";
import { hasDeliveryTrackingDetails } from "@/lib/delivery-tracking";
import { getUiContract } from "@/lib/workflow-policy";
import {
  DESIGN_STATUS_LABELS,
  FULFILLMENT_MODE_LABELS,
  designStatusNeedsCustomerResponse,
  isFulfillmentMode,
  isDesignStatus,
  type DesignStatus,
  type FulfillmentMode,
} from "@/lib/types";
import { getStatusPageReadinessSummary } from "@/lib/public-flow-readiness";
import CustomerFlowCard from "@/components/customer-flow-card";
import PublicFlowStageStrip, { type PublicFlowStageItem } from "@/components/public-flow-stage-strip";
import { cn } from "@/lib/utils";
import CustomerStatusActions from "./customer-status-actions";
import CopyTrackingCodeButton from "./copy-tracking-code-button";

const STATUS_FLOW_STAGES: PublicFlowStageItem[] = [
  {
    key: "quote",
    label: "Quote",
    description: "เริ่มจากการ approve quote และเตรียมเงื่อนไขเดินงาน",
  },
  {
    key: "commercial",
    label: "Payment / Documents",
    description: "ตรวจ payment และเอกสารก่อนปลด flow ให้ production",
  },
  {
    key: "design",
    label: "Design Ops",
    description: "proof, revision หรือ feedback จากลูกค้าจะเกิดในช่วงนี้",
  },
  {
    key: "production",
    label: "Production Ops",
    description: "ผลิตจริง, ติดตามหลักฐาน และอัปเดตความคืบหน้า",
  },
  {
    key: "fulfillment",
    label: "Fulfillment",
    description: "พร้อมส่งมอบ, ติดตั้ง หรือปิดงานสมบูรณ์",
  },
];

const STATUS_DISPLAY: Record<string, { label: string; color: string; icon: LucideIcon; iconColor: string; dotColor: string }> = {
  IN_DESIGN: {
    label: "กำลังออกแบบ",
    color: "bg-violet-50 text-violet-700 ring-violet-200",
    icon: Palette,
    iconColor: "bg-violet-600 text-white",
    dotColor: "bg-violet-500",
  },
  IN_PRODUCTION: {
    label: "กำลังผลิต",
    color: "bg-amber-50 text-amber-700 ring-amber-200",
    icon: Factory,
    iconColor: "bg-amber-600 text-white",
    dotColor: "bg-amber-500",
  },
  READY_FOR_FULFILLMENT: {
    label: "พร้อมส่งมอบ",
    color: "bg-blue-50 text-blue-700 ring-blue-200",
    icon: PackageCheck,
    iconColor: "bg-blue-600 text-white",
    dotColor: "bg-blue-500",
  },
  ON_HOLD_CUSTOMER_INPUT: {
    label: "รอข้อมูลจากลูกค้า",
    color: "bg-amber-50 text-amber-700 ring-amber-200",
    icon: ClipboardList,
    iconColor: "bg-amber-600 text-white",
    dotColor: "bg-amber-500",
  },
  HUMAN_REVIEW_REQUIRED: {
    label: "ทีมงานกำลังตรวจสอบ",
    color: "bg-rose-50 text-rose-700 ring-rose-200",
    icon: CircleAlert,
    iconColor: "bg-rose-600 text-white",
    dotColor: "bg-rose-500",
  },
  COMPLETED: {
    label: "เสร็จสมบูรณ์",
    color: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    icon: CheckCircle2,
    iconColor: "bg-emerald-600 text-white",
    dotColor: "bg-emerald-500",
  },
  CANCELLED: {
    label: "ยกเลิก",
    color: "bg-red-50 text-red-700 ring-red-200",
    icon: XCircle,
    iconColor: "bg-red-600 text-white",
    dotColor: "bg-red-500",
  },
};

const THAI_NUMBER_FORMATTER = new Intl.NumberFormat("th-TH-u-nu-latn");

function formatMoney(value: number | string | null | undefined) {
  return `฿${THAI_NUMBER_FORMATTER.format(Number(value || 0))}`;
}

function getCustomerTimelineNote(note: string | null | undefined) {
  if (!note) {
    return null;
  }

  const normalized = note.trim();
  if (!normalized) {
    return null;
  }

  if (/^(P\d+[-_]|P\d+\b|Job created|admin |prep:)/i.test(normalized)) {
    return null;
  }

  return normalized;
}

function getStatusDisplayForFulfillment(
  status: string | null | undefined,
  fulfillmentMode: FulfillmentMode | null
) {
  if (status === "READY_FOR_FULFILLMENT") {
    if (fulfillmentMode === "pickup") {
      return { ...STATUS_DISPLAY.READY_FOR_FULFILLMENT, label: "พร้อมให้รับงาน" };
    }

    if (fulfillmentMode === "install") {
      return { ...STATUS_DISPLAY.READY_FOR_FULFILLMENT, label: "พร้อมเข้าติดตั้ง", icon: Wrench };
    }
  }

  if (status === "COMPLETED") {
    if (fulfillmentMode === "pickup") {
      return { ...STATUS_DISPLAY.COMPLETED, label: "รับงานแล้ว" };
    }

    if (fulfillmentMode === "install") {
      return { ...STATUS_DISPLAY.COMPLETED, label: "ติดตั้งแล้ว", icon: Wrench };
    }
  }

  return STATUS_DISPLAY[status || ""] || {
    label: status || "ไม่ระบุ",
    color: "bg-gray-50 text-gray-700 ring-gray-200",
    icon: ClipboardList,
    iconColor: "bg-gray-700 text-white",
    dotColor: "bg-gray-400",
  };
}

function getStatusFlowStageKey({
  waitingQuoteApproval,
  commercialGateVisible,
  showDesignActions,
  jobStatus,
}: {
  waitingQuoteApproval: boolean;
  commercialGateVisible: boolean;
  showDesignActions: boolean;
  jobStatus: string | null | undefined;
}) {
  if (waitingQuoteApproval) {
    return "quote";
  }

  if (commercialGateVisible) {
    return "commercial";
  }

  if (showDesignActions || jobStatus === "IN_DESIGN") {
    return "design";
  }

  if (jobStatus === "READY_FOR_FULFILLMENT" || jobStatus === "COMPLETED") {
    return "fulfillment";
  }

  return "production";
}

export default async function StatusPage(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;
  const supabase = createAdminClient();

  // Find quote by public token, then get job
  const { data: quote } = await supabase
    .from("quotes")
    .select("*, leads(*, customers(*)), jobs(*, job_timeline(*))")
    .eq("public_token", token)
    .single();

  if (!quote) notFound();

  const lead = quote.leads;
  const customer = lead?.customers;
  const jobs = quote.jobs || [];
  const job = jobs[0];
  const timeline = job?.job_timeline?.sort(
    (a: { created_at: string }, b: { created_at: string }) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  ) || [];

  const productLabel = resolveProductCatalogLabel({
    productType: lead?.product_type,
    productLabelSnapshot: lead?.product_label_snapshot,
  });
  const fulfillmentMode: FulfillmentMode | null = isFulfillmentMode(lead?.fulfillment_mode || "")
    ? (lead?.fulfillment_mode as FulfillmentMode)
    : null;
  const statusInfo = getStatusDisplayForFulfillment(job?.status, fulfillmentMode);
  const designStatus: DesignStatus | null = isDesignStatus(lead?.design_status || "")
    ? (lead.design_status as DesignStatus)
    : null;
  const commercialContext = await fetchCommercialAdminContextForQuoteIds([quote.id]);
  const commercialOrder = commercialContext.orderByQuoteId[quote.id] || null;
  const paymentCleared = quote.payment_status === "paid" || quote.payment_status === "partial" || quote.payment_status === "not_required";
  const requiredCommercialDocumentType = paymentCleared
    ? lead?.requested_document_type === "tax_invoice"
      ? "tax_invoice"
      : "receipt"
    : null;
  const commercialUiContract = getUiContract({
    actor: "customer",
    surface: "status_page",
    workflow_bundle: {
      quote_status: quote.status,
      payment_terms: quote.payment_terms,
      payment_status: quote.payment_status,
      design_status: designStatus || undefined,
      conversation_state: job?.status || undefined,
      job_status: job?.status || undefined,
      hold_reason: lead?.hold_reason || null,
      required_document_type: requiredCommercialDocumentType,
      required_document_issued: Boolean(commercialOrder?.issuedDocumentId),
      commercial_review_required:
        Boolean(requiredCommercialDocumentType) &&
        (!commercialOrder?.selectedReceiverEntityId || !commercialOrder?.paymentReceiverLockedAt),
      payment_receiver_locked: Boolean(commercialOrder?.paymentReceiverLockedAt),
    },
  });
  const showDesignActions = designStatusNeedsCustomerResponse(designStatus);
  const showHoldResolution =
    job?.status === "ON_HOLD_CUSTOMER_INPUT" &&
    !showDesignActions &&
    Boolean(lead?.hold_reason);
  const waitingQuoteApproval = quote.status === "sent";
  const publicReadiness = getStatusPageReadinessSummary({
    waitingQuoteApproval,
    showDesignActions,
    showHoldResolution,
    commercialGateActive: commercialUiContract.show_sections.includes("commercial_gate_notice"),
    commercialHeadline: commercialUiContract.copy_guidance.headline || null,
    jobStatus: job?.status || null,
  });
  const StatusIcon = statusInfo.icon;
  const quoteHref = `/quote/${token}`;
  const statusActionHref = waitingQuoteApproval ? quoteHref : undefined;
  const commercialGateVisible = commercialUiContract.show_sections.includes("commercial_gate_notice");
  const statusFlowStageKey = getStatusFlowStageKey({
    waitingQuoteApproval,
    commercialGateVisible,
    showDesignActions,
    jobStatus: job?.status,
  });

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.10)]">
          <div className="border-b border-slate-100 px-5 py-4 sm:px-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-400">FOGUS Print &amp; Sign</p>
                <h1 className="mt-1 text-xl font-semibold text-slate-950 sm:text-2xl">สถานะงานและเอกสาร</h1>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={quoteHref}
                  prefetch={false}
                  className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  ดูใบเสนอราคา
                </Link>
                <Link
                  href="/status"
                  prefetch={false}
                  className="inline-flex rounded-full border border-slate-200 bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                >
                  ค้นหางานอื่น
                </Link>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="px-5 py-6 sm:px-7">
              <div className="flex items-start gap-4">
                <div className={cn("flex size-14 shrink-0 items-center justify-center rounded-2xl shadow-sm", statusInfo.iconColor)}>
                  <StatusIcon className="size-7" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1", statusInfo.color)}>
                    {statusInfo.label}
                  </span>
                  <h2 className="mt-3 text-2xl font-semibold leading-tight text-slate-950 sm:text-3xl">
                    {productLabel}
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                    หน้านี้เป็นศูนย์ติดตามงานสำหรับลูกค้า ใช้ดูความคืบหน้า ใบเสนอราคา และขั้นตอนถัดไปของงานเดียวกันได้ตลอดเวลา
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/85 px-4 py-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase text-slate-400">เลขติดตามงาน</p>
                    <p className="mt-1 break-all font-mono text-sm font-semibold text-slate-950">{token}</p>
                  </div>
                  <CopyTrackingCodeButton token={token} />
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-5 sm:px-7 lg:border-l lg:border-t-0">
              <div className="grid gap-3">
                <div className="rounded-2xl border border-white bg-white/90 px-4 py-3 shadow-sm">
                  <p className="text-xs font-semibold uppercase text-slate-400">ยอดรวม</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-950">{formatMoney(quote.total)}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-white bg-white/90 px-4 py-3 shadow-sm">
                    <p className="text-xs font-semibold uppercase text-slate-400">จำนวน</p>
                    <p className="mt-1 text-sm font-semibold text-slate-950">{lead?.qty || "-"} ชิ้น</p>
                  </div>
                  <div className="rounded-2xl border border-white bg-white/90 px-4 py-3 shadow-sm">
                    <p className="text-xs font-semibold uppercase text-slate-400">รับงาน</p>
                    <p className="mt-1 text-sm font-semibold text-slate-950">
                      {fulfillmentMode ? FULFILLMENT_MODE_LABELS[fulfillmentMode] : "ไม่ระบุ"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <main className="space-y-5">
            <PublicFlowStageStrip
              title="ตอนนี้ token นี้อยู่ช่วงไหนของงาน"
              description="หน้า status คือปลายทางเดียวที่ลูกค้าใช้ตามงานต่อหลัง approve quote โดยระบบจะเน้นช่วงที่ต้องสนใจตอนนี้ให้อัตโนมัติ"
              items={STATUS_FLOW_STAGES}
              activeKey={statusFlowStageKey}
            />

            <CustomerFlowCard
              summary={publicReadiness}
              actionHref={statusActionHref}
              actionLabel={waitingQuoteApproval ? "ไปตอบใบเสนอราคา" : undefined}
              secondaryHref={waitingQuoteApproval ? undefined : quoteHref}
              secondaryLabel={waitingQuoteApproval ? undefined : "ดูใบเสนอราคา"}
            />

            {commercialGateVisible ? (
              <section className="rounded-[24px] border border-emerald-200 bg-white px-5 py-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
                <div className="flex items-start gap-4">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-700 text-white shadow-sm">
                    <ClipboardList className="size-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-950">เอกสารและเงื่อนไขบริษัท</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      {commercialOrder?.paymentReceiverLockedAt
                        ? commercialOrder?.issuedDocumentNumber
                          ? `เอกสารออกแล้วเลขที่ ${commercialOrder.issuedDocumentNumber}`
                          : "ทีมงานยืนยันผู้รับเงินแล้ว และกำลังออกเอกสารตามขั้นตอนก่อนส่งต่อขั้นถัดไป"
                        : "ทีมงานกำลังตรวจสอบผู้รับเงินและเงื่อนไขเอกสาร เพื่อให้เอกสารออกชื่อเดียวกับผู้รับชำระ"}
                    </p>
                  </div>
                </div>
              </section>
            ) : null}

            {(lead?.hold_reason || lead?.human_review_reason) ? (
              <section className="rounded-[24px] border border-amber-200 bg-white px-5 py-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
                <h2 className="text-sm font-semibold text-slate-950">หมายเหตุล่าสุด</h2>
                {lead?.hold_reason ? (
                  <p className="mt-2 text-sm leading-6 text-amber-700">ต้องการข้อมูลเพิ่ม: {lead.hold_reason}</p>
                ) : null}
                {lead?.human_review_reason ? (
                  <p className="mt-2 text-sm leading-6 text-rose-700">ทีมงานกำลังตรวจสอบ: {lead.human_review_reason}</p>
                ) : null}
              </section>
            ) : null}

            {(lead?.design_status || (Array.isArray(lead?.ai_generated_images) && lead.ai_generated_images.length > 0)) ? (
              <section className="rounded-[24px] border border-slate-200 bg-white px-5 py-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold text-slate-950">แบบและตัวอย่างงาน</h2>
                  {designStatus ? (
                    <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700 ring-1 ring-violet-200">
                      {DESIGN_STATUS_LABELS[designStatus]}
                    </span>
                  ) : null}
                </div>

                {Array.isArray(lead?.ai_generated_images) && lead.ai_generated_images.length > 0 ? (
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {lead.ai_generated_images.map((imageUrl: string) => (
                      // Avoid target="_blank" — customer is in LINE's in-app
                      // browser; spawning a new tab loses the status page and
                      // can launch a system browser that breaks the LINE flow.
                      // Opening in the same tab lets them use the back button.
                      <a
                        key={imageUrl}
                        href={imageUrl}
                        rel="noreferrer"
                        aria-label="เปิดภาพตัวอย่างแบบขนาดเต็ม"
                        className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
                      >
                        <Image
                          src={imageUrl}
                          alt="Design preview"
                          width={320}
                          height={144}
                          unoptimized
                          className="h-36 w-full object-cover"
                        />
                      </a>
                    ))}
                  </div>
                ) : null}

                {(showDesignActions || showHoldResolution) ? (
                  <div className="mt-4">
                    <CustomerStatusActions
                      quoteToken={token}
                      canResolveHold={showHoldResolution}
                      canApproveDesign={showDesignActions}
                    />
                  </div>
                ) : null}
              </section>
            ) : null}

            {fulfillmentMode === "delivery" && hasDeliveryTrackingDetails(job) ? (
              <section className="rounded-[24px] border border-sky-200 bg-white px-5 py-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
                <h2 className="text-sm font-semibold text-slate-950">ติดตามการจัดส่ง</h2>
                <div className="mt-3 grid gap-2 text-sm">
                  {job.delivery_provider ? (
                    <p>
                      <span className="text-slate-500">ผู้ให้บริการ:</span>{" "}
                      <span className="font-medium text-slate-900">
                        {job.delivery_provider === "lalamove" && "Lalamove"}
                        {job.delivery_provider === "grab" && "Grab Express"}
                        {job.delivery_provider === "kerry" && "Kerry Express"}
                        {job.delivery_provider === "flash" && "Flash Express"}
                        {job.delivery_provider === "thaipost" && "ไปรษณีย์ไทย"}
                        {job.delivery_provider === "inhouse" && "ทีมร้าน"}
                        {job.delivery_provider === "other" && "อื่นๆ"}
                      </span>
                    </p>
                  ) : null}
                  {job.delivery_tracking_number ? (
                    <p>
                      <span className="text-slate-500">เลขพัสดุ:</span>{" "}
                      <span className="font-mono font-medium text-slate-900">
                        {job.delivery_tracking_number}
                      </span>
                    </p>
                  ) : null}
                  {job.delivery_dispatched_at ? (
                    <p>
                      <span className="text-slate-500">ออกจากร้าน:</span>{" "}
                      {new Intl.DateTimeFormat("th-TH", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "Asia/Bangkok",
                      }).format(new Date(job.delivery_dispatched_at))}
                    </p>
                  ) : null}
                  {job.delivery_notes ? (
                    <p className="text-xs text-slate-600">📝 {job.delivery_notes}</p>
                  ) : null}
                  {job.delivery_tracking_url ? (
                    <a
                      href={job.delivery_tracking_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center justify-center rounded-full bg-sky-900 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-950"
                    >
                      เปิดดูสถานะการจัดส่ง →
                    </a>
                  ) : null}
                </div>
              </section>
            ) : null}
          </main>

          <aside className="space-y-5">
            <section className="rounded-[24px] border border-slate-200 bg-white px-5 py-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
              <h2 className="text-sm font-semibold text-slate-950">สรุปงาน</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">ลูกค้า</dt>
                  <dd className="text-right font-medium text-slate-950">{customer?.display_name || "ไม่ระบุ"}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">ประเภท</dt>
                  <dd className="text-right font-medium text-slate-950">{productLabel}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">การรับงาน</dt>
                  <dd className="flex items-center justify-end gap-1.5 text-right font-medium text-slate-950">
                    <Truck className="size-3.5 text-slate-400" aria-hidden="true" />
                    {fulfillmentMode ? FULFILLMENT_MODE_LABELS[fulfillmentMode] : "ไม่ระบุ"}
                  </dd>
                </div>
                {lead ? (
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">ขนาด</dt>
                    <dd className="text-right font-medium text-slate-950">
                      {(lead.width_mm / 10).toFixed(1)} × {(lead.height_mm / 10).toFixed(1)} ซม.
                    </dd>
                  </div>
                ) : null}
                {lead?.qty ? (
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">จำนวน</dt>
                    <dd className="text-right font-medium text-slate-950">{lead.qty} ชิ้น</dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-4 border-t border-slate-100 pt-3">
                  <dt className="font-semibold text-slate-700">ราคารวม</dt>
                  <dd className="text-right font-semibold text-slate-950">{formatMoney(quote.total)}</dd>
                </div>
              </dl>
            </section>

            {timeline.length > 0 ? (
              <section className="rounded-[24px] border border-slate-200 bg-white px-5 py-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
                <h2 className="text-sm font-semibold text-slate-950">ประวัติสถานะ</h2>
                <div className="mt-4 space-y-4">
                  {timeline.map((entry: { id: string; status: string; note: string; created_at: string }, idx: number) => {
                    const entryInfo = STATUS_DISPLAY[entry.status] || STATUS_DISPLAY.HUMAN_REVIEW_REQUIRED;
                    const EntryIcon = entryInfo.icon;
                    const customerNote = getCustomerTimelineNote(entry.note);

                    return (
                      <div key={entry.id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className={cn("flex size-7 items-center justify-center rounded-full text-white", idx === 0 ? entryInfo.iconColor : "bg-slate-300")}>
                            <EntryIcon className="size-3.5" aria-hidden="true" />
                          </div>
                          {idx < timeline.length - 1 ? <div className="mt-2 w-px flex-1 bg-slate-200" /> : null}
                        </div>
                        <div className="min-w-0 pb-2">
                          <p className={cn("text-sm font-semibold", idx === 0 ? "text-slate-950" : "text-slate-600")}>
                            {entryInfo.label}
                          </p>
                          {customerNote ? <p className="mt-1 text-xs leading-5 text-slate-500">{customerNote}</p> : null}
                          <p className="mt-1 text-xs text-slate-400">{formatBangkokDateTime(entry.created_at)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}
          </aside>
        </div>

        <footer className="pb-2 text-center text-xs text-slate-400">
          มีคำถามเพิ่มเติม? ตอบกลับใน LINE เดิมได้ ทีมงานจะเห็นบริบทของงานนี้ทันที
        </footer>
      </div>
    </div>
  );
}
