/**
 * Tax-filing ledger CSV — payment + commercial_document centric.
 *
 * Complements the existing quote-centric monthly export by giving
 * accounting a row per issued tax document (RECEIPT, TAX_INVOICE_RECEIPT)
 * with all fields needed for ภ.พ.30 (VAT) and ภ.ง.ด.53 (WHT) filing.
 *
 * One row per `commercial_documents.id` where `status='ISSUED'` and
 * `issued_at` falls inside the requested month. Withholder identity
 * follows the same precedence as 50 ทวิ (L30): locked
 * customer_tax_profile > lead.billing_*.
 */

export type TaxLedgerRowSource = {
  documentId: string;
  documentNumber: string;
  documentType: string;
  status: string;
  issuedAt: string | null;
  lockedAt: string | null;
  subtotal: number;
  discountAmount: number;
  vatRate: number | null;
  vatAmount: number;
  grandTotal: number;
  issuer: {
    legalName: string;
    taxId: string | null;
    branchType: string | null;
    branchCode: string | null;
    branchName: string | null;
    type: string | null;
  } | null;
  customer: {
    displayName: string | null;
  } | null;
  withholder: {
    name: string | null;
    taxId: string | null;
    branchType: string | null;
    branchCode: string | null;
    address: string | null;
    entityType: string | null;
  };
  payment: {
    id: string | null;
    amount: number;
    whtAmount: number;
    paidAt: string | null;
  } | null;
  quote: {
    id: string;
    publicToken: string | null;
    paymentTerms: string | null;
  };
};

const TAX_LEDGER_HEADERS = [
  "document_number",
  "document_type",
  "status",
  "issued_at",
  "locked_at",
  "issuer_name",
  "issuer_tax_id",
  "issuer_branch",
  "customer_name",
  "withholder_name",
  "withholder_tax_id",
  "withholder_branch",
  "withholder_address",
  "withholder_entity_type",
  "subtotal",
  "discount_amount",
  "vat_rate",
  "vat_amount",
  "grand_total",
  "payment_id",
  "payment_cash_amount",
  "payment_wht_amount",
  "payment_gross_amount",
  "payment_paid_at",
  "quote_id",
  "quote_public_token",
  "quote_payment_terms",
];

function csvCell(value: unknown): string {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function joinBranch(
  branchType: string | null,
  branchCode: string | null,
  branchName: string | null
): string {
  if (!branchType) return "";
  if (branchType === "head_office" || branchType === "HEAD_OFFICE") {
    return "สำนักงานใหญ่";
  }
  const code = (branchCode || "").trim();
  const name = (branchName || "").trim();
  if (code && name) return `สาขา ${code} ${name}`;
  if (code) return `สาขา ${code}`;
  if (name) return `สาขา ${name}`;
  return "สาขา";
}

export function buildTaxLedgerCsv(rows: TaxLedgerRowSource[]): string {
  const lines: string[] = [TAX_LEDGER_HEADERS.join(",")];

  for (const row of rows) {
    const issuer = row.issuer;
    const issuerBranch = issuer
      ? joinBranch(issuer.branchType, issuer.branchCode, issuer.branchName)
      : "";
    const withholderBranch = joinBranch(
      row.withholder.branchType,
      row.withholder.branchCode,
      null
    );
    const grossAmount = row.payment
      ? row.payment.amount + row.payment.whtAmount
      : null;

    const fields = [
      row.documentNumber,
      row.documentType,
      row.status,
      row.issuedAt ?? "",
      row.lockedAt ?? "",
      issuer?.legalName ?? "",
      issuer?.taxId ?? "",
      issuerBranch,
      row.customer?.displayName ?? "",
      row.withholder.name ?? "",
      row.withholder.taxId ?? "",
      withholderBranch,
      row.withholder.address ?? "",
      row.withholder.entityType ?? "",
      row.subtotal,
      row.discountAmount,
      row.vatRate ?? "",
      row.vatAmount,
      row.grandTotal,
      row.payment?.id ?? "",
      row.payment?.amount ?? "",
      row.payment?.whtAmount ?? "",
      grossAmount ?? "",
      row.payment?.paidAt ?? "",
      row.quote.id,
      row.quote.publicToken ?? "",
      row.quote.paymentTerms ?? "",
    ];

    lines.push(fields.map(csvCell).join(","));
  }

  // UTF-8 BOM so Excel opens the file with Thai characters preserved.
  return `\uFEFF${lines.join("\n")}`;
}
