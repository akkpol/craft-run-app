"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  leadId: string;
  designStatus: string;
};

export default function AdminLeadDesignActions({ leadId, designStatus }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function updateDesignStatus(
    nextStatus: "preview_sent" | "approved" | "revision_requested" | "drafting" | "not_started"
  ) {
    const defaults: Record<typeof nextStatus, string> = {
      preview_sent: "แอดมิน mark ว่าส่งแบบให้ลูกค้าตรวจแล้ว",
      approved: "แอดมิน mark ว่าลูกค้าอนุมัติแบบแล้ว",
      revision_requested: "ลูกค้าขอแก้แบบ",
      drafting: "รีเซ็ตกลับ drafting",
      not_started: "รีเซ็ตกลับ not_started",
    };
    const note = window.prompt("บันทึกหมายเหตุเพิ่มเติม (ถ้ามี)", defaults[nextStatus]);

    if (note === null) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/leads/${leadId}/design-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ designStatus: nextStatus, note }),
      });
      const payload = await response.json();

      if (!response.ok) {
        alert(payload.error || "Failed to update design status");
        return;
      }

      router.refresh();
    } catch {
      alert("Failed to update design status");
    } finally {
      setLoading(false);
    }
  }

  const isPreviewOrRevision = designStatus === "preview_sent" || designStatus === "revision_requested";
  const isApproved = designStatus === "approved";
  const isDraftingOrNotStarted = designStatus === "drafting" || designStatus === "not_started";

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {/* mark preview sent — available unless already approved */}
      <button
        type="button"
        disabled={loading || designStatus === "preview_sent"}
        onClick={() => updateDesignStatus("preview_sent")}
        className="rounded-lg border border-violet-200 px-2 py-1 text-xs text-violet-700 transition hover:border-violet-300 disabled:opacity-50"
      >
        mark preview sent
      </button>

      {/* revision requested — available when preview was sent or already approved */}
      {(isPreviewOrRevision || isApproved) && (
        <button
          type="button"
          disabled={loading || designStatus === "revision_requested"}
          onClick={() => updateDesignStatus("revision_requested")}
          className="rounded-lg border border-amber-200 px-2 py-1 text-xs text-amber-700 transition hover:border-amber-300 disabled:opacity-50"
        >
          ขอแก้แบบ
        </button>
      )}

      {/* reset to drafting — available when not already drafting/not_started */}
      {!isDraftingOrNotStarted && (
        <button
          type="button"
          disabled={loading}
          onClick={() => updateDesignStatus("drafting")}
          className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-slate-600 transition hover:border-gray-300 disabled:opacity-50"
        >
          reset → drafting
        </button>
      )}

      {/* mark approved — available unless already approved */}
      <button
        type="button"
        disabled={loading || designStatus === "approved"}
        onClick={() => updateDesignStatus("approved")}
        className="rounded-lg border border-emerald-200 px-2 py-1 text-xs text-emerald-700 transition hover:border-emerald-300 disabled:opacity-50"
      >
        mark approved
      </button>
    </div>
  );
}