import Image from "next/image";
import { notFound } from "next/navigation";
import { getRuntimeAppConfig } from "@/lib/app-settings";
import { formatBangkokDate } from "@/lib/bangkok-date-time";
import { resolveProductCatalogLabel } from "@/lib/product-catalog";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  BILLING_BRANCH_TYPE_LABELS,
  DOCUMENT_REQUEST_TYPE_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_TERM_LABELS,
  type BillingBranchType,
  type DocumentRequestType,
  type PaymentStatus,
  type PaymentTerm,
} from "@/lib/types";
import { getPaymentDisplayState } from "@/lib/payment-display";
import { resolvePaymentProfileFromConfig } from "@/lib/payment-routing";
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

const THAI_MONEY_FORMATTER = new Intl.NumberFormat("th-TH-u-nu-latn", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const THAI_DIMENSION_FORMATTER = new Intl.NumberFormat("th-TH-u-nu-latn", {
  maximumFractionDigits: 1,
});

function formatDate(value: string | null | undefined) {
  return formatBangkokDate(value);
}

function formatMoney(value: number | string | null | undefined) {
  return THAI_MONEY_FORMATTER.format(Number(value || 0));
}

function formatDimension(widthMm?: number | null, heightMm?: number | null) {
  if (!widthMm || !heightMm) {
    return "-";
  }

  return `${THAI_DIMENSION_FORMATTER.format(widthMm / 10)} x ${THAI_DIMENSION_FORMATTER.format(heightMm / 10)} ซม.`;
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
  const productLabel = resolveProductCatalogLabel({
    productType: lead?.product_type,
    productLabelSnapshot: lead?.product_label_snapshot,
  });
  const requestedDocumentType =
    (lead?.requested_document_type as DocumentRequestType | undefined) || "quote";
  const paymentTerms = quote.payment_terms as PaymentTerm;
  const paymentStatus = quote.payment_status as PaymentStatus;
  const quoteNumber = `QT-${token.slice(0, 8).toUpperCase()}`;
  const quoteUrl = `/quote/${token}`;
  const summary = `${productLabel} / ${formatDimension(
    lead?.width_mm,
    lead?.height_mm
  )} / ${lead?.qty || 0} ชิ้น`;
  const displayRows = items.length > 0 ? items : [null];
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
        ? "ระบบเลือกบัญชีรองอัตโนมัติตามยอดใบเสนอราคา"
        : paymentRouting.reason === "secondary_payment_terms"
          ? "ระบบเลือกบัญชีรองอัตโนมัติตามประเภทการจ่ายจาก intake"
          : paymentRouting.reason === "secondary_customer_scope"
            ? "ระบบเลือกบัญชีรองอัตโนมัติตามประเภทลูกค้า"
            : "ระบบสลับไปใช้บัญชีรองอัตโนมัติเพราะบัญชีหลักไม่ครบ"
      : null;
  const paymentContact = joinContact([
    config.businessPhone ? `โทรศัพท์ / Phone: ${config.businessPhone}` : null,
    config.businessEmail ? `อีเมล / Email: ${config.businessEmail}` : null,
  ]);
  const paymentConfirmationText =
    paymentTerms === "credit"
      ? "เครดิตเทอมหรือรอบวางบิลจะมีทีมงานยืนยันให้ต่อใน LINE แชตนี้"
      : "แจ้งชำระเงิน / Payment Confirmation: หลังโอนแล้วส่งสลิปกลับมาใน LINE แชตนี้เพื่อให้ทีมงานยืนยันยอดได้เร็วขึ้น";
  const billingName =
    lead?.billing_name || customer?.display_name || "ไม่ระบุชื่อลูกค้า";
  const billingAddress = lead?.billing_address || "-";
  const billingBranchType =
    (lead?.billing_branch_type as BillingBranchType | undefined) || null;
  const billingBranchCode = lead?.billing_branch_code || null;
  const billingBranchLabel = billingBranchType
    ? billingBranchType === "branch"
      ? `${BILLING_BRANCH_TYPE_LABELS.branch}${billingBranchCode ? ` (${billingBranchCode})` : ""}`
      : BILLING_BRANCH_TYPE_LABELS[billingBranchType]
    : null;
  const requestedDocumentLabel =
    DOCUMENT_REQUEST_TYPE_LABELS[requestedDocumentType] || requestedDocumentType;

  return (
    <div className="min-h-screen bg-[#eef3f8] px-3 py-4 text-slate-950 sm:px-4 sm:py-6 print:bg-white print:p-0">
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

      <article className="mx-auto min-h-0 w-full max-w-[210mm] rounded-[26px] bg-white px-3 py-3 shadow-[0_24px_90px_rgba(15,23,42,0.16)] sm:min-h-[297mm] sm:px-6 sm:py-6 md:px-[14mm] md:py-[14mm] print:min-h-0 print:max-w-none print:rounded-none print:px-0 print:py-0 print:shadow-none">
        <div className="flex min-h-0 flex-col overflow-hidden rounded-[20px] border border-slate-200 sm:min-h-[269mm] print:min-h-0 print:rounded-none print:border-slate-200">
          <header className="grid gap-5 p-4 sm:gap-8 sm:p-6 md:grid-cols-[minmax(0,1.45fr)_minmax(0,0.9fr)]">
            <div className="min-w-0">
              <h1 className="text-[2rem] leading-[0.94] font-black tracking-tight text-[#123B63] sm:text-[2.75rem] md:text-4xl">
                <span className="block">ใบเสนอราคา</span>
                <span className="block">/ Quotation</span>
              </h1>
              <p className="mt-3 wrap-break-word text-sm text-slate-600">
                เอกสารสำหรับตรวจสอบรายละเอียดราคา อนุมัติงาน และอ้างอิงก่อนเริ่มผลิต
              </p>
            </div>

            <div className="grid min-w-0 gap-4">
              <div className="flex justify-start md:justify-end">
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

          <section className="grid gap-5 px-4 pb-5 sm:gap-6 sm:px-6 sm:pb-6 md:grid-cols-2">
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
                billingName,
                `เอกสารที่ร้องขอ / Requested Document: ${requestedDocumentLabel}`,
                `ประเภทการวางบิล / Billing Entity: ${lead?.billing_entity_type === "company" ? "บริษัท / นิติบุคคล" : lead?.billing_entity_type === "person" ? "บุคคลธรรมดา" : "-"}`,
                ...(billingBranchLabel
                  ? [`สำนักงานใหญ่ / สาขา: ${billingBranchLabel}`]
                  : []),
                joinContact([
                  customer?.phone && `โทรศัพท์ / Phone: ${customer.phone}`,
                ]),
                `เลขผู้เสียภาษี / Tax ID: ${lead?.tax_id || "-"}`,
                `ที่อยู่ลูกค้า / Customer Address: ${billingAddress}`,
              ]}
            />
          </section>

          <section className="px-4 pb-5 sm:px-6 sm:pb-6">
            <DocumentField
              label="สรุปงาน / Project or Service Summary"
              value={summary}
            />
          </section>

          <section className="px-4 sm:px-6">
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
                  <p className="mt-3 wrap-break-word text-sm font-semibold text-slate-950">
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
                  <div className="min-w-0 border-r border-slate-200 px-3 py-3 wrap-break-word">
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

          <section className="grid gap-5 px-4 py-5 sm:gap-8 sm:px-6 sm:py-6 md:grid-cols-[minmax(0,1fr)_74mm]">
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

          <section className="px-4 pb-5 sm:px-6 sm:pb-6">
            <div className={`rounded-xl border p-4 sm:p-5 ${paymentTerms === "credit"
              ? "border-slate-200 bg-slate-50"
              : "border-amber-200 bg-amber-50/80"}`}>
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-white text-[#123B63] ring-1 ring-slate-200/80">
                  ฿
                </div>
                <div className="min-w-0">
                  <p className="text-base font-black text-[#123B63]">
                    ช่องทางชำระเงิน / Payment Instructions
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-700">{paymentHelpText}</p>
                  {paymentRoutingNote ? (
                    <p className="mt-2 text-xs font-semibold text-sky-700">{paymentRoutingNote}</p>
                  ) : null}
                </div>
              </div>

              {paymentTerms === "credit" ? (
                <div className="mt-4 rounded-xl bg-white px-4 py-3 text-sm leading-relaxed text-slate-700 ring-1 ring-slate-200/70">
                  รายการนี้ไม่ต้องโอนทันที กรุณาติดต่อทีมงานเพื่อยืนยันรอบวางบิลหรือเครดิตเทอม
                  {paymentContact !== "-" ? ` ที่ ${paymentContact}` : " ผ่าน LINE แชตนี้"}
                </div>
              ) : paymentDisplay.showDetails || paymentDisplay.showQr ? (
                <div className={`mt-4 grid gap-3 ${paymentDisplay.showDetails && paymentDisplay.showQr ? "sm:grid-cols-[minmax(0,1fr)_58mm]" : "sm:grid-cols-2"}`}>
                  {paymentDisplay.showDetails ? paymentDisplay.paymentDetails.map((detail) => (
                    <div key={detail.label} className="rounded-xl bg-white px-4 py-3 ring-1 ring-slate-200/70">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                        {detail.label}
                      </p>
                      <p className="mt-2 wrap-break-word text-sm font-semibold text-slate-950">
                        {detail.value}
                      </p>
                    </div>
                  )) : null}
                  {paymentDisplay.showQr ? (
                    <div className="rounded-xl bg-white px-4 py-3 ring-1 ring-slate-200/70">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
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
                <div className="mt-4 rounded-xl bg-white px-4 py-3 text-sm leading-relaxed text-slate-700 ring-1 ring-slate-200/70">
                  ยังไม่ได้ระบุบัญชีรับโอนในระบบ กรุณาติดต่อทีมงาน
                  {paymentContact !== "-" ? ` ที่ ${paymentContact}` : " ผ่าน LINE แชตนี้"}
                </div>
              )}

              <div className="mt-4 rounded-xl bg-white/80 px-4 py-3 text-xs leading-relaxed text-slate-600 ring-1 ring-slate-200/60">
                {paymentConfirmationText}
              </div>
            </div>
          </section>

          <footer className="mt-auto grid gap-6 px-4 pb-5 pt-6 text-sm text-slate-600 sm:gap-10 sm:px-6 sm:pb-6 sm:pt-8 md:grid-cols-2">
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
      <p className="border-b border-slate-300 pb-1 text-xs font-bold text-slate-600 sm:text-sm">
        {label}
      </p>
      <p className="wrap-break-word pt-1.5 text-sm text-slate-950 sm:pt-2">{value}</p>
    </div>
  );
}

function InfoBox({ title, rows }: { title: string; rows: string[] }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
      <p className="mb-3 text-base font-black text-[#123B63] sm:mb-4 sm:text-lg">{title}</p>
      <div className="space-y-1.5 text-sm leading-6 text-slate-950">
        {rows.map((row, index) => (
          <p key={`${title}-${index}`} className="wrap-break-word">
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
      <span className="min-w-0 wrap-break-word">{label}</span>
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
