"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { type JobStatus } from "@/lib/types";
import { ALLOWED_JOB_TRANSITIONS } from "@/lib/workflow-transitions";

export default function AdminJobActions({
  jobId,
  currentStatus,
}: {
  jobId: string;
  currentStatus: JobStatus;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const nextStatuses = ALLOWED_JOB_TRANSITIONS[currentStatus] || [];

  async function updateStatus(newStatus: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, note: `Updated by admin` }),
      });

      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to update");
      }
    } catch {
      alert("Failed to update status");
    } finally {
      setLoading(false);
    }
  }

  if (nextStatuses.length === 0) {
    return null;
  }

  return (
    <select
      disabled={loading}
      onChange={(e) => {
        if (e.target.value) updateStatus(e.target.value);
      }}
      className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white"
      defaultValue=""
    >
      <option value="" disabled>เปลี่ยนสถานะ</option>
      {nextStatuses.map((s) => (
        <option key={s} value={s}>{s}</option>
      ))}
    </select>
  );
}
