import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CheckCircle2,
  CircleAlert,
  Clock3,
  Download,
  FileText,
  ShieldCheck,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  PAYMENT_STATUS_LABELS,
  PAYMENT_TERM_LABELS,
  PRODUCT_TYPES,
  type PaymentStatus,
  type PaymentTerm,
} from "@/lib/types";
import QuoteApproveButton from "./approve-button";
import { paymentUnlocksProduction } from "@/lib/quote-workflow";

type QuoteStatusMeta = {
  badgeLabel: string;
  badgeVariant: "secondary" | "warning" | "success" | "destructive";
  title: string;
  description: string;
  icon: LucideIcon;
  panelClassName: string;
  iconWrapClassName: string;
};

function formatMoney(value: number | string | null | undefined) {
  return `฿${Number(value || 0).toLocaleString("th-TH")}`;
}

function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString("th-TH") : "-";
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

export default async function QuotePage(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;
  const supabase = createAdminClient();

  const { data: quote } = await supabase
    .from("quotes")
    .select("*, quote_items(*), leads(*, customers(*)), jobs(id, status)")
    .eq("public_token", token)
    .single();

  if (!quote) notFound();

  const lead = quote.leads;
  const customer = lead?.customers;
  const items = quote.quote_items || [];
  const productLabel = PRODUCT_TYPES.find((p) => p.value === lead?.product_type)?.label || lead?.product_type || "ไม่ระบุ";
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
  const StatusIcon = statusMeta.icon;
  const showActionPanel = (!hasJob && !isApproved && !isRejected && !isExpired) ||
    (waitingPayment && canRescopeQuote);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.08),transparent_28%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] px-4 py-8">
      <div className="mx-auto max-w-lg overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
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

        <div className="bg-white px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-medium text-gray-500 mb-2">ข้อมูลลูกค้า</h2>
          <p className="text-sm text-gray-900">{customer?.display_name || "ไม่ระบุ"}</p>
          {customer?.phone && <p className="text-sm text-gray-600">{customer.phone}</p>}
        </div>

        <div className="bg-white px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-medium text-gray-500 mb-2">รายละเอียดงาน</h2>
          <div className="space-y-1 text-sm">
            <p><span className="text-gray-500">ประเภท:</span> <span className="font-medium">{productLabel}</span></p>
            {lead && <p><span className="text-gray-500">ขนาด:</span> {(lead.width_mm / 10).toFixed(1)} × {(lead.height_mm / 10).toFixed(1)} ซม.</p>}
            {lead?.qty && <p><span className="text-gray-500">จำนวน:</span> {lead.qty} ชิ้น</p>}
            {lead?.due_date && <p><span className="text-gray-500">กำหนดส่ง:</span> {new Date(lead.due_date).toLocaleDateString("th-TH")}</p>}
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
                  <Link href={downloadUrl} target="_blank" rel="noreferrer">
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
                <div className="mt-5 border-t border-slate-200/80 pt-5">
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
