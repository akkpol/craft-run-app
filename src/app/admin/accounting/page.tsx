import Link from "next/link";
import { getAdminQueueContract } from "@/lib/admin-queue-contract";
import { formatBangkokDate } from "@/lib/bangkok-date-time";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeMonth(value: string | undefined) {
  if (value && /^\d{4}-\d{2}$/.test(value)) {
    return value;
  }

  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

type CommercialDocumentRow = {
  id: string;
  document_type: string;
  document_number: string;
  status: string;
  grand_total: number | null;
  issued_at: string | null;
  created_at: string;
  issuer_entity_id: string | null;
  customer_id: string | null;
};

type CommercialEntityRow = {
  id: string;
  display_name: string | null;
  legal_name: string | null;
};

type CustomerRow = {
  id: string;
  display_name: string | null;
  phone: string | null;
};

function documentTypeLabel(value: string) {
  switch (value) {
    case "RECEIPT":
      return "ใบเสร็จรับเงิน";
    case "TAX_INVOICE_RECEIPT":
      return "ใบเสร็จรับเงิน/ใบกำกับภาษี";
    case "TAX_INVOICE":
      return "ใบกำกับภาษี";
    case "INVOICE":
      return "Invoice";
    case "BILLING_NOTE":
      return "ใบวางบิล";
    default:
      return value;
  }
}

function formatMoney(value: number | null | undefined) {
  return new Intl.NumberFormat("th-TH-u-nu-latn", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export default async function AdminAccountingPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;
  const month = normalizeMonth(firstValue(searchParams.month));
  const exportHref = `/api/admin/accounting/monthly?month=${encodeURIComponent(month)}`;
  const paymentOpsQueue = getAdminQueueContract("payment-ops");
  const commercialGateQueue = getAdminQueueContract("commercial-gate");
  const supabase = createAdminClient();
  const { data: documentData, error: documentError } = await supabase
    .from("commercial_documents")
    .select("id, document_type, document_number, status, grand_total, issued_at, created_at, issuer_entity_id, customer_id")
    .order("created_at", { ascending: false })
    .limit(80);
  const documents = documentError ? [] : ((documentData || []) as CommercialDocumentRow[]);
  const issuerIds = [...new Set(documents.map((document) => document.issuer_entity_id).filter((id): id is string => Boolean(id)))];
  const customerIds = [...new Set(documents.map((document) => document.customer_id).filter((id): id is string => Boolean(id)))];
  const [{ data: entityData }, { data: customerData }] = await Promise.all([
    issuerIds.length
      ? supabase.from("commercial_entities").select("id, display_name, legal_name").in("id", issuerIds)
      : Promise.resolve({ data: [] }),
    customerIds.length
      ? supabase.from("customers").select("id, display_name, phone").in("id", customerIds)
      : Promise.resolve({ data: [] }),
  ]);
  const entityById = new Map(((entityData || []) as CommercialEntityRow[]).map((entity) => [entity.id, entity]));
  const customerById = new Map(((customerData || []) as CustomerRow[]).map((customer) => [customer.id, customer]));
  const issuedDocuments = documents.filter((document) => document.status === "ISSUED");
  const issuedTotal = issuedDocuments.reduce((total, document) => total + Number(document.grand_total || 0), 0);

  return (
    <div className="admin-shell min-h-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-5xl flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <Link
              href="/admin"
              prefetch={false}
              className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
            >
              ← กลับแดชบอร์ด
            </Link>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">
              {paymentOpsQueue.ownerLabel}
            </p>
            <h1 className="mt-2 text-2xl font-bold text-slate-950">Finance &amp; Documents Export</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              ศูนย์รวมเอกสารการเงิน runtime, commercial gate และ export รายเดือน สำหรับตรวจว่า payment receiver, ผู้ออกเอกสาร และเอกสารหลังรับชำระตรงกันหรือไม่
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 font-medium text-slate-700">
                {paymentOpsQueue.label}
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 font-medium text-slate-700">
                {commercialGateQueue.label}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div className="mb-4 grid gap-3 md:grid-cols-4">
          <div className="admin-kpi-card">
            <p className="text-xs font-medium text-slate-500">เอกสาร runtime</p>
            <p className="mt-1 text-2xl font-bold text-slate-950">{documents.length}</p>
          </div>
          <div className="admin-kpi-card">
            <p className="text-xs font-medium text-slate-500">ออกแล้ว</p>
            <p className="mt-1 text-2xl font-bold text-emerald-700">{issuedDocuments.length}</p>
          </div>
          <div className="admin-kpi-card">
            <p className="text-xs font-medium text-slate-500">ใบกำกับ/ใบเสร็จ</p>
            <p className="mt-1 text-2xl font-bold text-sky-700">{documents.filter((document) => document.document_type === "TAX_INVOICE_RECEIPT").length}</p>
          </div>
          <div className="admin-kpi-card">
            <p className="text-xs font-medium text-slate-500">ยอดเอกสารออกแล้ว</p>
            <p className="mt-1 text-xl font-bold text-slate-950">{formatMoney(issuedTotal)}</p>
          </div>
        </div>

        <section className="admin-panel rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <form className="grid gap-4 md:grid-cols-[minmax(0,220px)_1fr] md:items-end">
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              เดือนที่ต้องการส่งนักบัญชี
              <input
                type="text"
                inputMode="numeric"
                pattern="\\d{4}-\\d{2}"
                name="month"
                defaultValue={month}
                placeholder="2026-05"
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none ring-0 transition focus:border-sky-400"
              />
            </label>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                เปลี่ยนเดือน
              </button>
              <a
                href={exportHref}
                className="inline-flex items-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                ดาวน์โหลด CSV เดือน {month}
              </a>
            </div>
          </form>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-sm font-semibold text-slate-950">สิ่งที่ export แล้ว</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                <li>Quote totals และสถานะการชำระ</li>
                <li>Document / billing identity ที่ลูกค้าให้ไว้</li>
                <li>Payment tracking timestamps และ proof reference</li>
                <li>Payment profile snapshot ที่ quote ใช้อยู่ตอนนั้น</li>
              </ul>
            </div>

            <div className="rounded-3xl border border-emerald-200 bg-emerald-50/70 p-4">
              <p className="text-sm font-semibold text-emerald-950">runtime document ที่ระบบมีแล้ว</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-emerald-900/80">
                <li>ออกเลขเอกสารจาก sequence ต่อ entity</li>
                <li>ดาวน์โหลด/พิมพ์เอกสารจาก snapshot ที่ล็อกแล้ว</li>
                <li>v1 ใช้งานจริงกับ RECEIPT และ TAX_INVOICE_RECEIPT หลังรับชำระ</li>
                <li>ยังไม่ sync ไปโปรแกรมบัญชีภายนอกหรือ payment gateway</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="admin-panel mt-4 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-950">เอกสารที่ออกจากระบบ</p>
              <p className="mt-1 text-sm text-slate-500">กดเปิดเพื่อดูหน้า print/download ของเอกสารแต่ละใบ</p>
            </div>
            {documentError ? <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">ยังอ่านตารางเอกสารไม่ได้</span> : null}
          </div>

          <div className="mt-4 divide-y divide-slate-100 overflow-hidden rounded-[22px] border border-slate-200">
            {documents.length === 0 ? (
              <p className="px-4 py-5 text-sm text-slate-500">ยังไม่มีเอกสาร runtime ที่ออกแล้ว</p>
            ) : (
              documents.map((document) => {
                const issuer = document.issuer_entity_id ? entityById.get(document.issuer_entity_id) : null;
                const customer = document.customer_id ? customerById.get(document.customer_id) : null;

                return (
                  <Link
                    key={document.id}
                    href={`/commercial/documents/${document.id}/download`}
                    target="_blank"
                    className="grid gap-3 px-4 py-4 transition hover:bg-slate-50 md:grid-cols-[1fr_1fr_120px_120px]"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{document.document_number}</p>
                      <p className="mt-1 text-xs text-slate-500">{documentTypeLabel(document.document_type)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-700">{customer?.display_name || customer?.phone || "ไม่ระบุลูกค้า"}</p>
                      <p className="mt-1 text-xs text-slate-500">ผู้ออก: {issuer?.display_name || issuer?.legal_name || "-"}</p>
                    </div>
                    <div className="text-sm font-semibold text-slate-950">{formatMoney(document.grand_total)}</div>
                    <div className="text-sm text-slate-500">{formatBangkokDate(document.issued_at || document.created_at)}</div>
                  </Link>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}