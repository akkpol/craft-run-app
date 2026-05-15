"use client";

import { useCallback, useEffect, useState } from "react";

type SlipQuote = {
  total: number;
  payment_terms: string;
  payment_status: string;
  customer: string | null;
} | null;

type SlipRow = {
  id: string;
  quoteId: string;
  paymentId: string | null;
  uploader: "customer" | "admin";
  status: "pending" | "matched" | "rejected";
  mimeType: string;
  sizeBytes: number;
  note: string | null;
  createdAt: string;
  matchedAt: string | null;
  matchedByEmail: string | null;
  rejectedAt: string | null;
  rejectedReason: string | null;
  signedUrl: string | null;
  quote: SlipQuote;
};

export function PaymentSlipQueue() {
  const [slips, setSlips] = useState<SlipRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [paymentIdDraft, setPaymentIdDraft] = useState("");
  const [rejectReasonDraft, setRejectReasonDraft] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/payment-slips?status=pending", {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to load slips");
      }
      setSlips(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load slips");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function matchSlip(slipId: string) {
    if (!paymentIdDraft.trim()) {
      setError("ใส่ payment id");
      return;
    }
    setBusyId(slipId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/payment-slips/${slipId}/match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId: paymentIdDraft.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Match failed");
      }
      setOpen(null);
      setPaymentIdDraft("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Match failed");
    } finally {
      setBusyId(null);
    }
  }

  async function rejectSlip(slipId: string) {
    if (!rejectReasonDraft.trim()) {
      setError("ระบุเหตุผลที่ปฏิเสธ");
      return;
    }
    setBusyId(slipId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/payment-slips/${slipId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReasonDraft.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Reject failed");
      }
      setOpen(null);
      setRejectReasonDraft("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reject failed");
    } finally {
      setBusyId(null);
    }
  }

  if (loading && !slips) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
        กำลังโหลดสลิป...
      </div>
    );
  }

  if (!slips || slips.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-3 text-sm text-slate-500">
        ไม่มีสลิปรอตรวจ
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error ? (
        <div className="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {error}
        </div>
      ) : null}
      {slips.map((slip) => {
        const isOpen = open === slip.id;
        return (
          <article
            key={slip.id}
            className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-amber-950">
                  {slip.quote?.customer ?? "ลูกค้าไม่ระบุ"}
                </p>
                <p className="mt-0.5 text-xs text-amber-900/70">
                  ยอดใบ {slip.quote ? slip.quote.total.toLocaleString() : "-"} ·
                  {" "}
                  {slip.quote?.payment_terms ?? "-"} ·
                  {" "}
                  {slip.quote?.payment_status ?? "-"} ·
                  {" "}
                  อัปโหลดเมื่อ {new Date(slip.createdAt).toLocaleString("th-TH")}
                </p>
                {slip.note ? (
                  <p className="mt-1 text-xs text-amber-900/80">
                    📝 {slip.note}
                  </p>
                ) : null}
                <p className="mt-1 font-mono text-[11px] text-amber-900/60">
                  quote: {slip.quoteId}
                </p>
              </div>
              <div className="flex gap-2">
                {slip.signedUrl ? (
                  <a
                    href={slip.signedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-50"
                  >
                    เปิดสลิป
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : slip.id)}
                  className="rounded-full bg-amber-900 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-950"
                >
                  {isOpen ? "ปิด" : "ตรวจสอบ"}
                </button>
              </div>
            </div>

            {isOpen ? (
              <div className="mt-3 space-y-3 rounded-xl bg-white px-3 py-3 ring-1 ring-amber-200">
                {slip.signedUrl ? (
                  slip.mimeType?.includes("pdf") ? (
                    <a
                      href={slip.signedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-xs text-sky-700 underline"
                    >
                      เปิด PDF ในแท็บใหม่
                    </a>
                  ) : (
                    <img
                      src={slip.signedUrl}
                      alt="payment slip"
                      className="max-h-96 w-auto rounded-lg border border-slate-200"
                    />
                  )
                ) : null}

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-800">Match กับ payment</p>
                  <input
                    type="text"
                    value={paymentIdDraft}
                    onChange={(e) => setPaymentIdDraft(e.target.value)}
                    placeholder="payment id (UUID)"
                    className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => void matchSlip(slip.id)}
                    disabled={busyId === slip.id}
                    className="rounded-full bg-emerald-700 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-40"
                  >
                    {busyId === slip.id ? "..." : "Match"}
                  </button>
                </div>

                <div className="space-y-2 border-t border-slate-100 pt-2">
                  <p className="text-xs font-semibold text-slate-800">หรือปฏิเสธ</p>
                  <input
                    type="text"
                    value={rejectReasonDraft}
                    onChange={(e) => setRejectReasonDraft(e.target.value)}
                    placeholder="เหตุผล (เช่น ยอดไม่ตรง / สลิปไม่ชัด)"
                    className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => void rejectSlip(slip.id)}
                    disabled={busyId === slip.id}
                    className="rounded-full bg-rose-700 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-800 disabled:opacity-40"
                  >
                    {busyId === slip.id ? "..." : "Reject"}
                  </button>
                </div>
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
