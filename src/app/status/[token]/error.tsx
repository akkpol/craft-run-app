"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

/**
 * Customer-facing error boundary for the public status page.
 *
 * Mirrors `quote/[token]/error.tsx` — turns a thrown render/data fetch
 * into a friendly Thai error UI with a Retry button instead of a blank
 * 500 screen. Only the digest is shown to the customer so logs can be
 * correlated without exposing stack traces.
 */
export default function StatusRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.error("[status-route-error]", error);
    }
  }, [error]);

  return (
    <main className="liff-shell min-h-screen bg-gradient-to-br from-amber-50 via-white to-sky-50 px-5 py-10">
      <div className="liff-panel mx-auto max-w-md rounded-3xl border border-slate-200/70 bg-white/95 p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">
          ขออภัย ระบบมีปัญหาชั่วคราว
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          ไม่สามารถโหลดสถานะงานได้ในขณะนี้ กรุณาลองอีกครั้งใน 1–2 นาที
          ถ้ายังไม่หาย แจ้งทีมงานทาง LINE ได้เลยค่ะ
        </p>
        {error.digest ? (
          <p className="mt-3 text-xs text-slate-400">รหัสอ้างอิง: {error.digest}</p>
        ) : null}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Button onClick={() => reset()} className="sm:flex-1">
            ลองอีกครั้ง
          </Button>
        </div>
      </div>
    </main>
  );
}
