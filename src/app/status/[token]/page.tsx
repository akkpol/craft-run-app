import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { formatBangkokDateTime } from "@/lib/bangkok-date-time";
import { resolveProductCatalogLabel } from "@/lib/product-catalog";
import { fetchCommercialAdminContextForQuoteIds } from "@/lib/commercial-admin-context";
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
import CustomerStatusActions from "./customer-status-actions";
import CopyTrackingCodeButton from "./copy-tracking-code-button";

const STATUS_DISPLAY: Record<string, { label: string; color: string; icon: string }> = {
  IN_DESIGN: { label: "กำลังออกแบบ", color: "bg-violet-100 text-violet-700", icon: "🎨" },
  IN_PRODUCTION: { label: "กำลังผลิต", color: "bg-yellow-100 text-yellow-700", icon: "🏭" },
  READY_FOR_FULFILLMENT: { label: "พร้อมส่งมอบ", color: "bg-blue-100 text-blue-700", icon: "📦" },
  ON_HOLD_CUSTOMER_INPUT: { label: "รอข้อมูลจากลูกค้า", color: "bg-amber-100 text-amber-700", icon: "📝" },
  HUMAN_REVIEW_REQUIRED: { label: "ทีมงานกำลังตรวจสอบ", color: "bg-rose-100 text-rose-700", icon: "🙋" },
  COMPLETED: { label: "เสร็จสมบูรณ์", color: "bg-green-100 text-green-700", icon: "✅" },
  CANCELLED: { label: "ยกเลิก", color: "bg-red-100 text-red-700", icon: "❌" },
};

const THAI_NUMBER_FORMATTER = new Intl.NumberFormat("th-TH-u-nu-latn");

function getStatusDisplayForFulfillment(
  status: string | null | undefined,
  fulfillmentMode: FulfillmentMode | null
) {
  if (status === "READY_FOR_FULFILLMENT") {
    if (fulfillmentMode === "pickup") {
      return { label: "พร้อมให้รับงาน", color: "bg-blue-100 text-blue-700", icon: "📦" };
    }

    if (fulfillmentMode === "install") {
      return { label: "พร้อมเข้าติดตั้ง", color: "bg-blue-100 text-blue-700", icon: "🛠️" };
    }
  }

  if (status === "COMPLETED") {
    if (fulfillmentMode === "pickup") {
      return { label: "รับงานแล้ว", color: "bg-green-100 text-green-700", icon: "✅" };
    }

    if (fulfillmentMode === "install") {
      return { label: "ติดตั้งแล้ว", color: "bg-green-100 text-green-700", icon: "✅" };
    }
  }

  return STATUS_DISPLAY[status || ""] || {
    label: status || "ไม่ระบุ",
    color: "bg-gray-100 text-gray-700",
    icon: "📋",
  };
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

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="bg-white rounded-t-2xl px-6 py-5 border-b border-gray-100 text-center">
          <h1 className="text-lg font-bold text-gray-900">📊 สถานะงาน</h1>
          <p className="text-xs text-gray-400 mt-1">FOGUS Print &amp; Sign</p>
        </div>

        {/* Current status */}
        <div className="bg-white px-6 py-6 border-b border-gray-100 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="text-4xl">{statusInfo.icon}</div>
            <CopyTrackingCodeButton token={token} />
          </div>
          <div className={`inline-block px-4 py-1.5 rounded-full text-sm font-medium ${statusInfo.color}`}>
            {statusInfo.label}
          </div>
          {waitingQuoteApproval ? (
            <div className="mt-3 space-y-2">
              <p className="text-sm font-medium text-amber-700">งานนี้รอลูกค้าอนุมัติใบเสนอราคา</p>
              <Link
                href={`/quote/${token}`}
                prefetch={false}
                className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800"
              >
                ไปอนุมัติใบเสนอราคา
              </Link>
            </div>
          ) : null}
        </div>

        <div className="bg-sky-50/60 px-6 py-4 border-b border-sky-100">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-700">เลขติดตามงาน</p>
          <p className="mt-1 break-all font-mono text-sm font-semibold text-sky-900">{token}</p>
          <p className="mt-1 text-xs text-sky-800">ใช้โค้ดนี้เปิดหน้านี้หรือหน้าใบเสนอราคาได้ตลอดเวลา</p>
          <div className="mt-3">
            <Link href="/status" prefetch={false} className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
              ค้นหาด้วยเลขติดตาม
            </Link>
          </div>
        </div>

        {commercialUiContract.show_sections.includes("commercial_gate_notice") ? (
          <div className="bg-white px-6 py-4 border-b border-gray-100">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
              <p className="text-sm font-semibold text-emerald-950">
                {commercialUiContract.copy_guidance.headline || "ทีมงานกำลังดูแลเอกสารหลังรับชำระ"}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-emerald-900/80">
                {commercialOrder?.paymentReceiverLockedAt
                  ? commercialOrder?.issuedDocumentNumber
                    ? `เอกสารออกแล้วเลขที่ ${commercialOrder.issuedDocumentNumber}`
                    : "ทีมงานยืนยันผู้รับเงินแล้ว และกำลังออกเอกสารตามขั้นตอนของบริษัทก่อนเริ่มผลิตหรือส่งมอบ"
                  : "ระบบกำลังรอตรวจสอบผู้รับเงินและเงื่อนไขเอกสาร เพื่อให้เอกสารออกชื่อเดียวกับผู้รับชำระ"}
              </p>
            </div>
          </div>
        ) : null}

        {/* Job details */}
        <div className="bg-white px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-medium text-gray-500 mb-2">รายละเอียด</h2>
          <div className="space-y-1 text-sm">
            <p><span className="text-gray-500">ลูกค้า:</span> {customer?.display_name || "ไม่ระบุ"}</p>
            <p><span className="text-gray-500">ประเภท:</span> {productLabel}</p>
            <p><span className="text-gray-500">การรับงาน:</span> {fulfillmentMode ? FULFILLMENT_MODE_LABELS[fulfillmentMode] : "ไม่ระบุ"}</p>
            {lead && <p><span className="text-gray-500">ขนาด:</span> {(lead.width_mm / 10).toFixed(1)} × {(lead.height_mm / 10).toFixed(1)} ซม.</p>}
            {lead?.qty && <p><span className="text-gray-500">จำนวน:</span> {lead.qty} ชิ้น</p>}
            <p><span className="text-gray-500">ราคารวม:</span> <span className="font-medium">฿{THAI_NUMBER_FORMATTER.format(Number(quote.total))}</span></p>
          </div>
        </div>

        {(lead?.hold_reason || lead?.human_review_reason) && (
          <div className="bg-white px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-medium text-gray-500 mb-2">หมายเหตุล่าสุด</h2>
            {lead?.hold_reason ? (
              <p className="text-sm text-amber-700">ลูกค้ายังต้องส่งข้อมูลเพิ่ม: {lead.hold_reason}</p>
            ) : null}
            {lead?.human_review_reason ? (
              <p className="text-sm text-rose-700">ทีมงานกำลังตรวจสอบ: {lead.human_review_reason}</p>
            ) : null}
          </div>
        )}

        {(lead?.design_status || (Array.isArray(lead?.ai_generated_images) && lead.ai_generated_images.length > 0)) && (
          <div className="bg-white px-6 py-4 border-b border-gray-100">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-medium text-gray-500">สถานะแบบ</h2>
              {designStatus ? (
                <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700">
                  {DESIGN_STATUS_LABELS[designStatus]}
                </span>
              ) : null}
            </div>

            {Array.isArray(lead?.ai_generated_images) && lead.ai_generated_images.length > 0 ? (
              <div className="mt-3 grid grid-cols-2 gap-3">
                {lead.ai_generated_images.map((imageUrl: string) => (
                  <a
                    key={imageUrl}
                    href={imageUrl}
                    target="_blank"
                    rel="noreferrer"
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
          </div>
        )}

        {/* Timeline */}
        {timeline.length > 0 && (
          <div className="bg-white px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-medium text-gray-500 mb-3">ประวัติสถานะ</h2>
            <div className="space-y-3">
              {timeline.map((entry: { id: string; status: string; note: string; created_at: string }, idx: number) => {
                const entryInfo = STATUS_DISPLAY[entry.status] || { label: entry.status, icon: "📋" };
                return (
                  <div key={entry.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-2.5 h-2.5 rounded-full ${idx === 0 ? "bg-[#1a1a2e]" : "bg-gray-300"}`} />
                      {idx < timeline.length - 1 && <div className="w-0.5 flex-1 bg-gray-200 mt-1" />}
                    </div>
                    <div className="pb-3">
                      <p className={`text-sm font-medium ${idx === 0 ? "text-gray-900" : "text-gray-500"}`}>
                        {entryInfo.icon} {entryInfo.label}
                      </p>
                      {entry.note && <p className="text-xs text-gray-400 mt-0.5">{entry.note}</p>}
                      <p className="text-xs text-gray-300 mt-0.5">
                        {formatBangkokDateTime(entry.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="bg-white rounded-b-2xl px-6 py-4 text-center">
          <p className="text-xs text-gray-400">มีคำถาม? ทักหาเราทาง LINE ได้เลยค่ะ</p>
        </div>
      </div>
    </div>
  );
}
