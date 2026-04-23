"use client";

import Link from "next/link";

// ─── Conversation state labels ────────────────────────────────────────────────
const STATE_LABELS: Record<string, string> = {
  NEW_MESSAGE: "ข้อความใหม่",
  COLLECTING_REQUIREMENTS: "กำลังเก็บข้อมูล",
  REQUIREMENTS_REVIEW: "ตรวจสอบข้อมูล",
  WAITING_QUOTE_APPROVAL: "รออนุมัติใบเสนอราคา",
  WAITING_PAYMENT: "รอชำระเงิน",
  IN_DESIGN: "ออกแบบ",
  IN_PRODUCTION: "ผลิต",
  READY_FOR_FULFILLMENT: "พร้อมส่ง",
  COMPLETED: "เสร็จสิ้น",
  ON_HOLD_CUSTOMER_INPUT: "รอข้อมูลลูกค้า",
  HUMAN_REVIEW_REQUIRED: "รอแอดมิน",
  CANCELLED: "ยกเลิก",
};

const STATE_COLORS: Record<string, string> = {
  COMPLETED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-slate-100 text-slate-500",
  WAITING_QUOTE_APPROVAL: "bg-amber-100 text-amber-700",
  WAITING_PAYMENT: "bg-orange-100 text-orange-700",
  IN_DESIGN: "bg-sky-100 text-sky-700",
  IN_PRODUCTION: "bg-blue-100 text-blue-700",
  HUMAN_REVIEW_REQUIRED: "bg-rose-100 text-rose-700",
  ON_HOLD_CUSTOMER_INPUT: "bg-yellow-100 text-yellow-700",
};

const QUOTE_STATUS_LABELS: Record<string, string> = {
  draft: "แบบร่าง",
  sent: "ส่งแล้ว",
  approved: "อนุมัติแล้ว",
  rejected: "ปฏิเสธ",
  expired: "หมดอายุ",
};

const QUOTE_STATUS_COLORS: Record<string, string> = {
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-rose-100 text-rose-700",
  expired: "bg-slate-100 text-slate-500",
  sent: "bg-amber-100 text-amber-700",
  draft: "bg-slate-100 text-slate-600",
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatBaht(value: number) {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 0,
  }).format(value);
}

function StateChip({ state }: { state: string }) {
  const color = STATE_COLORS[state] ?? "bg-slate-100 text-slate-600";
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>
      {STATE_LABELS[state] ?? state}
    </span>
  );
}

type Customer = {
  id: string;
  line_user_id: string;
  display_name: string | null;
  phone: string | null;
  created_at: string;
};

type Conversation = {
  id: string;
  state: string;
  last_message_at: string | null;
  created_at: string;
};

type Lead = {
  id: string;
  product_type: string | null;
  width_mm: number | null;
  height_mm: number | null;
  qty: number | null;
  status: string;
  due_date: string | null;
  note_from_form: string | null;
  created_at: string;
};

type Quote = {
  id: string;
  total: number | null;
  status: string;
  created_at: string;
  jobs?: Array<{ id: string; status: string; created_at: string }>;
};

type Summary = {
  totalOrders: number;
  totalRevenue: number;
  completedJobs: number;
  activeJobs: number;
};

export default function Customer360Client({
  customer,
  conversations,
  leads,
  quotes,
  summary,
}: {
  customer: Customer;
  conversations: Conversation[];
  leads: Lead[];
  quotes: Quote[];
  summary: Summary;
}) {
  return (
    <div className="admin-shell min-h-screen bg-slate-50">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="mx-auto max-w-5xl">
          <Link
            href="/admin"
            className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
          >
            ← กลับแดชบอร์ด
          </Link>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                {customer.display_name || "ลูกค้าไม่ระบุชื่อ"}
              </h1>
              <div className="mt-1 flex flex-wrap gap-3 text-sm text-slate-600">
                {customer.phone && (
                  <span>📞 {customer.phone}</span>
                )}
                <span className="text-slate-400">LINE: {customer.line_user_id}</span>
                <span className="text-slate-400">
                  สมัครเมื่อ {formatDate(customer.created_at)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">
        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="admin-kpi-card">
            <p className="text-xs font-medium text-slate-500">คำสั่งซื้อ</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{summary.totalOrders}</p>
          </div>
          <div className="admin-kpi-card">
            <p className="text-xs font-medium text-slate-500">รายได้รวม</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600">
              {formatBaht(summary.totalRevenue)}
            </p>
          </div>
          <div className="admin-kpi-card">
            <p className="text-xs font-medium text-slate-500">งานเสร็จสิ้น</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{summary.completedJobs}</p>
          </div>
          <div className="admin-kpi-card">
            <p className="text-xs font-medium text-slate-500">งานในคิว</p>
            <p className="mt-1 text-2xl font-bold text-sky-600">{summary.activeJobs}</p>
          </div>
        </div>

        {/* Conversations */}
        <section className="admin-panel">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">
            Conversations ({conversations.length})
          </h2>
          {conversations.length === 0 ? (
            <p className="text-sm text-slate-400">ยังไม่มีบทสนทนา</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs font-medium text-slate-500">
                    <th className="pb-2 pr-4">สถานะ</th>
                    <th className="pb-2 pr-4">ข้อความล่าสุด</th>
                    <th className="pb-2">สร้างเมื่อ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {conversations.map((conv) => (
                    <tr key={conv.id}>
                      <td className="py-2.5 pr-4">
                        <StateChip state={conv.state} />
                      </td>
                      <td className="py-2.5 pr-4 text-slate-600">
                        {formatDate(conv.last_message_at)}
                      </td>
                      <td className="py-2.5 text-slate-500">
                        {formatDate(conv.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Leads */}
        <section className="admin-panel">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">
            Leads ({leads.length})
          </h2>
          {leads.length === 0 ? (
            <p className="text-sm text-slate-400">ยังไม่มี lead</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs font-medium text-slate-500">
                    <th className="pb-2 pr-4">ประเภทงาน</th>
                    <th className="pb-2 pr-4">ขนาด</th>
                    <th className="pb-2 pr-4">จำนวน</th>
                    <th className="pb-2 pr-4">สถานะ</th>
                    <th className="pb-2">วันที่</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {leads.map((lead) => (
                    <tr key={lead.id}>
                      <td className="py-2.5 pr-4 font-medium text-slate-800">
                        {lead.product_type || "—"}
                      </td>
                      <td className="py-2.5 pr-4 text-slate-600">
                        {lead.width_mm && lead.height_mm
                          ? `${lead.width_mm}×${lead.height_mm} mm`
                          : "—"}
                      </td>
                      <td className="py-2.5 pr-4 text-slate-600">
                        {lead.qty ?? "—"}
                      </td>
                      <td className="py-2.5 pr-4">
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                          {lead.status}
                        </span>
                      </td>
                      <td className="py-2.5 text-slate-500">
                        {formatDate(lead.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Quotes */}
        <section className="admin-panel">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">
            Quotes &amp; Jobs ({quotes.length})
          </h2>
          {quotes.length === 0 ? (
            <p className="text-sm text-slate-400">ยังไม่มีใบเสนอราคา</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs font-medium text-slate-500">
                    <th className="pb-2 pr-4">ราคารวม</th>
                    <th className="pb-2 pr-4">สถานะ Quote</th>
                    <th className="pb-2 pr-4">Jobs</th>
                    <th className="pb-2">วันที่</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {quotes.map((quote) => {
                    const jobs = Array.isArray(quote.jobs) ? quote.jobs : [];
                    const statusColor =
                      QUOTE_STATUS_COLORS[quote.status] ??
                      "bg-slate-100 text-slate-600";
                    return (
                      <tr key={quote.id}>
                        <td className="py-2.5 pr-4 font-semibold text-slate-800">
                          {quote.total ? formatBaht(quote.total) : "—"}
                        </td>
                        <td className="py-2.5 pr-4">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor}`}
                          >
                            {QUOTE_STATUS_LABELS[quote.status] ?? quote.status}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4 text-slate-600">
                          {jobs.length > 0
                            ? jobs
                                .map((j) => j.status)
                                .join(", ")
                            : "—"}
                        </td>
                        <td className="py-2.5 text-slate-500">
                          {formatDate(quote.created_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
