import Link from "next/link";

import type {
  AdminOverviewCardGroup,
  AdminOverviewCardModel,
} from "@/lib/admin-queue-view-model";
import { buildAdminOverviewCardGroups } from "@/lib/admin-queue-view-model";
import { fetchAdminOverviewPage } from "@/lib/admin-overview";
import { getAdminQueueContract } from "@/lib/admin-queue-contract";
import { getRuntimeAppConfig } from "@/lib/app-settings";
import { formatBangkokDate } from "@/lib/bangkok-date-time";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type AccountingQueueKey = "payment-ops" | "commercial-gate";

const ACCOUNTING_AUTOMATION_MODE_LABELS = {
  auto_run: "ระบบกำลังวิ่งเอง",
  customer_waiting: "รอลูกค้าตอบ",
  human_gate: "ต้องมีคนปล่อยงาน",
  terminal: "สถานะปิดแล้ว",
} as const;

const ACCOUNTING_NEXT_ACTION_OWNER_LABELS = {
  internal: "ทีมงาน",
  customer: "ลูกค้า",
  system: "ระบบ",
  none: "ไม่มี action ต่อ",
} as const;

const ACCOUNTING_STATUS_TONE_CLASSNAMES = {
  neutral: "border-slate-200 bg-slate-100 text-slate-700",
  info: "border-sky-200 bg-sky-100 text-sky-800",
  warning: "border-amber-200 bg-amber-100 text-amber-800",
  danger: "border-rose-200 bg-rose-100 text-rose-800",
  success: "border-emerald-200 bg-emerald-100 text-emerald-800",
  accent: "border-violet-200 bg-violet-100 text-violet-800",
} as const;

const ACCOUNTING_QUEUE_STYLES: Record<
  AccountingQueueKey,
  {
    panelClassName: string;
    badgeClassName: string;
    countClassName: string;
    chipClassName: string;
  }
> = {
  "payment-ops": {
    panelClassName: "border-amber-200 bg-amber-50/70",
    badgeClassName: "border-amber-200 bg-amber-100 text-amber-800",
    countClassName: "text-amber-900",
    chipClassName: "border-amber-200 bg-white text-amber-700",
  },
  "commercial-gate": {
    panelClassName: "border-cyan-200 bg-cyan-50/70",
    badgeClassName: "border-cyan-200 bg-cyan-100 text-cyan-800",
    countClassName: "text-cyan-900",
    chipClassName: "border-cyan-200 bg-white text-cyan-700",
  },
};

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

function getQueueHref(queueKey: AccountingQueueKey) {
  return `/admin?filter=${queueKey}`;
}

function AccountingQueueCard({
  card,
  queueKey,
}: {
  card: AdminOverviewCardModel;
  queueKey: AccountingQueueKey;
}) {
  const queueHref = getQueueHref(queueKey);

  return (
    <article className="rounded-[22px] border border-white/90 bg-white/92 p-4 shadow-[0_14px_32px_rgba(15,23,42,0.06)]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
          {card.ownerLabel}
        </span>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-semibold ${ACCOUNTING_STATUS_TONE_CLASSNAMES[card.statusTone]}`}
        >
          {ACCOUNTING_AUTOMATION_MODE_LABELS[card.automationMode]}
        </span>
        {card.contextChips.map((chip) => (
          <span
            key={`${card.id}-${chip}`}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600"
          >
            {chip}
          </span>
        ))}
      </div>

      <div className="mt-3 space-y-1">
        <h3 className="text-base font-semibold text-slate-950">{card.title}</h3>
        <p className="text-sm text-slate-500">{card.subtitle}</p>
      </div>

      <div className="mt-4 rounded-[18px] border border-slate-200 bg-slate-50/75 px-3 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">หยุดเพราะ</p>
        <p className="mt-1 text-sm font-medium text-slate-900">{card.stopReasonLabel}</p>
        <p className="mt-2 text-xs leading-5 text-slate-500">{card.summary}</p>
      </div>

      {card.evidenceSummary.length > 0 ? (
        <div className="mt-3 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            หลักฐานที่ใช้ตัดสินใจ
          </p>
          <div className="flex flex-wrap gap-2">
            {card.evidenceSummary.map((item) => (
              <span
                key={`${card.id}-${item}`}
                className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
        <div className="space-y-1 text-xs text-slate-500">
          <p>
            สิ่งที่ต้องทำต่อ: <span className="font-semibold text-slate-700">{card.primaryActionLabel}</span>
          </p>
          <p>
            เจ้าของ action ถัดไป: {ACCOUNTING_NEXT_ACTION_OWNER_LABELS[card.nextActionOwner]}
          </p>
          <p>สถานะตอนนี้: {card.statusLabel}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={queueHref}
            prefetch={false}
            className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            เปิดคิวนี้
          </Link>
          {card.primarySurfaceHref !== "/admin/accounting" ? (
            <Link
              href={card.primarySurfaceHref}
              prefetch={false}
              className="inline-flex items-center rounded-full bg-slate-950 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
            >
              {card.primarySurfaceLabel}
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function AccountingLaneSection({
  queueKey,
  group,
  totalCount,
}: {
  queueKey: AccountingQueueKey;
  group: AdminOverviewCardGroup;
  totalCount: number;
}) {
  const visuals = ACCOUNTING_QUEUE_STYLES[queueKey];

  return (
    <section className={`rounded-[28px] border p-5 shadow-sm ${visuals.panelClassName}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${visuals.badgeClassName}`}>
              {group.label}
            </span>
            <span className="text-xs text-slate-500">{group.ownerLabel}</span>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">{group.description}</p>
        </div>

        <div className="rounded-[18px] border border-white/80 bg-white/80 px-4 py-3 text-right">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">ต้องเคลียร์</p>
          <p className={`mt-1 text-2xl font-semibold ${visuals.countClassName}`}>{totalCount}</p>
        </div>
      </div>

      {group.cards.length > 0 ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {group.cards.map((card) => (
            <AccountingQueueCard key={card.id} card={card} queueKey={queueKey} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

export default async function AdminAccountingPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;
  const month = normalizeMonth(firstValue(searchParams.month));
  const exportHref = `/api/admin/accounting/monthly?month=${encodeURIComponent(month)}`;
  const taxLedgerHref = `/api/admin/accounting/tax-ledger?month=${encodeURIComponent(month)}`;
  const paymentOpsQueue = getAdminQueueContract("payment-ops");
  const commercialGateQueue = getAdminQueueContract("commercial-gate");
  const config = await getRuntimeAppConfig();
  const supabase = createAdminClient();
  const [documentRes, paymentOpsOverview, commercialGateOverview] = await Promise.all([
    supabase
      .from("commercial_documents")
      .select("id, document_type, document_number, status, grand_total, issued_at, created_at, issuer_entity_id, customer_id")
      .order("created_at", { ascending: false })
      .limit(80),
    fetchAdminOverviewPage({
      filter: "payment-ops",
      page: 1,
      pageSize: 4,
      baseUrl: config.baseUrl,
    }),
    fetchAdminOverviewPage({
      filter: "commercial-gate",
      page: 1,
      pageSize: 4,
      baseUrl: config.baseUrl,
    }),
  ]);

  const { data: documentData, error: documentError } = documentRes;
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
  const paymentOpsGroup = buildAdminOverviewCardGroups(paymentOpsOverview)[0] || {
    key: "payment-ops",
    label: paymentOpsQueue.label,
    description: paymentOpsQueue.description,
    ownerLabel: paymentOpsQueue.ownerLabel,
    count: 0,
    cards: [],
  };
  const commercialGateGroup = buildAdminOverviewCardGroups(commercialGateOverview)[0] || {
    key: "commercial-gate",
    label: commercialGateQueue.label,
    description: commercialGateQueue.description,
    ownerLabel: commercialGateQueue.ownerLabel,
    count: 0,
    cards: [],
  };

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
            <h1 className="text-2xl font-bold text-slate-950">การเงิน · เอกสาร</h1>
            <p className="mt-1.5 text-sm text-slate-500">
              ตรวจคิวรับชำระ ออกเอกสารหลังรับเงิน และ export รายเดือนให้ฝ่ายบัญชี
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="admin-kpi-card">
            <p className="text-sm font-medium text-slate-500">รอตรวจชำระ</p>
            <p className={`mt-1 text-3xl font-bold ${paymentOpsOverview.totalCount > 0 ? "text-rose-600" : "text-slate-400"}`}>
              {paymentOpsOverview.totalCount}
            </p>
          </div>
          <div className="admin-kpi-card">
            <p className="text-sm font-medium text-slate-500">รอออกเอกสาร</p>
            <p className={`mt-1 text-3xl font-bold ${commercialGateOverview.totalCount > 0 ? "text-amber-600" : "text-slate-400"}`}>
              {commercialGateOverview.totalCount}
            </p>
          </div>
          <div className="admin-kpi-card">
            <p className="text-sm font-medium text-slate-500">เอกสารออกแล้ว</p>
            <p className="mt-1 text-3xl font-bold text-slate-950">{issuedDocuments.length}</p>
          </div>
          <div className="admin-kpi-card">
            <p className="text-sm font-medium text-slate-500">ยอดรวมเอกสาร</p>
            <p className="mt-1 text-2xl font-bold text-slate-950">{formatMoney(issuedTotal)}</p>
          </div>
        </div>

        {paymentOpsOverview.totalCount > 0 || commercialGateOverview.totalCount > 0 ? (
          <section className="admin-panel mb-4 space-y-4 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="max-w-3xl">
              <h2 className="text-xl font-bold text-slate-950">คิวที่ต้องจัดการ</h2>
              <p className="mt-1.5 text-sm text-slate-500">
                เคลียร์งานค้างก่อนปล่อยเข้าผลิต
              </p>
            </div>

            {paymentOpsOverview.totalCount > 0 ? (
              <AccountingLaneSection
                queueKey="payment-ops"
                group={paymentOpsGroup}
                totalCount={paymentOpsOverview.totalCount}
              />
            ) : null}
            {commercialGateOverview.totalCount > 0 ? (
              <AccountingLaneSection
                queueKey="commercial-gate"
                group={commercialGateGroup}
                totalCount={commercialGateOverview.totalCount}
              />
            ) : null}
          </section>
        ) : null}

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
                ดาวน์โหลด Quote/Payment CSV เดือน {month}
              </a>
              <a
                href={taxLedgerHref}
                className="inline-flex items-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:border-slate-400 hover:bg-slate-50"
                title="หนึ่งแถวต่อใบกำกับ/ใบเสร็จ — ใช้สำหรับ ภ.พ.30 + ภ.ง.ด.53"
              >
                ดาวน์โหลด Tax Ledger เดือน {month}
              </a>
              <Link
                href={getQueueHref("payment-ops")}
                prefetch={false}
                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                เปิดคิว Payment Ops
              </Link>
            </div>
          </form>

          <details className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
            <summary className="cursor-pointer text-sm font-semibold text-slate-700 hover:text-slate-900">
              ℹ️ ในไฟล์ export มีข้อมูลอะไรบ้าง
            </summary>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm font-semibold text-slate-950">CSV รายเดือน</p>
                <ul className="mt-2 space-y-1 text-sm leading-6 text-slate-600">
                  <li>• ยอด quote และสถานะการชำระ</li>
                  <li>• ข้อมูลออกใบกำกับของลูกค้า</li>
                  <li>• เวลาและหลักฐานการชำระ</li>
                  <li>• snapshot ผู้รับชำระตอน quote ถูกใช้</li>
                </ul>
              </div>

              <div>
                <p className="text-sm font-semibold text-emerald-950">เอกสาร runtime</p>
                <ul className="mt-2 space-y-1 text-sm leading-6 text-emerald-900/80">
                  <li>• ออกเลขเอกสารต่อผู้รับเงินอัตโนมัติ</li>
                  <li>• ดาวน์โหลด/พิมพ์จาก snapshot ที่ล็อกแล้ว</li>
                  <li>• v1 ใช้กับใบเสร็จ + ใบกำกับ/ใบเสร็จ หลังรับชำระ</li>
                  <li>• ยังไม่ sync ไปโปรแกรมบัญชีภายนอก</li>
                </ul>
              </div>
            </div>
          </details>
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