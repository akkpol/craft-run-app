"use client";

import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PrintToolbar({ quoteUrl }: { quoteUrl: string }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-3 print:hidden">
      <Button asChild variant="outline">
        <Link href={quoteUrl}>
          <ArrowLeft className="size-4" />
          กลับไปหน้าใบเสนอราคา
        </Link>
      </Button>
      <Button type="button" onClick={() => window.print()}>
        <Download className="size-4" />
        ดาวน์โหลด / พิมพ์ PDF
      </Button>
    </div>
  );
}