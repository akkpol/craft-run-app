"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ALLOWED_JOB_TRANSITIONS } from "@/lib/workflow-transitions";
import { JOB_STATUS_LABELS, type JobStatus } from "@/lib/types";

type FactoryJobStatusActionsProps = {
  jobId: string;
  currentStatus: JobStatus;
};

export default function FactoryJobStatusActions({
  jobId,
  currentStatus,
}: FactoryJobStatusActionsProps) {
  const router = useRouter();
  const [loadingStatus, setLoadingStatus] = useState<JobStatus | null>(null);
  const nextStatuses = ALLOWED_JOB_TRANSITIONS[currentStatus] || [];

  async function updateStatus(nextStatus: JobStatus) {
    setLoadingStatus(nextStatus);

    try {
      const response = await fetch(`/api/jobs/${jobId}/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: nextStatus,
          note: "Updated from factory display",
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        alert(payload.error || "Failed to update job status");
        return;
      }

      router.refresh();
    } catch {
      alert("Failed to update job status");
    } finally {
      setLoadingStatus(null);
    }
  }

  if (nextStatuses.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-700/70 bg-slate-900/70 px-4 py-3 text-sm text-slate-300">
        No downstream transition from {JOB_STATUS_LABELS[currentStatus]}.
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {nextStatuses.map((nextStatus) => (
        <Button
          key={nextStatus}
          type="button"
          variant={nextStatus === "CANCELLED" ? "destructive" : "secondary"}
          size="sm"
          disabled={Boolean(loadingStatus)}
          className="h-10 rounded-2xl border border-slate-600/80 bg-white/10 px-4 text-sm text-white hover:bg-white/15"
          onClick={() => updateStatus(nextStatus)}
        >
          {loadingStatus === nextStatus
            ? "Updating..."
            : JOB_STATUS_LABELS[nextStatus]}
        </Button>
      ))}
    </div>
  );
}
