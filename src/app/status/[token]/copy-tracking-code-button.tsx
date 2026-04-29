"use client";

import { useState } from "react";

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
      className="p-1 text-gray-400 transition-colors hover:text-gray-600"
      title={copied ? "Copied" : "Copy tracking code"}
      aria-label={copied ? "Copied tracking code" : "Copy tracking code"}
    >
      {copied ? "✓" : "📋"}
    </button>
  );
}