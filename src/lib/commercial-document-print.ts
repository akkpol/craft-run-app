import { formatBangkokDate } from "./bangkok-date-time.ts";

type JsonRecord = Record<string, unknown>;

export type CommercialDocumentPrintSource = {
  id: string;
  status: string | null;
  snapshot_json: unknown;
};

export type CommercialDocumentPrintModel = {
  id: string;
  status: string;
  documentType: string;
  titleTh: string;
  titleEn: string;
  documentNumber: string;
  issuedDate: string;
  paymentDate: string;
  lockedDate: string;
  issuerRows: string[];
  customerRows: string[];
  paymentRows: string[];
  totals: {
    subtotal: string;
    discount: string;
    vatMode: string;
    vatRate: string;
    vatAmount: string;
    grandTotal: string;
  };
};

const MONEY_FORMATTER = new Intl.NumberFormat("th-TH-u-nu-latn", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const DOCUMENT_LABELS: Record<string, { th: string; en: string }> = {
  QUOTATION: { th: "ใบเสนอราคา", en: "Quotation" },
  BILLING_NOTE: { th: "ใบวางบิล/ใบแจ้งหนี้", en: "Billing Note" },
  INVOICE: { th: "ใบแจ้งหนี้", en: "Invoice" },
  RECEIPT: { th: "ใบเสร็จรับเงิน", en: "Receipt" },
  TAX_INVOICE: { th: "ใบกำกับภาษี", en: "Tax Invoice" },
  TAX_INVOICE_RECEIPT: { th: "ใบเสร็จรับเงิน/ใบกำกับภาษี", en: "Receipt / Tax Invoice" },
  CREDIT_NOTE: { th: "ใบลดหนี้", en: "Credit Note" },
  DEBIT_NOTE: { th: "ใบเพิ่มหนี้", en: "Debit Note" },
};

const VAT_MODE_LABELS: Record<string, string> = {
  INCLUSIVE: "รวม VAT แล้ว / VAT inclusive",
  EXCLUSIVE: "ยังไม่รวม VAT / VAT exclusive",
  NO_VAT: "ไม่มี VAT / No VAT",
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, fallback = "-") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function numberValue(value: unknown) {
  const resolved = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(resolved) ? resolved : 0;
}

function money(value: unknown) {
  return MONEY_FORMATTER.format(numberValue(value));
}

function percent(value: unknown) {
  const resolved = numberValue(value);
  return resolved > 0 ? `${MONEY_FORMATTER.format(resolved * 100)}%` : "0.00%";
}

function branchLabel(value: JsonRecord) {
  const branchType = text(value.branch_type, "");
  const branchCode = text(value.branch_code, "");
  const branchName = text(value.branch_name, "");

  if (branchType === "HEAD_OFFICE") {
    return "สำนักงานใหญ่ / Head office";
  }

  if (branchType === "BRANCH") {
    const details = [branchName, branchCode].filter(Boolean).join(" / ");
    return details ? `สาขา / Branch ${details}` : "สาขา / Branch";
  }

  return "-";
}

function compactRows(rows: string[]) {
  return rows.filter((row) => row.trim() && !row.endsWith("-"));
}

export function buildCommercialDocumentPrintModel(
  source: CommercialDocumentPrintSource
): CommercialDocumentPrintModel | null {
  if (!isRecord(source.snapshot_json)) {
    return null;
  }

  const snapshot = source.snapshot_json;
  const issuer = isRecord(snapshot.issuer) ? snapshot.issuer : {};
  const customer = isRecord(snapshot.customer) ? snapshot.customer : {};
  const taxProfile = isRecord(customer.tax_profile) ? customer.tax_profile : null;
  const payment = isRecord(snapshot.payment) ? snapshot.payment : {};
  const totals = isRecord(snapshot.totals) ? snapshot.totals : {};
  const documentType = text(snapshot.document_type, "UNKNOWN");
  const labels = DOCUMENT_LABELS[documentType] || {
    th: documentType,
    en: documentType,
  };
  const issuerRole = text(issuer.role, "");
  const titleTh =
    documentType === "RECEIPT" && issuerRole === "PERSONAL_ACCOUNT"
      ? "ใบรับเงิน"
      : labels.th;
  const customerName = taxProfile
    ? text(taxProfile.legal_name)
    : text(customer.billing_name, "ไม่ระบุชื่อลูกค้า");
  const customerAddress = taxProfile
    ? text(taxProfile.address)
    : text(customer.billing_address);
  const customerTaxId = taxProfile ? text(taxProfile.tax_id) : text(customer.tax_id);
  const customerBranch = taxProfile ? branchLabel(taxProfile) : text(customer.billing_branch_type);

  return {
    id: source.id,
    status: text(source.status, "-"),
    documentType,
    titleTh,
    titleEn: labels.en,
    documentNumber: text(snapshot.document_number),
    issuedDate: formatBangkokDate(text(snapshot.issued_at, "")),
    paymentDate: formatBangkokDate(text(payment.paid_at, "")),
    lockedDate: formatBangkokDate(text(snapshot.locked_at, "")),
    issuerRows: compactRows([
      text(issuer.legal_name, text(issuer.display_name, "ไม่ระบุผู้ออกเอกสาร")),
      `เลขประจำตัวผู้เสียภาษี / Tax ID: ${text(issuer.tax_id)}`,
      `สาขา / Branch: ${branchLabel(issuer)}`,
      `ที่อยู่ / Address: ${text(issuer.address)}`,
    ]),
    customerRows: compactRows([
      customerName,
      `เลขประจำตัวผู้เสียภาษี / Tax ID: ${customerTaxId}`,
      `สาขา / Branch: ${customerBranch}`,
      `ที่อยู่ / Address: ${customerAddress}`,
    ]),
    paymentRows: compactRows([
      `Payment ID: ${text(payment.id)}`,
      `Receiver Entity ID: ${text(payment.receiver_entity_id)}`,
      `Currency: ${text(payment.currency, "THB")}`,
      `Paid Amount: ${money(payment.amount)}`,
    ]),
    totals: {
      subtotal: money(totals.subtotal),
      discount: money(totals.discount_amount),
      vatMode: VAT_MODE_LABELS[text(totals.vat_mode, "")] || text(totals.vat_mode),
      vatRate: percent(totals.vat_rate),
      vatAmount: money(totals.vat_amount),
      grandTotal: money(totals.grand_total),
    },
  };
}