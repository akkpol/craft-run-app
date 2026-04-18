"use client";

import { useState } from "react";

export default function ProductionLinkCopy({
  url,
  compact = false,
}: {
  url: string;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("คัดลอกลิงก์นี้", url);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={
        compact
          ? "rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700"
          : "rounded-full border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700"
      }
    >
      {copied ? "คัดลอกแล้ว" : "คัดลอก production link"}
    </button>
  );
}
