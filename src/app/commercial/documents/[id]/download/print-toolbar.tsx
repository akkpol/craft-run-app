"use client";

import Link from "next/link";
import { ArrowLeft, Download, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";

type Props = {
  whtCertPaymentId?: string | null;
};

export default function CommercialDocumentPrintToolbar({
  whtCertPaymentId,
}: Props) {
  return (
    <div className="flex w-full flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end print:hidden">
      <Button asChild variant="outline" className="w-full sm:w-auto">
        <Link href="/admin/accounting">
          <ArrowLeft className="size-4" />
          กลับไป Accounting
        </Link>
      </Button>
      {whtCertPaymentId ? (
        <Button asChild variant="outline" className="w-full sm:w-auto">
          <Link href={`/admin/payments/${whtCertPaymentId}/wht-cert`}>
            <FileText className="size-4" />
            พิมพ์ 50 ทวิ
          </Link>
        </Button>
      ) : null}
      <Button type="button" onClick={() => window.print()} className="w-full sm:w-auto">
        <Download className="size-4" />
        ดาวน์โหลด / พิมพ์ PDF
      </Button>
    </div>
  );
}