"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

type CopyTrackingCodeButtonProps = {
  token: string;
};

export default function CopyTrackingCodeButton({
  token,
}: CopyTrackingCodeButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => {
        void handleCopy();
      }}
      className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
      title={copied ? "คัดลอกแล้ว" : "คัดลอกเลขติดตามงาน"}
      aria-label={copied ? "คัดลอกเลขติดตามงานแล้ว" : "คัดลอกเลขติดตามงาน"}
    >
      {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
      {copied ? "คัดลอกแล้ว" : "คัดลอก"}
    </button>
  );
}