"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function ProductionLinkCopy({
  url,
  compact = false,
  buttonVariant = "outline",
}: {
  url: string;
  compact?: boolean;
  buttonVariant?: React.ComponentProps<typeof Button>["variant"];
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
    <Button
      type="button"
      variant={buttonVariant}
      size={compact ? "xs" : "sm"}
      onClick={handleCopy}
      className={cn(
        buttonVariant === "outline" && "border-slate-200 text-slate-700",
        buttonVariant === "secondary" && "border-slate-200 bg-slate-100/90 text-slate-800 hover:bg-slate-200/80",
        buttonVariant === "default" && "shadow-[0_12px_24px_rgba(0,94,140,0.18)] hover:shadow-[0_16px_30px_rgba(0,94,140,0.22)]",
        compact && "rounded-lg"
      )}
    >
      {copied ? "คัดลอกแล้ว" : "คัดลอกลิงก์ทีมผลิต"}
    </Button>
  );
}
