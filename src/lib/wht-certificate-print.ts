import { formatBangkokDate } from "./bangkok-date-time.ts";

/**
 * Thai withholding tax (50 ทวิ) certificate print model.
 *
 * The shop generates this on behalf of the customer/withholder so the
 * customer can review, sign, and stamp before the next tax filing cycle.
 * RD form 50 ทวิ has well-defined fields — we render them in a simplified
 * single-page layout that matches the official form's structure.
 *
 * Authoritative source: payments.wht_amount > 0. If no WHT was withheld,
 * the certificate is not applicable and the route should return 404.
 */
export type WhtCertificatePrintSource = {
  payment: {
    id: string;
    amount: number;
    wht_amount: number;
    paid_at: string | null;
    currency?: string | null;
  };
  receiver_entity: {
    legal_name: string;
    type?: string | null;
    tax_id?: string | null;
    address?: string | null;
    branch_type?: string | null;
    branch_code?: string | null;
    branch_name?: string | null;
  };
  withholder: {
    billing_name?: string | null;
    tax_id?: string | null;
    billing_address?: string | null;
    billing_entity_type?: string | null;
    customer_display_name?: string | null;
  };
  quote: {
    id: string;
    wht_rate?: number | null;
  };
};

export type WhtCertificatePrintModel = {
  certNumber: string;
  issuedDate: string;
  paymentDate: string;
  withholder: {
    name: string;
    taxId: string;
    address: string;
    formType: "ภ.ง.ด.3" | "ภ.ง.ด.53";
    formTypeLabel: string;
  };
  payee: {
    name: string;
    taxId: string;
    address: string;
  };
  income: {
    sectionLabel: string;
    paidAt: string;
    grossAmount: string;
    whtAmount: string;
    whtRateLabel: string;
  };
  meta: {
    paymentId: string;
    quoteId: string;
  };
};

const MONEY_FORMATTER = new Intl.NumberFormat("th-TH-u-nu-latn", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function moneyText(value: number): string {
  return MONEY_FORMATTER.format(Number.isFinite(value) ? value : 0);
}

function safeText(value: string | null | undefined, fallback = "-"): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function ratePercentLabel(rate: number | null | undefined): string {
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
    return "-";
  }
  // Rate is stored as a fraction (e.g. 0.03 = 3%)
  const pct = rate <= 1 ? rate * 100 : rate;
  if (Number.isInteger(pct)) return `${pct}%`;
  return `${pct.toFixed(2)}%`;
}

/**
 * The payee's legal form drives the RD form code:
 *   - บุคคลธรรมดา (person) files ภ.ง.ด.3
 *   - นิติบุคคล (company) files ภ.ง.ด.53
 *
 * If the receiver type is missing we default to ภ.ง.ด.53 because commercial
 * receivers are companies unless explicitly configured as personal accounts.
 */
function pickFormType(entityType: string | null | undefined): {
  formType: "ภ.ง.ด.3" | "ภ.ง.ด.53";
  formTypeLabel: string;
} {
  if (entityType === "person") {
    return { formType: "ภ.ง.ด.3", formTypeLabel: "ภ.ง.ด.3 (บุคคลธรรมดา)" };
  }
  return { formType: "ภ.ง.ด.53", formTypeLabel: "ภ.ง.ด.53 (นิติบุคคล)" };
}

function buildBranchSuffix(
  branchType?: string | null,
  branchCode?: string | null,
  branchName?: string | null
): string {
  if (!branchType) return "";
  if (branchType === "head_office" || branchType === "HEAD_OFFICE") {
    return " (สำนักงานใหญ่)";
  }
  const code = (branchCode || "").trim();
  const name = (branchName || "").trim();
  if (code && name) return ` (สาขา ${code} ${name})`;
  if (code) return ` (สาขา ${code})`;
  if (name) return ` (สาขา ${name})`;
  return " (สาขา)";
}

/**
 * Certificate numbering: WHT-<paymentId-first-8>-<yyyymmdd>. Stable
 * derivation so re-printing produces the same number without needing a
 * persisted column. If we ever need legally-binding sequential numbers,
 * graduate this to a separate table with a serial.
 */
function buildCertNumber(paymentId: string, paidAt: string | null): string {
  const idShort = paymentId.replace(/-/g, "").slice(0, 8).toUpperCase();
  const date = paidAt ? new Date(paidAt) : new Date();
  const yyyymmdd =
    date.getUTCFullYear().toString() +
    String(date.getUTCMonth() + 1).padStart(2, "0") +
    String(date.getUTCDate()).padStart(2, "0");
  return `WHT-${idShort}-${yyyymmdd}`;
}

export function buildWhtCertificatePrintModel(
  source: WhtCertificatePrintSource
): WhtCertificatePrintModel | null {
  const whtAmount = Number(source.payment.wht_amount ?? 0);
  if (!Number.isFinite(whtAmount) || whtAmount <= 0) {
    // No WHT was withheld — certificate is not applicable.
    return null;
  }

  const grossAmount = Number(source.payment.amount ?? 0) + whtAmount;
  const branchSuffix = buildBranchSuffix(
    source.receiver_entity.branch_type,
    source.receiver_entity.branch_code,
    source.receiver_entity.branch_name
  );
  const { formType, formTypeLabel } = pickFormType(
    source.receiver_entity.type
  );

  const withholderName =
    safeText(source.withholder.billing_name, "") ||
    safeText(source.withholder.customer_display_name, "-");

  return {
    certNumber: buildCertNumber(
      source.payment.id,
      source.payment.paid_at ?? null
    ),
    issuedDate: formatBangkokDate(new Date().toISOString()),
    paymentDate: source.payment.paid_at
      ? formatBangkokDate(source.payment.paid_at)
      : "-",
    withholder: {
      name: withholderName,
      taxId: safeText(source.withholder.tax_id),
      address: safeText(source.withholder.billing_address),
      formType,
      formTypeLabel,
    },
    payee: {
      name: safeText(source.receiver_entity.legal_name, "") + branchSuffix,
      taxId: safeText(source.receiver_entity.tax_id),
      address: safeText(source.receiver_entity.address),
    },
    income: {
      sectionLabel:
        "มาตรา 40(2) ค่าจ้าง / บริการ / ค่าธรรมเนียม (Section 40(2) — service fees)",
      paidAt: source.payment.paid_at
        ? formatBangkokDate(source.payment.paid_at)
        : "-",
      grossAmount: moneyText(grossAmount),
      whtAmount: moneyText(whtAmount),
      whtRateLabel: ratePercentLabel(source.quote.wht_rate ?? null),
    },
    meta: {
      paymentId: source.payment.id,
      quoteId: source.quote.id,
    },
  };
}
