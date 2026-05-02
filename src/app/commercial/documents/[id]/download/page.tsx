import { notFound } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { buildCommercialDocumentPrintModel } from "@/lib/commercial-document-print";
import CommercialDocumentPrintToolbar from "./print-toolbar";

export const dynamic = "force-dynamic";

type CommercialDocumentRow = {
  id: string;
  status: string | null;
  snapshot_json: unknown;
};

export default async function CommercialDocumentDownloadPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const supabase = createAdminClient();
  const { data: document } = await supabase
    .from("commercial_documents")
    .select("id, status, snapshot_json")
    .eq("id", id)
    .maybeSingle();

  if (!document) {
    notFound();
  }

  const printModel = buildCommercialDocumentPrintModel(document as CommercialDocumentRow);

  if (!printModel) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[#eef3f8] px-3 py-4 text-slate-950 sm:px-4 sm:py-6 print:bg-white print:p-0">
      <style>{`
        @page {
          size: A4;
          margin: 12mm;
        }

        @media print {
          body {
            background: white;
          }
        }
      `}</style>

      <div className="mx-auto flex w-full max-w-[210mm] justify-end pb-4">
        <CommercialDocumentPrintToolbar />
      </div>

      <article className="mx-auto w-full max-w-[210mm] rounded-[18px] bg-white px-4 py-4 shadow-[0_24px_90px_rgba(15,23,42,0.16)] sm:min-h-[297mm] sm:px-7 sm:py-7 md:px-[14mm] md:py-[14mm] print:min-h-0 print:max-w-none print:rounded-none print:px-0 print:py-0 print:shadow-none">
        <div className="flex min-h-0 flex-col overflow-hidden border border-slate-200 print:border-slate-200">
          <header className="grid gap-5 border-b border-slate-200 p-5 md:grid-cols-[minmax(0,1.35fr)_minmax(0,0.85fr)]">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                Commercial Document
              </p>
              <h1 className="mt-2 text-3xl font-black leading-tight text-[#123B63] sm:text-4xl">
                <span className="block">{printModel.titleTh}</span>
                <span className="block text-2xl sm:text-3xl">/ {printModel.titleEn}</span>
              </h1>
            </div>

            <div className="grid gap-3 text-sm">
              <DocumentField label="เลขที่เอกสาร / Document No." value={printModel.documentNumber} />
              <DocumentField label="วันที่เอกสาร / Issue Date" value={printModel.issuedDate} />
              <DocumentField label="วันที่รับเงิน / Payment Date" value={printModel.paymentDate} />
              <DocumentField label="วันที่ล็อกข้อมูล / Locked Date" value={printModel.lockedDate} />
              <DocumentField label="สถานะ / Status" value={printModel.status} />
            </div>
          </header>

          <section className="grid gap-5 p-5 md:grid-cols-2">
            <InfoBox title="ผู้ออกเอกสาร / Issuer" rows={printModel.issuerRows} />
            <InfoBox title="ลูกค้า / Customer" rows={printModel.customerRows} />
          </section>

          <section className="px-5 pb-5">
            <div className="overflow-hidden border border-slate-200">
              <div className="grid grid-cols-[12mm_minmax(0,1fr)_32mm] bg-[#123B63] text-xs font-bold text-white">
                <div className="px-3 py-3 text-right">No.</div>
                <div className="px-3 py-3">รายการ / Description</div>
                <div className="px-3 py-3 text-right">จำนวนเงิน / Amount</div>
              </div>
              <div className="grid min-h-[18mm] grid-cols-[12mm_minmax(0,1fr)_32mm] border-t border-slate-200 text-sm">
                <div className="border-r border-slate-200 px-3 py-3 text-right">1</div>
                <div className="min-w-0 border-r border-slate-200 px-3 py-3 wrap-break-word">
                  อ้างอิง payment และ quote ตาม snapshot ของเอกสาร
                </div>
                <div className="px-3 py-3 text-right font-semibold">{printModel.totals.grandTotal}</div>
              </div>
            </div>
          </section>

          <section className="grid gap-5 px-5 pb-5 md:grid-cols-[minmax(0,1fr)_74mm]">
            <InfoBox title="การชำระเงิน / Payment" rows={printModel.paymentRows} />
            <div className="space-y-3 bg-slate-50 p-4 text-sm">
              <TotalRow label="ยอดก่อนส่วนลด / Subtotal" value={printModel.totals.subtotal} />
              <TotalRow label="ส่วนลด / Discount" value={printModel.totals.discount} />
              <TotalRow label="VAT Mode" value={printModel.totals.vatMode} />
              <TotalRow label="VAT Rate" value={printModel.totals.vatRate} />
              <TotalRow label="VAT Amount" value={printModel.totals.vatAmount} />
              <div className="flex items-center justify-between gap-4 bg-white px-3 py-2 text-base font-black text-[#123B63] ring-1 ring-slate-200">
                <span>ยอดสุทธิ / Grand Total</span>
                <span>{printModel.totals.grandTotal}</span>
              </div>
            </div>
          </section>

          <footer className="mt-auto grid gap-8 px-5 pb-5 pt-8 text-sm text-slate-600 md:grid-cols-2">
            <SignatureBlock label="ผู้มีอำนาจลงนาม / Authorized Signature" />
            <SignatureBlock label="ผู้รับเงิน / Receiver" />
          </footer>
        </div>
      </article>
    </div>
  );
}

function DocumentField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="border-b border-slate-300 pb-1 text-xs font-bold text-slate-600">
        {label}
      </p>
      <p className="wrap-break-word pt-1.5 text-sm text-slate-950">{value}</p>
    </div>
  );
}

function InfoBox({ title, rows }: { title: string; rows: string[] }) {
  return (
    <div className="min-w-0 bg-slate-50 p-4 ring-1 ring-slate-200">
      <p className="mb-3 text-base font-black text-[#123B63]">{title}</p>
      <div className="space-y-1.5 text-sm leading-6 text-slate-950">
        {rows.map((row, index) => (
          <p key={`${title}-${index}`} className="wrap-break-word">
            {row}
          </p>
        ))}
      </div>
    </div>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-3 text-slate-700">
      <span className="min-w-0 wrap-break-word">{label}</span>
      <span className="shrink-0 text-right font-semibold text-slate-950">{value}</span>
    </div>
  );
}

function SignatureBlock({ label }: { label: string }) {
  return (
    <div>
      <div className="mb-2 border-t border-slate-300 pt-2">{label}</div>
      <div className="grid grid-cols-2 gap-4 text-xs text-slate-400">
        <span>ลงชื่อ / Signature</span>
        <span>วันที่ / Date</span>
      </div>
    </div>
  );
}