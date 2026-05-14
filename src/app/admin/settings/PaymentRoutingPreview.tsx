"use client";

import { resolvePaymentProfileFromConfig } from "@/lib/payment-routing";

type RoutingPreviewConfig = {
  paymentAccountName?: string;
  paymentBankName?: string;
  paymentAccountNumber?: string;
  paymentPromptPayId?: string;
  paymentQrCodeUrl?: string;
  paymentSecondaryAccountName?: string;
  paymentSecondaryBankName?: string;
  paymentSecondaryAccountNumber?: string;
  paymentSecondaryPromptPayId?: string;
  paymentSecondaryQrCodeUrl?: string;
  paymentSecondaryMaxQuoteTotal?: number | null;
  paymentSecondaryCustomerScope?: string;
  paymentSecondaryPaymentTermsScope?: string;
};

const PREVIEW_SCENARIOS = [
  { label: "บุคคล · prepaid · ฿100", billingEntityType: "person", paymentTerms: "prepaid", total: 100 },
  { label: "บุคคล · prepaid · ฿5,000", billingEntityType: "person", paymentTerms: "prepaid", total: 5000 },
  { label: "บริษัท · deposit · ฿100", billingEntityType: "company", paymentTerms: "deposit", total: 100 },
  { label: "บริษัท · deposit · ฿5,000", billingEntityType: "company", paymentTerms: "deposit", total: 5000 },
] as const;

const REASON_LABELS: Record<string, string> = {
  default: "บัญชีหลัก (default)",
  primary_missing: "บัญชีรอง (หลักไม่มีข้อมูล)",
  secondary_total_threshold: "บัญชีรอง (ยอดต่ำกว่า threshold)",
  secondary_customer_scope: "บัญชีรอง (ตรงประเภทลูกค้า)",
  secondary_payment_terms: "บัญชีรอง (ตรง payment term)",
};

export function PaymentRoutingPreview({ config }: { config: RoutingPreviewConfig }) {
  const results = PREVIEW_SCENARIOS.map((scenario) => {
    const resolved = resolvePaymentProfileFromConfig(config, {
      total: scenario.total,
      billingEntityType: scenario.billingEntityType,
      paymentTerms: scenario.paymentTerms,
    });
    return { ...scenario, resolved };
  });

  const hasAnySecondary = results.some((r) => r.resolved.sourceProfile === "secondary");

  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Auto-routing preview (ตาม config ปัจจุบัน)
      </p>
      {!hasAnySecondary && (
        <p className="mb-3 text-xs text-slate-400">
          บัญชีรองยังไม่ถูก trigger ในทุก scenario — ตรวจสอบว่ากรอกบัญชีรองและตั้งเงื่อนไขไว้แล้ว
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="pb-2 pr-4 font-medium">Scenario</th>
              <th className="pb-2 pr-4 font-medium">บัญชีที่ใช้</th>
              <th className="pb-2 font-medium">เหตุผล</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {results.map((row) => (
              <tr key={row.label}>
                <td className="py-2 pr-4 text-slate-700">{row.label}</td>
                <td className="py-2 pr-4">
                  <span
                    className={
                      row.resolved.sourceProfile === "secondary"
                        ? "rounded-full bg-sky-100 px-2 py-0.5 font-medium text-sky-700"
                        : "rounded-full bg-slate-200 px-2 py-0.5 font-medium text-slate-600"
                    }
                  >
                    {row.resolved.sourceProfile === "secondary" ? "บัญชีรอง" : "บัญชีหลัก"}
                  </span>
                </td>
                <td className="py-2 text-slate-500">
                  {REASON_LABELS[row.resolved.reason] ?? row.resolved.reason}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
