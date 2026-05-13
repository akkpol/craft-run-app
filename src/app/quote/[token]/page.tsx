import Image from "next/image";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRuntimeAppConfig } from "@/lib/app-settings";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CheckCircle2,
  CircleAlert,
  Clock3,
  Download,
  FileText,
  Landmark,
  ShieldCheck,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatBangkokDate } from "@/lib/bangkok-date-time";
import { resolveProductCatalogLabel } from "@/lib/product-catalog";
import { fetchCommercialAdminContextForQuoteIds } from "@/lib/commercial-admin-context";
import { getUiContract } from "@/lib/workflow-policy";
import {
  BILLING_BRANCH_TYPE_LABELS,
  BILLING_ENTITY_TYPE_LABELS,
  DOCUMENT_REQUEST_TYPE_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_TERM_LABELS,
  type BillingBranchType,
  type BillingEntityType,
  type DocumentRequestType,
  type PaymentStatus,
  type PaymentTerm,
} from "@/lib/types";
import QuoteApproveButton from "./approve-button";
import { paymentUnlocksProduction } from "@/lib/quote-workflow";
import { getPaymentDisplayState } from "@/lib/payment-display";
import { resolvePaymentProfileFromConfig } from "@/lib/payment-routing";
import { getQuotePageReadinessSummary } from "@/lib/public-flow-readiness";
import CustomerFlowCard from "@/components/customer-flow-card";
import PublicFlowStageStrip, { type PublicFlowStageItem } from "@/components/public-flow-stage-strip";

const QUOTE_FLOW_STAGES: PublicFlowStageItem[] = [
  {
    key: "intake",
    label: "Intake",
    description: "เก็บ requirement, ข้อมูลเอกสาร และสร้าง lead/quote token",
  },
  {
    key: "quote",
    label: "Quote Decision",
    description: "ลูกค้าตรวจราคาและเลือกอนุมัติหรือขอแก้ไข",
  },
  {
    key: "payment",
    label: "Payment Ops",
    description: "ยืนยันการชำระและปลด payment gate",
  },
  {
    key: "commercial",
    label: "Commercial Gate",
    description: "ล็อกผู้รับเงินและออกเอกสารชื่อเดียวกับผู้รับชำระ",
  },
  {
    key: "production",
    label: "Status / Production",
    description: "หลังปลด gate แล้วลูกค้าจะติดตามงานต่อจาก status หน้าเดิม",
  },
];

type QuoteStatusMeta = {
  badgeLabel: string;
  badgeVariant: "secondary" | "warning" | "success" | "destructive";
  title: string;
  description: string;
  icon: LucideIcon;
  panelClassName: string;
  iconWrapClassName: string;
};

const THAI_NUMBER_FORMATTER = new Intl.NumberFormat("th-TH-u-nu-latn");

function formatMoney(value: number | string | null | undefined) {
  return `฿${THAI_NUMBER_FORMATTER.format(Number(value || 0))}`;
}

function formatDate(value: string | null | undefined) {
  return formatBangkokDate(value);
}

function getQuoteStatusMeta({
  hasJob,
  waitingPayment,
  isApproved,
  isRejected,
  isExpired,
}: {
  hasJob: boolean;
  waitingPayment: boolean;
  isApproved: boolean;
  isRejected: boolean;
  isExpired: boolean;
}): QuoteStatusMeta {
  if (hasJob) {
    return {
      badgeLabel: "กำลังดำเนินการ",
      badgeVariant: "success",
      title: "ทีมงานเริ่มดำเนินการตามใบเสนอราคาแล้ว",
      description: "ใบเสนอราคานี้ได้รับการยืนยัน และงานถูกส่งเข้าสู่ขั้นตอนถัดไปเรียบร้อยแล้ว",
      icon: CheckCircle2,
      panelClassName: "border-emerald-200/80 bg-gradient-to-br from-white via-emerald-50/70 to-emerald-100/60",
      iconWrapClassName: "bg-emerald-100 text-emerald-700",
    };
  }

  if (waitingPayment) {
    return {
      badgeLabel: "รอยืนยันการชำระ",
      badgeVariant: "warning",
      title: "อนุมัติแล้ว และกำลังรอทีมงานยืนยันการชำระเงิน",
      description: "หากเงื่อนไขหรือรายละเอียดบางส่วนยังไม่ตรง คุณยังสามารถส่งคำขอแก้ไขกลับให้ทีมงานได้",
      icon: Clock3,
      panelClassName: "border-amber-200/80 bg-gradient-to-br from-white via-amber-50/70 to-amber-100/60",
      iconWrapClassName: "bg-amber-100 text-amber-700",
    };
  }

  if (isApproved) {
    return {
      badgeLabel: "อนุมัติแล้ว",
      badgeVariant: "success",
      title: "ใบเสนอราคาได้รับการอนุมัติเรียบร้อย",
      description: "ทีมงานได้รับคำตอบของคุณแล้ว และจะอัปเดตความคืบหน้าให้ในขั้นตอนถัดไป",
      icon: ShieldCheck,
      panelClassName: "border-emerald-200/80 bg-gradient-to-br from-white via-emerald-50/70 to-emerald-100/60",
      iconWrapClassName: "bg-emerald-100 text-emerald-700",
    };
  }

  if (isRejected) {
    return {
      badgeLabel: "ปฏิเสธแล้ว",
      badgeVariant: "destructive",
      title: "ใบเสนอราคานี้ถูกปฏิเสธแล้ว",
      description: "หากต้องการกลับมาปรับรายละเอียดใหม่ คุณสามารถติดต่อทีมงานเพื่อออกใบเสนอราคาอีกครั้งได้",
      icon: XCircle,
      panelClassName: "border-rose-200/80 bg-gradient-to-br from-white via-rose-50/70 to-rose-100/60",
      iconWrapClassName: "bg-rose-100 text-rose-700",
    };
  }

  if (isExpired) {
    return {
      badgeLabel: "หมดอายุ",
      badgeVariant: "destructive",
      title: "ใบเสนอราคานี้หมดอายุแล้ว",
      description: "หากยังต้องการดำเนินงาน กรุณาแจ้งทีมงานเพื่ออัปเดตราคาและวันหมดอายุใหม่",
      icon: CircleAlert,
      panelClassName: "border-rose-200/80 bg-gradient-to-br from-white via-rose-50/70 to-rose-100/60",
      iconWrapClassName: "bg-rose-100 text-rose-700",
    };
  }

  return {
    badgeLabel: "รอการอนุมัติ",
    badgeVariant: "secondary",
    title: "พร้อมให้คุณตรวจสอบและเลือกการดำเนินการ",
    description: "ตรวจรายละเอียดราคาและเงื่อนไขให้ครบก่อนกดยืนยัน หากยังต้องการแก้ไขสามารถส่งกลับให้ทีมงานได้ทันที",
    icon: FileText,
    panelClassName: "border-slate-200/80 bg-gradient-to-br from-white via-slate-50/70 to-slate-100/60",
    iconWrapClassName: "bg-slate-100 text-slate-700",
  };
}

function getQuoteFlowStageKey({
  hasJob,
  waitingPayment,
  isApproved,
  commercialGateActive,
}: {
  hasJob: boolean;
  waitingPayment: boolean;
  isApproved: boolean;
  commercialGateActive: boolean;
}) {
  if (hasJob) {
    return "production";
  }

  if (commercialGateActive) {
    return "commercial";
  }

  if (waitingPayment || isApproved) {
    return "payment";
  }

  return "quote";
}

export default async function QuotePage(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;
  const supabase = createAdminClient();
  const config = await getRuntimeAppConfig();

  const { data: quote } = await supabase
    .from("quotes")
    .select("*, quote_items(*), leads(*, customers(*)), jobs(id, status)")
    .eq("public_token", token)
    .single();

  if (!quote) notFound();

  const lead = quote.leads;
  const customer = lead?.customers;
  const items = quote.quote_items || [];
  const productLabel = resolveProductCatalogLabel({
    productType: lead?.product_type,
    productLabelSnapshot: lead?.product_label_snapshot,
  });
  const isApproved = quote.status === "approved";
  const isRejected = quote.status === "rejected";
  const isExpired = quote.valid_until && new Date(quote.valid_until) < new Date();
  const paymentTerms = quote.payment_terms as PaymentTerm;
  const paymentStatus = quote.payment_status as PaymentStatus;
  const hasJob = Array.isArray(quote.jobs) && quote.jobs.length > 0;
  const productionReady = paymentUnlocksProduction(paymentTerms, paymentStatus);
  const waitingPayment = isApproved && !hasJob && !productionReady;
  const canRejectQuote = quote.status === "sent" && !isExpired;
  const canRescopeQuote = !hasJob && !isExpired && (quote.status === "sent" || waitingPayment);
  const downloadUrl = `/quote/${token}/download`;
  const statusMeta = getQuoteStatusMeta({
    hasJob,
    waitingPayment,
    isApproved,
    isRejected,
    isExpired,
  });
  const paymentRouting =
    quote.payment_profile_snapshot && typeof quote.payment_profile_snapshot === "object" && "profile" in quote.payment_profile_snapshot
      ? (quote.payment_profile_snapshot as ReturnType<typeof resolvePaymentProfileFromConfig>)
      : resolvePaymentProfileFromConfig(config, {
          total: quote.total,
          billingEntityType: lead?.billing_entity_type || null,
          paymentTerms,
        });
  const paymentDisplay = getPaymentDisplayState({
    paymentDisplayMode: paymentRouting.profile.displayMode,
    paymentBankName: paymentRouting.profile.bankName,
    paymentAccountName: paymentRouting.profile.accountName,
    paymentAccountNumber: paymentRouting.profile.accountNumber,
    paymentPromptPayId: paymentRouting.profile.promptPayId,
    paymentQrCodeUrl: paymentRouting.profile.qrCodeUrl,
    paymentQrCodeLabel: paymentRouting.profile.qrCodeLabel,
  });
  const paymentHelpText =
    paymentTerms === "credit"
      ? "รายการนี้เป็นเครดิต ทีมงานจะยืนยันรอบวางบิลหรือกำหนดชำระกับคุณโดยตรง"
      : paymentRouting.profile.instructions ||
        config.paymentInstructions ||
        "หลังโอนเงินแล้ว กรุณาส่งสลิปกลับใน LINE แชตนี้เพื่อให้ทีมงานยืนยันการชำระ";
  const paymentRoutingNote =
    paymentRouting.sourceProfile === "secondary"
      ? paymentRouting.reason === "secondary_total_threshold"
        ? "ระบบเลือกบัญชีรองอัตโนมัติตามยอดใบเสนอราคานี้"
        : paymentRouting.reason === "secondary_payment_terms"
          ? "ระบบเลือกบัญชีรองอัตโนมัติตามประเภทการจ่ายที่ลูกค้าเลือกตอนเริ่มต้น"
          : paymentRouting.reason === "secondary_customer_scope"
            ? "ระบบเลือกบัญชีรองอัตโนมัติตามประเภทลูกค้า"
            : "ระบบสลับไปใช้บัญชีรองอัตโนมัติเพราะบัญชีหลักยังไม่ครบ"
      : null;
  const paymentContact = [
    config.businessPhone ? `โทร ${config.businessPhone}` : null,
    config.businessEmail ? `อีเมล ${config.businessEmail}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const paymentConfirmationText =
    paymentTerms === "credit"
      ? "เครดิตเทอมหรือรอบวางบิลจะมีทีมงานยืนยันให้ต่อใน LINE แชตนี้"
      : "แจ้งชำระเงิน: ส่งสลิปหรือหลักฐานการโอนกลับมาใน LINE แชตนี้เพื่อให้ทีมงานตรวจสอบได้เร็วขึ้น";
  const requestedDocumentType =
    (lead?.requested_document_type as DocumentRequestType | undefined) || "quote";
  const commercialContext = await fetchCommercialAdminContextForQuoteIds([quote.id]);
  const commercialOrder = commercialContext.orderByQuoteId[quote.id] || null;
  const requiredCommercialDocumentType =
    productionReady || waitingPayment
      ? requestedDocumentType === "tax_invoice"
        ? "tax_invoice"
        : "receipt"
      : null;
  const commercialUiContract = getUiContract({
    actor: "customer",
    surface: "quote_page",
    workflow_bundle: {
      quote_status: quote.status,
      payment_terms: paymentTerms,
      payment_status: paymentStatus,
      required_document_type: requiredCommercialDocumentType,
      required_document_issued: Boolean(commercialOrder?.issuedDocumentId),
      commercial_review_required:
        Boolean(requiredCommercialDocumentType) &&
        (!commercialOrder?.selectedReceiverEntityId || !commercialOrder?.paymentReceiverLockedAt),
      payment_receiver_locked: Boolean(commercialOrder?.paymentReceiverLockedAt),
    },
  });
  const requestedDocumentLabel =
    DOCUMENT_REQUEST_TYPE_LABELS[requestedDocumentType] || requestedDocumentType;
  const billingEntityType =
    (lead?.billing_entity_type as BillingEntityType | undefined) || null;
  const billingEntityLabel = billingEntityType
    ? BILLING_ENTITY_TYPE_LABELS[billingEntityType]
    : "-";
  const billingBranchType =
    (lead?.billing_branch_type as BillingBranchType | undefined) || null;
  const billingBranchCode = lead?.billing_branch_code || null;
  const billingBranchLabel =
    billingEntityType === "company" && billingBranchType
      ? billingBranchType === "branch"
        ? `${BILLING_BRANCH_TYPE_LABELS.branch}${billingBranchCode ? ` (${billingBranchCode})` : ""}`
        : BILLING_BRANCH_TYPE_LABELS[billingBranchType]
      : null;
  const billingName =
    lead?.billing_name || customer?.display_name || "ไม่ระบุชื่อลูกค้า";
  const billingAddress = lead?.billing_address || "-";
  const StatusIcon = statusMeta.icon;
  const showActionPanel = (!hasJob && !isApproved && !isRejected && !isExpired) ||
    (waitingPayment && canRescopeQuote);
  const commercialGateActive = commercialUiContract.show_sections.includes("commercial_gate_panel");
  const publicReadiness = getQuotePageReadinessSummary({
    hasJob,
    waitingPayment,
    isApproved,
    isRejected,
    isExpired,
    commercialGateActive,
    commercialHeadline: commercialUiContract.copy_guidance.headline || null,
  });
  const quoteFlowStageKey = getQuoteFlowStageKey({
    hasJob,
    waitingPayment,
    isApproved,
    commercialGateActive,
  });

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-4xl overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
        <div className="border-b border-gray-100 bg-[linear-gradient(180deg,rgba(248,250,252,0.96)_0%,rgba(255,255,255,1)_100%)] px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 ring-1 ring-slate-200/80">
                <FileText className="size-5" />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg font-bold text-gray-900">ใบเสนอราคา</h1>
                <p className="mt-1 text-sm text-slate-500">
                  ตรวจสอบรายละเอียดราคาและเลือกการดำเนินการที่ต้องการ
                </p>
                <p className="mt-2 text-xs font-medium tracking-[0.14em] text-slate-400 uppercase">
                  FOGUS Print &amp; Sign
                </p>
              </div>
            </div>

            <Badge variant={statusMeta.badgeVariant} className="shrink-0">
              {statusMeta.badgeLabel}
            </Badge>
          </div>
        </div>

        <div className="border-b border-sky-100 bg-sky-50/60 px-6 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-700">เลขติดตามงาน</p>
          <p className="mt-1 font-mono text-sm font-semibold text-sky-900 break-all">{token}</p>
          <p className="mt-1 text-xs text-sky-800">ใช้โค้ดนี้เพื่อเปิดหน้าใบเสนอราคา/สถานะงานจากหน้าค้นหา</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href={`/status/${token}`} prefetch={false} className="inline-flex rounded-full border border-sky-200 bg-white px-3 py-1.5 text-xs font-semibold text-sky-700">
              ดูสถานะงาน
            </Link>
            <Link href="/status" prefetch={false} className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
              ค้นหาด้วยเลขติดตาม
            </Link>
          </div>
        </div>

        <div className="border-b border-slate-100 bg-white px-6 py-4">
          <PublicFlowStageStrip
            title="ตอนนี้งานอยู่ช่วงไหนของ flow"
            description="หน้า quote คือจุดตัดสินใจเรื่องราคา การชำระ และเอกสารก่อนปล่อยต่อไปหน้า status/production"
            items={QUOTE_FLOW_STAGES}
            activeKey={quoteFlowStageKey}
          />
        </div>

        <div className="border-b border-slate-100 bg-white px-6 py-4">
          <CustomerFlowCard
            summary={publicReadiness}
            actionHref={showActionPanel ? "#quote-actions" : `/status/${token}`}
            secondaryHref={showActionPanel ? `/status/${token}` : undefined}
            secondaryLabel={showActionPanel ? "ดูสถานะงาน" : undefined}
          />
        </div>

        <div className="border-b border-gray-100 bg-white px-6 py-4">
          <h2 className="mb-3 text-sm font-medium text-gray-500">ข้อมูลลูกค้าและออกเอกสาร</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-sm">
              <p className="font-semibold text-slate-950">{billingName}</p>
              <p className="mt-1 text-slate-600">
                {customer?.phone || "ยังไม่มีเบอร์โทรในระบบ"}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                ที่อยู่ออกเอกสาร: {billingAddress}
              </p>
              {billingBranchLabel ? (
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  สาขา: {billingBranchLabel}
                </p>
              ) : null}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-700">
              <p>
                <span className="text-gray-500">เอกสารที่ร้องขอ:</span>{" "}
                <span className="font-medium text-slate-950">{requestedDocumentLabel}</span>
              </p>
              <p className="mt-1">
                <span className="text-gray-500">ประเภทการวางบิล:</span>{" "}
                <span className="font-medium text-slate-950">{billingEntityLabel}</span>
              </p>
              <p className="mt-1">
                <span className="text-gray-500">Tax ID:</span>{" "}
                <span className="font-medium text-slate-950">{lead?.tax_id || "-"}</span>
              </p>
              {billingBranchLabel ? (
                <p className="mt-1">
                  <span className="text-gray-500">สาขา:</span>{" "}
                  <span className="font-medium text-slate-950">{billingBranchLabel}</span>
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="bg-white px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-medium text-gray-500 mb-2">รายละเอียดงาน</h2>
          <div className="space-y-1 text-sm">
            <p><span className="text-gray-500">ประเภท:</span> <span className="font-medium">{productLabel}</span></p>
            {lead && <p><span className="text-gray-500">ขนาด:</span> {(lead.width_mm / 10).toFixed(1)} × {(lead.height_mm / 10).toFixed(1)} ซม.</p>}
            {lead?.qty && <p><span className="text-gray-500">จำนวน:</span> {lead.qty} ชิ้น</p>}
            {lead?.due_date && <p><span className="text-gray-500">กำหนดส่ง:</span> {formatDate(lead.due_date)}</p>}
            {lead?.note_from_form && <p><span className="text-gray-500">หมายเหตุ:</span> {lead.note_from_form}</p>}
          </div>
        </div>

        <div className="bg-white px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-medium text-gray-500 mb-3">รายการ</h2>
          {items.map((item: { id: string; label: string; line_total: number }) => (
            <div key={item.id} className="flex justify-between text-sm py-1">
              <span className="text-gray-700">{item.label}</span>
              <span className="font-medium">{formatMoney(item.line_total)}</span>
            </div>
          ))}
        </div>

        <div className="bg-white px-6 py-4 border-b border-gray-100 space-y-1">
          <div className="flex justify-between text-sm"><span className="text-gray-500">ราคาก่อน VAT</span><span>{formatMoney(quote.subtotal)}</span></div>
          <div className="flex justify-between text-sm"><span className="text-gray-500">VAT 7%</span><span>{formatMoney(quote.vat)}</span></div>
          <div className="flex justify-between border-t border-gray-100 pt-2 text-base font-bold"><span>รวมทั้งสิ้น</span><span className="text-slate-950">{formatMoney(quote.total)}</span></div>
        </div>

        <div className="bg-white px-6 py-4 border-b border-gray-100 space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-gray-500">เงื่อนไขชำระเงิน</span><span>{PAYMENT_TERM_LABELS[paymentTerms]}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">สถานะชำระเงิน</span><span>{PAYMENT_STATUS_LABELS[paymentStatus]}</span></div>
        </div>

        <div className="bg-white px-6 py-4 border-b border-gray-100">
          <div
            className={`overflow-hidden rounded-[24px] border ${waitingPayment
              ? "border-amber-200 bg-amber-50/80"
              : "border-slate-200 bg-slate-50/80"}`}
          >
            <div className="flex flex-col gap-4 p-5">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-white text-slate-700 ring-1 ring-slate-200/80">
                  <Landmark className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">ช่องทางชำระเงิน</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">{paymentHelpText}</p>
                  {paymentRoutingNote ? (
                    <p className="mt-2 text-xs font-medium text-sky-700">{paymentRoutingNote}</p>
                  ) : null}
                  {waitingPayment ? (
                    <p className="mt-2 text-xs font-medium text-amber-700">
                      งานจะเริ่มต่อเมื่อทีมงานยืนยันยอดชำระตามเงื่อนไขนี้แล้ว
                    </p>
                  ) : null}
                </div>
              </div>

              {paymentTerms === "credit" ? (
                <div className="rounded-2xl bg-white/80 px-4 py-3 text-sm leading-relaxed text-slate-600 ring-1 ring-slate-200/70">
                  รายการนี้ไม่ต้องโอนทันที หากต้องการเอกสารประกอบการชำระหรือรอบวางบิล กรุณาติดต่อทีมงาน
                  {paymentContact ? ` ที่ ${paymentContact}` : " ผ่าน LINE แชตนี้"}
                </div>
              ) : paymentDisplay.showDetails || paymentDisplay.showQr ? (
                <div className={`grid gap-3 ${paymentDisplay.showDetails && paymentDisplay.showQr ? "lg:grid-cols-[minmax(0,1fr)_220px]" : "sm:grid-cols-2"}`}>
                  {paymentDisplay.showDetails ? paymentDisplay.paymentDetails.map((detail) => (
                    <div key={detail.label} className="rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200/70">
                      <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400">
                        {detail.label}
                      </p>
                      <p className="mt-2 wrap-break-word text-sm font-semibold text-slate-950">
                        {detail.value}
                      </p>
                    </div>
                  )) : null}
                  {paymentDisplay.showQr ? (
                    <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200/70">
                      <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400">
                        QR Code
                      </p>
                      <div className="mt-3 flex justify-center">
                        <Image
                          src={paymentDisplay.qrCodeUrl}
                          alt="Payment QR Code"
                          width={180}
                          height={180}
                          unoptimized
                          className="h-45 w-45 rounded-2xl object-contain"
                        />
                      </div>
                      <p className="mt-3 text-center text-xs font-medium text-slate-600">
                        {paymentDisplay.qrCodeLabel}
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-2xl bg-white/80 px-4 py-3 text-sm leading-relaxed text-slate-600 ring-1 ring-slate-200/70">
                  กรุณาติดต่อทีมงานเพื่อยืนยันช่องทางชำระเงินสำหรับรายการนี้
                  {paymentContact ? ` ที่ ${paymentContact}` : " ผ่าน LINE แชตนี้"}
                </div>
              )}

              <div className="rounded-2xl bg-white/70 px-4 py-3 text-xs leading-relaxed text-slate-500 ring-1 ring-slate-200/60">
                {paymentConfirmationText}
              </div>
            </div>
          </div>
        </div>

        {commercialUiContract.show_sections.includes("commercial_gate_panel") ? (
          <div className="bg-white px-6 py-4 border-b border-gray-100">
            <div className="overflow-hidden rounded-[24px] border border-emerald-200 bg-emerald-50/80">
              <div className="flex flex-col gap-3 p-5">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-white text-emerald-700 ring-1 ring-emerald-200/80">
                    <ShieldCheck className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-emerald-950">
                      {commercialUiContract.copy_guidance.headline || "ทีมงานกำลังตรวจสอบเอกสารหลังรับชำระ"}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-emerald-900/80">
                      {commercialOrder?.paymentReceiverLockedAt
                        ? "ทีมงานยืนยันผู้รับเงินแล้ว และกำลังออกเอกสารจากชื่อเดียวกับบัญชีที่รับชำระ"
                        : "ทีมงานกำลังตรวจสอบผู้รับเงินและเงื่อนไขเอกสารก่อนปลดล็อกขั้นตอนถัดไป"}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl bg-white/80 px-4 py-3 text-xs leading-relaxed text-emerald-950 ring-1 ring-emerald-200/70">
                  {commercialOrder?.issuedDocumentNumber
                    ? `เอกสารออกแล้วเลขที่ ${commercialOrder.issuedDocumentNumber}`
                    : requiredCommercialDocumentType === "tax_invoice"
                      ? "หากคุณขอใบกำกับภาษี ระบบจะออกใบเสร็จรับเงิน/ใบกำกับภาษีหลังทีมงานตรวจสอบครบแล้ว"
                      : "หลังทีมงานยืนยันรับชำระครบ ระบบจะออกใบเสร็จรับเงินตามนโยบายบริษัท"}
                </div>

                {commercialUiContract.show_ctas.includes("contact_admin") ? (
                  <div>
                    <Link
                      href={`/status/${token}`}
                      prefetch={false}
                      className="inline-flex rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800"
                    >
                      ดูสถานะล่าสุด
                    </Link>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {quote.valid_until && (
          <div className="bg-white px-6 py-3 border-b border-gray-100">
            <p className="text-xs text-gray-400 text-center">ใบเสนอราคาใช้ได้ถึง {formatDate(quote.valid_until)}</p>
          </div>
        )}

        <div className="bg-white px-6 py-4 border-b border-gray-100">
          <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-[linear-gradient(135deg,rgba(248,250,252,0.95)_0%,rgba(241,245,249,0.85)_100%)]">
            <div className="flex flex-col gap-4 p-5">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-white text-slate-700 ring-1 ring-slate-200/80">
                  <Download className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">ต้องการเก็บเอกสารไว้ก่อน?</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">
                    ดาวน์โหลดใบเสนอราคาแยกได้ โดยไม่เปลี่ยนสถานะการอนุมัติหรือขั้นตอนงาน
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="rounded-2xl bg-white/80 px-3 py-2 text-xs leading-relaxed text-slate-500 ring-1 ring-slate-200/70">
                  เอกสารดาวน์โหลดเป็นสำเนาสำหรับตรวจสอบและพิมพ์เก็บไว้ภายหลัง
                </div>

                <Button asChild variant="outline" className="w-full bg-white sm:w-auto">
                  {/*
                    Avoid target="_blank" here — this page is opened inside LINE's
                    in-app browser via the push-message link, and target="_blank"
                    can spawn an external system browser, which the customer cannot
                    easily get back from. Opening the download page in the same tab
                    lets them use LINE's back button to return.
                  */}
                  <Link href={downloadUrl} rel="noreferrer">
                    <Download className="size-4" />
                    ดาวน์โหลดใบเสนอราคา
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-b-[28px] px-6 py-5">
          <div className={`overflow-hidden rounded-[24px] border ${statusMeta.panelClassName}`}>
            <div className="p-5">
              <div className="flex items-start gap-4">
                <div
                  className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${statusMeta.iconWrapClassName}`}
                >
                  <StatusIcon className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-slate-950">{statusMeta.title}</p>
                      <p className="mt-1 text-sm leading-relaxed text-slate-600">
                        {statusMeta.description}
                      </p>
                    </div>

                    <Badge variant={statusMeta.badgeVariant} className="shrink-0 self-start">
                      {statusMeta.badgeLabel}
                    </Badge>
                  </div>
                </div>
              </div>

              {showActionPanel ? (
                <div id="quote-actions" className="mt-5 border-t border-slate-200/80 pt-5 scroll-mt-6">
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                    การดำเนินการ
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    {waitingPayment
                      ? "หากข้อมูลหรือเงื่อนไขยังไม่ตรง คุณสามารถส่งคำขอแก้ไขกลับให้ทีมงานได้ทันที"
                      : "เมื่อรายละเอียดทั้งหมดถูกต้อง คุณสามารถอนุมัติใบเสนอราคา หรือส่งกลับให้ทีมงานปรับรายละเอียดเพิ่มเติมได้"}
                  </p>

                  <div className="mt-4">
                    <QuoteApproveButton
                      quoteToken={token}
                      allowApprove={!waitingPayment}
                      allowReject={canRejectQuote}
                      allowRescope={canRescopeQuote}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
