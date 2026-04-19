"use client";

import Link from "next/link";

export default function PrintToolbar({ quoteUrl }: { quoteUrl: string }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-3 print:hidden">
      <Link
        href={quoteUrl}
        className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-950"
      >
        กลับไปหน้าใบเสนอราคา
      </Link>
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-full bg-[#1a1a2e] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#16213e]"
      >
        ดาวน์โหลด / พิมพ์ PDF
      </button>
    </div>
  );
}