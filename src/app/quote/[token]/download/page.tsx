import Image from "next/image";
import { notFound } from "next/navigation";
import { getRuntimeAppConfig } from "@/lib/app-settings";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  PAYMENT_STATUS_LABELS,
  PAYMENT_TERM_LABELS,
  PRODUCT_TYPES,
  type PaymentStatus,
  type PaymentTerm,
} from "@/lib/types";
import PrintToolbar from "./print-toolbar";

export const dynamic = "force-dynamic";

type QuoteItem = {
  id: string;
  label: string | null;
  qty: number | null;
  unit_price: number | null;
  line_total: number | null;
};

const QUOTE_STATUS_LABELS: Record<string, string> = {
  draft: "ร่าง",
  sent: "ส่งให้ลูกค้าแล้ว",
  approved: "อนุมัติแล้ว",
  rejected: "ปฏิเสธแล้ว",
  expired: "หมดอายุ",
};

function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString("th-TH") : "-";
}

function formatMoney(value: number | string | null | undefined) {
  return Number(value || 0).toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDimension(widthMm?: number | null, heightMm?: number | null) {
  if (!widthMm || !heightMm) {
    return "-";
  }

  return `${(widthMm / 10).toLocaleString("th-TH", {
    maximumFractionDigits: 1,
  })} x ${(heightMm / 10).toLocaleString("th-TH", {
    maximumFractionDigits: 1,
  })} ซม.`;
}

function joinContact(parts: Array<string | null | undefined>) {
  const cleanParts = parts.map((part) => part?.trim()).filter(Boolean);
  return cleanParts.length > 0 ? cleanParts.join("   ") : "-";
}

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
  const items = (quote.quote_items || []) as QuoteItem[];
  const productLabel =
    PRODUCT_TYPES.find((product) => product.value === lead?.product_type)?.label ||
    lead?.product_type ||
    "ไม่ระบุ";
  const paymentTerms = quote.payment_terms as PaymentTerm;
  const paymentStatus = quote.payment_status as PaymentStatus;
  const quoteNumber = `QT-${token.slice(0, 8).toUpperCase()}`;
  const quoteUrl = `/quote/${token}`;
  const summary = `${productLabel} / ${formatDimension(
    lead?.width_mm,
    lead?.height_mm
  )} / ${lead?.qty || 0} ชิ้น`;
  const displayRows = items.length > 0 ? items : [null];

  return (
    <div className="min-h-screen bg-[#eef3f8] px-4 py-6 text-slate-950 print:bg-white print:p-0">
      <style>{`
        @page {
          size: A4;
          margin: 12mm;
        }

        @media print {
          body {
            background: white;
          }
        }
      `}</style>

      <div className="mx-auto flex w-full max-w-[210mm] justify-end pb-4">
        <PrintToolbar quoteUrl={quoteUrl} />
      </div>

      <article className="mx-auto min-h-[297mm] w-full max-w-[210mm] bg-white px-4 py-4 shadow-[0_24px_90px_rgba(15,23,42,0.16)] sm:px-6 sm:py-6 md:px-[14mm] md:py-[14mm] print:min-h-0 print:max-w-none print:px-0 print:py-0 print:shadow-none">
        <div className="flex min-h-[269mm] flex-col overflow-hidden rounded-sm border border-slate-200 print:min-h-0 print:border-slate-200">
          <header className="grid gap-8 p-5 sm:p-6 md:grid-cols-[minmax(0,1.45fr)_minmax(0,0.9fr)]">
            <div className="min-w-0">
              <h1 className="text-4xl font-black tracking-tight text-[#123B63]">
                ใบเสนอราคา / Quotation
              </h1>
              <p className="mt-3 break-words text-sm text-slate-600">
                เอกสารสำหรับตรวจสอบรายละเอียดราคา อนุมัติงาน และอ้างอิงก่อนเริ่มผลิต
              </p>
            </div>

            <div className="grid min-w-0 gap-4">
              <div className="flex justify-end">
                <div className="flex h-[28mm] w-[38mm] items-center justify-center border border-dashed border-slate-400 bg-white text-sm font-bold text-slate-500">
                  {config.businessLogoUrl ? (
                    <Image
                      src={config.businessLogoUrl}
                      alt={config.businessName}
                      width={144}
                      height={88}
                      unoptimized
                      className="max-h-[24mm] w-auto object-contain p-2"
                    />
                  ) : (
                    "[LOGO]"
                  )}
                </div>
              </div>

              <DocumentField label="เลขที่ใบเสนอราคา / Quote No." value={quoteNumber} />
              <DocumentField label="วันที่ / Issue Date" value={formatDate(quote.created_at)} />
              <DocumentField label="อายุใบเสนอราคา / Valid Until" value={formatDate(quote.valid_until)} />
            </div>
          </header>

          <section className="grid gap-6 px-5 pb-6 sm:px-6 md:grid-cols-2">
            <InfoBox
              title="ผู้ออกใบเสนอราคา / Seller"
              rows={[
                config.businessName,
                "FOGUS Print & Sign",
                "เลขประจำตัวผู้เสียภาษี / Tax ID: -",
                joinContact([
                  config.businessPhone &&
                    `โทรศัพท์ / Phone: ${config.businessPhone}`,
                  config.businessEmail && `อีเมล / Email: ${config.businessEmail}`,
                ]),
                "ที่อยู่บริษัท / Company Address: -",
              ]}
            />
            <InfoBox
              title="ลูกค้า / Bill To"
              rows={[
                customer?.display_name || "ไม่ระบุชื่อลูกค้า",
                "ชื่อบริษัทลูกค้า / Customer Company: -",
                "ผู้ติดต่อ / Contact Person: -",
                joinContact([
                  customer?.phone && `โทรศัพท์ / Phone: ${customer.phone}`,
                ]),
                "ที่อยู่ลูกค้า / Customer Address: -",
              ]}
            />
          </section>

          <section className="px-5 pb-6 sm:px-6">
            <DocumentField
              label="สรุปงาน / Project or Service Summary"
              value={summary}
            />
          </section>

          <section className="px-5 sm:px-6">
            <div className="overflow-hidden border border-slate-200">
              <div className="hidden grid-cols-[12mm_minmax(0,1fr)_minmax(16mm,20mm)_minmax(24mm,30mm)_minmax(24mm,30mm)] bg-[#123B63] text-[11px] font-bold text-white md:grid print:grid">
                <div className="px-3 py-3">ลำดับ / No.</div>
                <div className="px-3 py-3">รายการ / Description</div>
                <div className="px-3 py-3 text-right">จำนวน / Qty</div>
                <div className="px-3 py-3 text-right">ราคา / Unit Price</div>
                <div className="px-3 py-3 text-right">รวม / Amount</div>
              </div>

              {displayRows.map((item, index) => (
                <div
                  key={`${item?.id ?? "empty-row"}-mobile`}
                  className="border-t border-slate-200 p-4 first:border-t-0 md:hidden print:hidden"
                >
                  <div className="flex items-start justify-between gap-3 text-xs font-semibold text-slate-500">
                    <span>ลำดับ / No. {item ? index + 1 : "-"}</span>
                    <span>จำนวน / Qty {item?.qty ?? lead?.qty ?? "-"}</span>
                  </div>
                  <p className="mt-3 break-words text-sm font-semibold text-slate-950">
                    {item?.label || productLabel}
                  </p>
                  <div className="mt-4 space-y-2 text-sm text-slate-700">
                    <MobileMetaRow
                      label="ราคา / Unit Price"
                      value={formatMoney(item?.unit_price)}
                    />
                    <MobileMetaRow
                      label="รวม / Amount"
                      value={formatMoney(item?.line_total)}
                    />
                  </div>
                </div>
              ))}

              {displayRows.map((item, index) => (
                <div
                  key={item?.id ?? "empty-row"}
                  className="hidden min-h-[12mm] grid-cols-[12mm_minmax(0,1fr)_minmax(16mm,20mm)_minmax(24mm,30mm)_minmax(24mm,30mm)] border-t border-slate-200 text-sm md:grid print:grid"
                >
                  <div className="border-r border-slate-200 px-3 py-3 text-right">
                    {item ? index + 1 : "-"}
                  </div>
                  <div className="min-w-0 border-r border-slate-200 px-3 py-3 break-words">
                    {item?.label || productLabel}
                  </div>
                  <div className="border-r border-slate-200 px-3 py-3 text-right">
                    {item?.qty ?? lead?.qty ?? "-"}
                  </div>
                  <div className="border-r border-slate-200 px-3 py-3 text-right">
                    {formatMoney(item?.unit_price)}
                  </div>
                  <div className="px-3 py-3 text-right">
                    {formatMoney(item?.line_total)}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-8 px-5 py-6 sm:px-6 md:grid-cols-[minmax(0,1fr)_74mm]">
            <div className="min-w-0 space-y-3 text-sm text-slate-700">
              <p className="font-bold text-[#123B63]">เงื่อนไข / Terms</p>
              <p>
                การชำระเงิน / Payment Terms: {PAYMENT_TERM_LABELS[paymentTerms]}
              </p>
              <p>
                สถานะชำระเงิน / Payment Status:{" "}
                {PAYMENT_STATUS_LABELS[paymentStatus]}
              </p>
              <p>
                สถานะใบเสนอราคา / Quote Status:{" "}
                {QUOTE_STATUS_LABELS[quote.status] || quote.status}
              </p>
              <p>หมายเหตุ / Notes: {lead?.note_from_form || "-"}</p>
              <p>อ้างอิงลูกค้า / Reference: {lead?.reference_info || "-"}</p>
              <p>
                ผู้ติดต่อ / Contact:{" "}
                {joinContact([config.businessPhone, config.businessEmail])}
              </p>
            </div>

            <div className="space-y-3 rounded-xl bg-slate-50 p-4 text-sm">
              <TotalRow label="ยอดรวม / Subtotal" value={quote.subtotal} />
              <TotalRow label="ส่วนลด / Discount" value={quote.discount} />
              <TotalRow label="ภาษีมูลค่าเพิ่ม 7% / VAT 7%" value={quote.vat} />
              <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-base font-black text-[#123B63]">
                <span>ยอดสุทธิ / Grand Total</span>
                <span>{formatMoney(quote.total)}</span>
              </div>
            </div>
          </section>

          <footer className="mt-auto grid gap-10 px-5 pb-6 pt-8 text-sm text-slate-600 sm:px-6 md:grid-cols-2">
            <SignatureBlock label="ผู้มีอำนาจลงนาม / Authorized Signature" />
            <SignatureBlock label="ผู้ยอมรับใบเสนอราคา / Customer Acceptance" />
          </footer>
        </div>
      </article>
    </div>
  );
}

function DocumentField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="border-b border-slate-300 pb-1 text-sm font-bold text-slate-600">
        {label}
      </p>
      <p className="break-words pt-2 text-sm text-slate-950">{value}</p>
    </div>
  );
}

function InfoBox({ title, rows }: { title: string; rows: string[] }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-5">
      <p className="mb-4 text-lg font-black text-[#123B63]">{title}</p>
      <div className="space-y-1.5 text-sm leading-6 text-slate-950">
        {rows.map((row, index) => (
          <p key={`${title}-${index}`} className="break-words">
            {row}
          </p>
        ))}
      </div>
    </div>
  );
}

function TotalRow({
  label,
  value,
}: {
  label: string;
  value: number | string | null | undefined;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-3 text-slate-700">
      <span className="min-w-0 break-words">{label}</span>
      <span className="shrink-0 font-semibold text-slate-950">{formatMoney(value)}</span>
    </div>
  );
}

function MobileMetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-slate-500">{label}</span>
      <span className="shrink-0 font-semibold text-slate-950">{value}</span>
    </div>
  );
}

function SignatureBlock({ label }: { label: string }) {
  return (
    <div>
      <div className="mb-2 border-t border-slate-300 pt-2">{label}</div>
      <div className="grid grid-cols-2 gap-4 text-xs text-slate-400">
        <span>ลงชื่อ / Signature</span>
        <span>วันที่ / Date</span>
      </div>
    </div>
  );
}
