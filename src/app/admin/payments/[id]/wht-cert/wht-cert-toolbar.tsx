"use client";

import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function WhtCertificateToolbar() {
  return (
    <div className="flex w-full flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end print:hidden">
      <Button asChild variant="outline" className="w-full sm:w-auto">
        <Link href="/admin/accounting">
          <ArrowLeft className="size-4" />
          กลับไป Accounting
        </Link>
      </Button>
      <Button
        type="button"
        onClick={() => window.print()}
        className="w-full sm:w-auto"
      >
        <Download className="size-4" />
        ดาวน์โหลด / พิมพ์ 50 ทวิ
      </Button>
    </div>
  );
}
