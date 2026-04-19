"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  leadId: string;
  prompt: string;
  status: string;
};

export default function LeadAiPreviewActions({ leadId, prompt, status }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  if (!prompt) {
    return null;
  }

  async function generatePreview() {
    setLoading(true);
    try {
      const response = await fetch(`/api/leads/${leadId}/ai-preview`, {
        method: "POST",
      });
      const payload = await response.json();

      if (!response.ok) {
        alert(payload.error || "Failed to generate AI preview");
        return;
      }

      router.refresh();
    } catch {
      alert("Failed to generate AI preview");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      disabled={loading || status === "pending"}
      onClick={generatePreview}
      className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-slate-700 transition hover:border-slate-400 disabled:opacity-50"
    >
      {loading || status === "pending" ? "กำลังสร้างภาพ..." : "สร้างภาพ AI"}
    </button>
  );
}