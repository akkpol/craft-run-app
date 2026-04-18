"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  PAYMENT_STATUS_LABELS,
  PAYMENT_TERM_LABELS,
  PAYMENT_TERMS,
  type PaymentTerm,
} from "@/lib/types";

type Props = {
  quoteId: string;
  publicToken: string;
  quoteStatus: string;
  paymentTerms: PaymentTerm;
  paymentStatus: keyof typeof PAYMENT_STATUS_LABELS;
  hasJob: boolean;
};

export default function AdminQuoteActions({
  quoteId,
  publicToken,
  quoteStatus,
  paymentTerms,
  paymentStatus,
  hasJob,
}: Props) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function callApi(url: string, body: unknown, errorLabel: string) {
    setLoading(true);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || errorLabel);
        return;
      }
      router.refresh();
    } catch {
      alert(errorLabel);
    } finally {
      setLoading(false);
    }
  }

  async function updateCommercial(payload: {
    paymentTerms?: PaymentTerm;
    paymentStatus?: Props["paymentStatus"];
  }) {
    await callApi(`/api/quotes/${quoteId}/commercial`, payload, "Failed to update commercial terms");
  }

  async function submitQuoteAction(action: "reject_quote" | "rescope_quote") {
    const note =
      action === "rescope_quote"
        ? window.prompt("ระบุเหตุผลหรือรายละเอียดที่ต้องแก้", "ลูกค้าขอปรับรายละเอียดและออกใบเสนอราคาใหม่")
        : window.prompt("ระบุเหตุผลที่ปฏิเสธใบเสนอราคา", "ลูกค้าปฏิเสธใบเสนอราคา");

    if (note === null) {
      return;
    }

    await callApi(`/api/quotes/public/${publicToken}`, { action, note }, "Failed to update quote");
  }

  const canEditTerms = !hasJob && (quoteStatus === "sent" || quoteStatus === "approved");
  const canCapturePayment = !hasJob && quoteStatus === "approved" && paymentTerms !== "credit";
  const canRejectQuote = !hasJob && quoteStatus === "sent";
  const canRescopeQuote = !hasJob && (quoteStatus === "sent" || quoteStatus === "approved");

  return (
    <div className="mt-2 flex flex-col items-end gap-2">
      {canEditTerms && (
        <select
          disabled={loading}
          value={paymentTerms}
          onChange={(e) => updateCommercial({ paymentTerms: e.target.value as PaymentTerm })}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white"
        >
          {PAYMENT_TERMS.map((term) => (
            <option key={term} value={term}>
              {PAYMENT_TERM_LABELS[term]}
            </option>
          ))}
        </select>
      )}

      <span className="text-[11px] text-gray-500">
        {PAYMENT_STATUS_LABELS[paymentStatus]}
      </span>

      {canCapturePayment && (
        <div className="flex gap-2">
          {paymentTerms === "deposit" && paymentStatus === "unpaid" && (
            <button
              type="button"
              disabled={loading}
              onClick={() => updateCommercial({ paymentStatus: "partial" })}
              className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-amber-700"
            >
              รับมัดจำ
            </button>
          )}
          {paymentStatus !== "paid" && (
            <button
              type="button"
              disabled={loading}
              onClick={() => updateCommercial({ paymentStatus: "paid" })}
              className="rounded-lg bg-[#1a1a2e] px-2 py-1 text-xs text-white"
            >
              บันทึกรับชำระ
            </button>
          )}
        </div>
      )}

      {(canRejectQuote || canRescopeQuote) && (
        <div className="flex gap-2">
          {canRescopeQuote && (
            <button
              type="button"
              disabled={loading}
              onClick={() => submitQuoteAction("rescope_quote")}
              className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-slate-700"
            >
              ขอ re-scope
            </button>
          )}
          {canRejectQuote && (
            <button
              type="button"
              disabled={loading}
              onClick={() => submitQuoteAction("reject_quote")}
              className="rounded-lg border border-rose-200 px-2 py-1 text-xs text-rose-700"
            >
              ปฏิเสธ quote
            </button>
          )}
        </div>
      )}
    </div>
  );
}