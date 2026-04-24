"use client";

import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PrintToolbar({ quoteUrl }: { quoteUrl: string }) {
  return (
    <div className="flex w-full flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end print:hidden">
      <Button asChild variant="outline" className="w-full sm:w-auto">
        <Link href={quoteUrl}>
          <ArrowLeft className="size-4" />
          กลับไปหน้าใบเสนอราคา
        </Link>
      </Button>
      <Button type="button" onClick={() => window.print()} className="w-full sm:w-auto">
        <Download className="size-4" />
        ดาวน์โหลด / พิมพ์ PDF
      </Button>
    </div>
  );
}