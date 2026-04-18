"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  quoteToken: string;
  allowApprove?: boolean;
  allowReject?: boolean;
  allowRescope?: boolean;
};

export default function QuoteApproveButton({
  quoteToken,
  allowApprove = true,
  allowReject = false,
  allowRescope = false,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [successState, setSuccessState] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [requiresPayment, setRequiresPayment] = useState(false);
  const router = useRouter();

  async function handleAction(action: "approve_quote" | "reject_quote" | "rescope_quote") {
    if (
      action === "approve_quote" &&
      !confirm("ยืนยันอนุมัติใบเสนอราคานี้?")
    ) {
      return;
    }

    const note =
      action === "rescope_quote"
        ? window.prompt("บอกทีมงานว่าต้องการแก้ส่วนไหน", "ต้องการปรับรายละเอียดก่อนออกใบเสนอราคาใหม่")
        : action === "reject_quote"
          ? window.prompt("ระบุเหตุผลที่ไม่รับใบเสนอราคานี้", "ยังไม่สะดวกดำเนินงานตามใบเสนอราคานี้")
          : undefined;

    if (note === null) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/quotes/public/${quoteToken}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "เกิดข้อผิดพลาด");
        return;
      }

      setSuccessMessage(data.message || "ดำเนินการเรียบร้อย");
      setRequiresPayment(Boolean(data.requiresPayment));
      setSuccessState(action);
      router.refresh();
    } catch {
      setError("ไม่สามารถดำเนินการได้ กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  }

  if (successState) {
    return (
      <div className={`text-center font-medium ${requiresPayment ? "text-amber-600" : "text-green-600"}`}>
        {requiresPayment ? "⏳" : successState === "reject_quote" ? "🛑" : "✅"} {successMessage}
      </div>
    );
  }

  return (
    <div>
      {error && <p className="text-red-500 text-sm text-center mb-3">{error}</p>}
      <div className="space-y-2">
        {allowApprove && (
          <button
            onClick={() => handleAction("approve_quote")}
            disabled={loading}
            className="w-full rounded-lg bg-[#1a1a2e] py-3 font-medium text-white transition-colors hover:bg-[#16213e] disabled:opacity-50"
          >
            {loading ? "กำลังดำเนินการ..." : "✅ อนุมัติใบเสนอราคา"}
          </button>
        )}

        {(allowRescope || allowReject) && (
          <div className="grid gap-2 sm:grid-cols-2">
            {allowRescope && (
              <button
                onClick={() => handleAction("rescope_quote")}
                disabled={loading}
                className="w-full rounded-lg border border-slate-300 bg-white py-3 font-medium text-slate-700 transition hover:border-slate-400 disabled:opacity-50"
              >
                ขอปรับรายละเอียด
              </button>
            )}
            {allowReject && (
              <button
                onClick={() => handleAction("reject_quote")}
                disabled={loading}
                className="w-full rounded-lg border border-rose-200 bg-rose-50 py-3 font-medium text-rose-700 transition hover:border-rose-300 disabled:opacity-50"
              >
                ปฏิเสธใบเสนอราคา
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
