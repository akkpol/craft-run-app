import type { ReactNode } from "react";

import type { WhtCertificatePrintModel } from "@/lib/wht-certificate-print";

type WhtCertificatePrintPageProps = {
  printModel: WhtCertificatePrintModel;
  toolbar?: ReactNode;
};

/**
 * 50 ทวิ (Withholding Tax Certificate) — single-page A4 print layout.
 *
 * Layout follows the Revenue Department's "หนังสือรับรองการหักภาษี ณ ที่จ่าย"
 * structure: header (issuer ↔ payee), income table, tax-form checkboxes,
 * and a signature block. Filled in with payment/quote data; the customer
 * (withholder) signs and stamps when handing the cert back.
 */
export default function WhtCertificatePrintPage({
  printModel,
  toolbar,
}: WhtCertificatePrintPageProps) {
  return (
    <div className="min-h-screen bg-[#eef3f8] px-3 py-4 text-slate-950 sm:px-4 sm:py-6 print:bg-white print:p-0">
      <style>{`
        @page {
          size: A4;
          margin: 10mm;
        }
        @media print {
          body { background: white; }
        }
      `}</style>

      {toolbar ? (
        <div className="mx-auto flex w-full max-w-[210mm] justify-end pb-4">
          {toolbar}
        </div>
      ) : null}

      <article className="mx-auto w-full max-w-[210mm] rounded-[18px] bg-white px-4 py-4 shadow-[0_24px_90px_rgba(15,23,42,0.16)] sm:px-7 sm:py-7 md:px-[14mm] md:py-[14mm] print:max-w-none print:rounded-none print:px-0 print:py-0 print:shadow-none">
        <div className="flex flex-col gap-3 border border-slate-300">
          {/* Header */}
          <header className="grid gap-2 border-b border-slate-300 px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Withholding Tax Certificate / 50 ทวิ
              </p>
              <h1 className="mt-1 text-xl font-bold leading-tight text-[#123B63] sm:text-2xl">
                หนังสือรับรองการหักภาษี ณ ที่จ่าย
              </h1>
              <p className="text-xs text-slate-600">
                ตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร
              </p>
            </div>
            <div className="grid gap-1 text-xs">
              <Field label="เลขที่ / Cert No." value={printModel.certNumber} />
              <Field label="วันที่ออก / Issued" value={printModel.issuedDate} />
              <Field
                label="วันที่จ่าย / Paid"
                value={printModel.paymentDate}
              />
            </div>
          </header>

          {/* Parties */}
          <section className="grid gap-3 px-4 md:grid-cols-2">
            <PartyBox
              title="ผู้มีหน้าที่หักภาษี ณ ที่จ่าย / Withholder"
              subtitle="ผู้จ่ายเงิน (ลูกค้า) — เป็นผู้นำส่งภาษีต่อสรรพากร"
              rows={[
                { label: "ชื่อ / Name", value: printModel.withholder.name },
                {
                  label: "เลขประจำตัวผู้เสียภาษี / Tax ID",
                  value: printModel.withholder.taxId,
                },
                { label: "ที่อยู่ / Address", value: printModel.withholder.address },
              ]}
            />
            <PartyBox
              title="ผู้ถูกหักภาษี ณ ที่จ่าย / Payee"
              subtitle="ผู้ได้รับเงิน — ร้านของเรา"
              rows={[
                { label: "ชื่อ / Name", value: printModel.payee.name },
                {
                  label: "เลขประจำตัวผู้เสียภาษี / Tax ID",
                  value: printModel.payee.taxId,
                },
                { label: "ที่อยู่ / Address", value: printModel.payee.address },
              ]}
            />
          </section>

          {/* Form type */}
          <section className="px-4">
            <div className="border border-slate-300 px-3 py-2 text-xs">
              <p className="font-semibold text-slate-800">
                แบบยื่นรายการภาษี / Tax Form
              </p>
              <p className="mt-1">
                <Checkbox
                  checked={printModel.withholder.formType === "ภ.ง.ด.3"}
                />
                <span className="ml-1">ภ.ง.ด.3 (บุคคลธรรมดา)</span>
                <Checkbox
                  checked={printModel.withholder.formType === "ภ.ง.ด.53"}
                  className="ml-6"
                />
                <span className="ml-1">ภ.ง.ด.53 (นิติบุคคล)</span>
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                อัตโนมัติจาก billing_entity_type — แก้ไขด้วยมือบนเอกสารพิมพ์ได้
              </p>
            </div>
          </section>

          {/* Income table */}
          <section className="px-4">
            <div className="border border-slate-300">
              <div className="grid grid-cols-[1fr_28mm_24mm_24mm] bg-[#123B63] px-3 py-2 text-[11px] font-bold text-white">
                <div>ประเภทเงินได้ / Income Type</div>
                <div className="text-right">วันที่จ่าย / Paid</div>
                <div className="text-right">จำนวนเงิน / Amount (THB)</div>
                <div className="text-right">ภาษีหัก / WHT (THB)</div>
              </div>
              <div className="grid grid-cols-[1fr_28mm_24mm_24mm] border-t border-slate-300 px-3 py-3 text-sm">
                <div className="pr-2">
                  <Checkbox checked={true} />
                  <span className="ml-1">{printModel.income.sectionLabel}</span>
                </div>
                <div className="text-right">{printModel.income.paidAt}</div>
                <div className="text-right font-semibold">
                  {printModel.income.grossAmount}
                </div>
                <div className="text-right font-semibold">
                  {printModel.income.whtAmount}
                </div>
              </div>
              <div className="grid grid-cols-[1fr_28mm_24mm_24mm] border-t border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold">
                <div className="pr-2 text-slate-700">
                  รวม / Total ({printModel.income.whtRateLabel})
                </div>
                <div />
                <div className="text-right">
                  {printModel.income.grossAmount}
                </div>
                <div className="text-right">{printModel.income.whtAmount}</div>
              </div>
            </div>
          </section>

          {/* Filing status */}
          <section className="px-4">
            <div className="border border-slate-300 px-3 py-2 text-xs">
              <p className="font-semibold text-slate-800">
                ผู้จ่ายเงิน / Withholder declares
              </p>
              <p className="mt-1">
                <Checkbox checked={true} />
                <span className="ml-1">
                  หัก ณ ที่จ่าย / Tax withheld at source — already withheld at
                  the time of payment
                </span>
              </p>
              <p>
                <Checkbox checked={false} />
                <span className="ml-1">
                  ออกให้ครั้งเดียว / Paid once on behalf — withholder paid the
                  tax on payee&apos;s behalf
                </span>
              </p>
              <p>
                <Checkbox checked={false} />
                <span className="ml-1">
                  ออกให้ตลอดไป / Paid each time — withholder pays tax each cycle
                </span>
              </p>
            </div>
          </section>

          {/* Signature block */}
          <section className="grid gap-3 px-4 pb-4 md:grid-cols-2">
            <SignatureBox
              title="ลายเซ็นผู้จ่ายเงิน / Withholder signature"
              hint="(พร้อมตราประทับนิติบุคคล)"
            />
            <SignatureBox
              title="วันที่ออกเอกสาร / Date issued"
              hint={printModel.issuedDate}
            />
          </section>

          <footer className="border-t border-slate-300 bg-slate-50 px-4 py-2 text-[10px] text-slate-500">
            payment: <code className="font-mono">{printModel.meta.paymentId}</code>
            {" · "}quote:{" "}
            <code className="font-mono">{printModel.meta.quoteId}</code>
            {" · "}ภาษี ณ ที่จ่ายตามมาตรา 50 ทวิ
          </footer>
        </div>
      </article>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-mono text-slate-900">{value}</span>
    </div>
  );
}

function PartyBox({
  title,
  subtitle,
  rows,
}: {
  title: string;
  subtitle: string;
  rows: Array<{ label: string; value: string }>;
}) {
  return (
    <div className="border border-slate-300 px-3 py-2 text-xs">
      <p className="font-semibold text-slate-800">{title}</p>
      <p className="text-[11px] text-slate-500">{subtitle}</p>
      <dl className="mt-1 grid gap-1">
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-[28mm_minmax(0,1fr)] gap-2">
            <dt className="text-slate-500">{row.label}</dt>
            <dd className="break-words text-slate-900">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Checkbox({ checked, className }: { checked: boolean; className?: string }) {
  return (
    <span
      className={
        "inline-block h-3 w-3 border border-slate-700 align-middle " +
        (checked ? "bg-slate-800" : "bg-white") +
        (className ? ` ${className}` : "")
      }
    />
  );
}

function SignatureBox({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="border border-slate-300 px-3 py-2 text-xs">
      <p className="font-semibold text-slate-800">{title}</p>
      <div className="mt-6 border-b border-dashed border-slate-400" />
      <p className="mt-2 text-[11px] text-slate-500">{hint}</p>
    </div>
  );
}
