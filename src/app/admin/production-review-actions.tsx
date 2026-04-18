"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ReviewAction = "approve" | "reject" | "send";

export default function ProductionReviewActions({
  eventId,
  reviewStatus,
}: {
  eventId: string;
  reviewStatus: "pending" | "approved" | "rejected" | "sent";
}) {
  const [loading, setLoading] = useState<ReviewAction | "">("");
  const router = useRouter();

  async function submitAction(action: ReviewAction) {
    setLoading(action);
    try {
      const response = await fetch(`/api/admin/production-events/${eventId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewNote: "" }),
      });
      const payload = await response.json();

      if (!response.ok) {
        alert(payload.error || "Action failed");
        return;
      }

      router.refresh();
    } catch {
      alert("Action failed");
    } finally {
      setLoading("");
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {reviewStatus === "pending" ? (
        <button
          type="button"
          disabled={Boolean(loading)}
          onClick={() => submitAction("approve")}
          className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
        >
          {loading === "approve" ? "กำลังอนุมัติ..." : "อนุมัติ"}
        </button>
      ) : null}
      <button
        type="button"
        disabled={Boolean(loading)}
        onClick={() => submitAction("reject")}
        className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-medium text-rose-700 disabled:opacity-50"
      >
        {loading === "reject" ? "กำลังตีกลับ..." : "ตีกลับ"}
      </button>
      <button
        type="button"
        disabled={Boolean(loading)}
        onClick={() => submitAction("send")}
        className="rounded-lg border border-sky-200 px-3 py-2 text-xs font-medium text-sky-700 disabled:opacity-50"
      >
        {loading === "send" ? "กำลังส่ง..." : "ส่งให้ลูกค้า"}
      </button>
    </div>
  );
}
