import { createAdminClient } from "@/lib/supabase/admin";
import { getRuntimeAppConfig } from "@/lib/app-settings";
import {
  PAYMENT_STATUS_LABELS,
  PAYMENT_TERM_LABELS,
  PRODUCT_TYPES,
  type PaymentStatus,
  type PaymentTerm,
} from "@/lib/types";
import { notFound } from "next/navigation";
import PrintToolbar from "./print-toolbar";

export const dynamic = "force-dynamic";

export default async function QuoteDownloadPage(props: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await props.params;
  const supabase = createAdminClient();
  const config = await getRuntimeAppConfig();

  const { data: quote } = await supabase
    .from("quotes")
    .select("*, quote_items(*), leads(*, customers(*))")
    .eq("public_token", token)
    .single();

  if (!quote) notFound();

  const lead = quote.leads;
  const customer = lead?.customers;
  const items = quote.quote_items || [];
  const productLabel =
    PRODUCT_TYPES.find((p) => p.value === lead?.product_type)?.label ||
    lead?.product_type ||
    "ไม่ระบุ";
  const paymentTerms = quote.payment_terms as PaymentTerm;
  const paymentStatus = quote.payment_status as PaymentStatus;
  const issueDate = new Date(quote.created_at).toLocaleDateString("th-TH");
  const validUntil = quote.valid_until
    ? new Date(quote.valid_until).toLocaleDateString("th-TH")
    : "-";
  const quoteNumber = `QT-${token.slice(0, 8).toUpperCase()}`;
  const quoteUrl = `/quote/${token}`;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#e2e8f0_100%)] px-4 py-6 text-slate-900 print:bg-white print:p-0">
      <style>{`
        @page {
          size: A4;
          margin: 14mm;
        }
      `}</style>

      <div className="mx-auto flex w-full max-w-5xl justify-end pb-4">
        <PrintToolbar quoteUrl={quoteUrl} />
      </div>

      <article className="mx-auto w-full max-w-5xl overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.12)] print:max-w-none print:rounded-none print:border-0 print:shadow-none">
        <header className="relative overflow-hidden border-b border-slate-200 bg-[#1a1a2e] px-8 py-8 text-white print:px-0">
          <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.22),transparent_58%)]" />
          <div className="relative flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
            <div>
              {config.businessLogoUrl ? (
                <img
                  src={config.businessLogoUrl}
                  alt={config.businessName}
                  className="mb-4 h-16 w-auto rounded-2xl bg-white/95 p-2"
                />
              ) : null}
              <p className="text-sm font-semibold uppercase tracking-[0.32em] text-amber-300">
                {config.businessName}
              </p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight">
                ใบเสนอราคา
              </h1>
              <p className="mt-2 max-w-xl text-sm text-slate-300">
                เอกสารสำหรับตรวจสอบรายละเอียดราคาและใช้ประกอบการอนุมัติงาน
              </p>
            </div>

            <div className="grid gap-2 rounded-3xl border border-white/10 bg-white/8 px-5 py-4 text-sm backdrop-blur-sm">
              <div className="flex items-center justify-between gap-6">
                <span className="text-slate-300">เลขที่เอกสาร</span>
                <span className="font-semibold text-white">{quoteNumber}</span>
              </div>
              <div className="flex items-center justify-between gap-6">
                <span className="text-slate-300">วันที่ออกเอกสาร</span>
                <span className="font-semibold text-white">{issueDate}</span>
              </div>
              <div className="flex items-center justify-between gap-6">
                <span className="text-slate-300">ใช้ได้ถึง</span>
                <span className="font-semibold text-white">{validUntil}</span>
              </div>
            </div>
          </div>
        </header>

        <div className="grid gap-6 border-b border-slate-200 px-8 py-8 md:grid-cols-[1.1fr,0.9fr] print:px-0">
          <section className="rounded-[28px] border border-slate-200 bg-slate-50 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              ข้อมูลลูกค้า
            </p>
            <div className="mt-4 space-y-2 text-sm leading-6">
              <p className="text-lg font-semibold text-slate-950">
                {customer?.display_name || "ไม่ระบุชื่อลูกค้า"}
              </p>
              <p className="text-slate-600">โทร: {customer?.phone || "-"}</p>
              {config.businessPhone ? <p className="text-slate-600">เบอร์ร้าน: {config.businessPhone}</p> : null}
              {config.businessEmail ? <p className="text-slate-600">อีเมลร้าน: {config.businessEmail}</p> : null}
              <p className="text-slate-600">ประเภทงาน: {productLabel}</p>
              <p className="text-slate-600">
                ขนาด: {(lead?.width_mm / 10).toFixed(1)} x {(lead?.height_mm / 10).toFixed(1)} ซม.
              </p>
              <p className="text-slate-600">จำนวน: {lead?.qty || 0} ชิ้น</p>
              <p className="text-slate-600">
                กำหนดส่ง: {lead?.due_date ? new Date(lead.due_date).toLocaleDateString("th-TH") : "-"}
              </p>
            </div>
          </section>

          <section className="rounded-[28px] border border-amber-200 bg-amber-50 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-700">
              เงื่อนไขเชิงพาณิชย์
            </p>
            <div className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
              <div className="flex items-start justify-between gap-6 border-b border-amber-100 pb-3">
                <span>เงื่อนไขชำระเงิน</span>
                <span className="text-right font-semibold text-slate-950">
                  {PAYMENT_TERM_LABELS[paymentTerms]}
                </span>
              </div>
              <div className="flex items-start justify-between gap-6 border-b border-amber-100 pb-3">
                <span>สถานะชำระเงิน</span>
                <span className="text-right font-semibold text-slate-950">
                  {PAYMENT_STATUS_LABELS[paymentStatus]}
                </span>
              </div>
              <div className="flex items-start justify-between gap-6">
                <span>สถานะใบเสนอราคา</span>
                <span className="text-right font-semibold text-slate-950">
                  {quote.status}
                </span>
              </div>
            </div>
          </section>
        </div>

        <div className="px-8 py-8 print:px-0">
          <section className="overflow-hidden rounded-[28px] border border-slate-200">
            <div className="grid grid-cols-[1.4fr,0.55fr,0.55fr] bg-slate-950 px-6 py-4 text-xs font-semibold uppercase tracking-[0.24em] text-slate-200">
              <span>รายการ</span>
              <span className="text-right">จำนวนเงิน</span>
              <span className="text-right">รวม</span>
            </div>

            <div className="divide-y divide-slate-200 bg-white">
              {items.map((item: { id: string; label: string; qty: number; line_total: number }) => (
                <div
                  key={item.id}
                  className="grid grid-cols-[1.4fr,0.55fr,0.55fr] px-6 py-4 text-sm text-slate-700"
                >
                  <div>
                    <p className="font-medium text-slate-950">{item.label}</p>
                  </div>
                  <p className="text-right">{item.qty}</p>
                  <p className="text-right font-semibold text-slate-950">
                    ฿{Number(item.line_total).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <div className="mt-8 grid gap-6 md:grid-cols-[1.1fr,0.9fr]">
            <section className="rounded-[28px] border border-slate-200 bg-slate-50 p-6 text-sm leading-7 text-slate-600">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                หมายเหตุ
              </p>
              <div className="mt-4 space-y-2">
                <p>1. ใบเสนอราคานี้จัดทำจากข้อมูลที่ลูกค้าแจ้งผ่าน LINE OA และ LIFF</p>
                <p>2. ราคานี้รวม VAT 7% แล้ว</p>
                <p>3. ลูกค้าสามารถกลับไปกดอนุมัติผ่านลิงก์ใบเสนอราคาเดิมได้ทุกเมื่อภายในอายุเอกสาร</p>
                <p>4. หมายเหตุเพิ่มเติม: {lead?.note_from_form || "-"}</p>
              </div>
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-white p-6">
              <div className="space-y-3 text-sm text-slate-700">
                <div className="flex items-center justify-between">
                  <span>ราคาก่อน VAT</span>
                  <span>฿{Number(quote.subtotal).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <span>VAT 7%</span>
                  <span>฿{Number(quote.vat).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-xl font-bold text-slate-950">
                  <span>รวมทั้งสิ้น</span>
                  <span>฿{Number(quote.total).toLocaleString()}</span>
                </div>
              </div>
            </section>
          </div>
        </div>
      </article>
    </div>
  );
}