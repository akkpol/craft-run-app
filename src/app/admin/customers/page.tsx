import Link from "next/link";

import { formatBangkokDate } from "@/lib/bangkok-date-time";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type CustomerRow = {
  id: string;
  line_user_id: string;
  display_name: string | null;
  phone: string | null;
  line_email?: string | null;
  line_friendship_status?: boolean | null;
  created_at: string;
};

type LeadRow = {
  id: string;
  customer_id: string;
  status: string;
  created_at: string;
};

type QuoteRow = {
  id: string;
  lead_id: string;
  status: string;
  total: number | null;
};

function sourceLabel(lineUserId: string) {
  if (lineUserId.startsWith("manual:")) {
    const source = lineUserId.split(":")[1] || "other";
    return source === "walk_in"
      ? "หน้าร้าน"
      : source === "phone"
        ? "โทรศัพท์"
        : source === "facebook"
          ? "Facebook"
          : source === "email"
            ? "อีเมล"
            : "Manual";
  }

  return "LINE";
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("th-TH-u-nu-latn", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  }).format(value);
}

export default async function AdminCustomersPage() {
  const supabase = createAdminClient();
  const { data: customerData } = await supabase
    .from("customers")
    .select("id, line_user_id, display_name, phone, line_email, line_friendship_status, created_at")
    .order("created_at", { ascending: false })
    .limit(120);

  const customers = (customerData || []) as CustomerRow[];
  const customerIds = customers.map((customer) => customer.id);

  const { data: leadData } = customerIds.length
    ? await supabase
        .from("leads")
        .select("id, customer_id, status, created_at")
        .in("customer_id", customerIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  const leads = (leadData || []) as LeadRow[];
  const leadIds = leads.map((lead) => lead.id);
  const { data: quoteData } = leadIds.length
    ? await supabase
        .from("quotes")
        .select("id, lead_id, status, total")
        .in("lead_id", leadIds)
    : { data: [] };

  const quotes = (quoteData || []) as QuoteRow[];
  const leadsByCustomerId = new Map<string, LeadRow[]>();
  for (const lead of leads) {
    const rows = leadsByCustomerId.get(lead.customer_id) || [];
    rows.push(lead);
    leadsByCustomerId.set(lead.customer_id, rows);
  }

  const quotesByLeadId = new Map<string, QuoteRow[]>();
  for (const quote of quotes) {
    const rows = quotesByLeadId.get(quote.lead_id) || [];
    rows.push(quote);
    quotesByLeadId.set(quote.lead_id, rows);
  }

  return (
    <div className="px-4 py-6 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="flex flex-wrap items-start justify-between gap-4 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="max-w-3xl">
            <h1 className="text-2xl font-bold text-slate-950">โปรไฟล์ลูกค้า</h1>
            <p className="mt-1.5 text-sm text-slate-500">
              รวมลูกค้าจาก LINE และที่ทีมรับเข้ามาเอง — กดเปิดเพื่อดูประวัติงาน เอกสาร และข้อมูลติดต่อทั้งหมด
            </p>
          </div>
          <Link href="/admin/manual-intake" className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800">
            + รับงาน walk-in
          </Link>
        </section>

        <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-[minmax(0,1.35fr)_120px_120px_140px_120px_32px] gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 max-lg:hidden">
            <span>ลูกค้า</span>
            <span>แหล่งที่มา</span>
            <span>ใบลีด</span>
            <span>ยอดอนุมัติ</span>
            <span>สร้างเมื่อ</span>
            <span aria-hidden />
          </div>
          <div className="divide-y divide-slate-100">
            {customers.map((customer) => {
              const customerLeads = leadsByCustomerId.get(customer.id) || [];
              const customerQuotes = customerLeads.flatMap((lead) => quotesByLeadId.get(lead.id) || []);
              const approvedTotal = customerQuotes
                .filter((quote) => quote.status === "approved")
                .reduce((total, quote) => total + Number(quote.total || 0), 0);

              return (
                <Link
                  key={customer.id}
                  href={`/admin/customers/${customer.id}`}
                  className="group grid items-center gap-3 px-5 py-4 transition hover:bg-slate-50 lg:grid-cols-[minmax(0,1.35fr)_120px_120px_140px_120px_32px]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-950">{customer.display_name || "ลูกค้าไม่ระบุชื่อ"}</p>
                    <p className="mt-1 truncate text-xs text-slate-500">{customer.phone || customer.line_email || customer.line_user_id}</p>
                  </div>
                  <div className="text-sm text-slate-600">{sourceLabel(customer.line_user_id)}</div>
                  <div className="text-sm text-slate-600">{customerLeads.length}</div>
                  <div className="text-sm font-semibold text-slate-900">{formatMoney(approvedTotal)}</div>
                  <div className="text-sm text-slate-500">{formatBangkokDate(customer.created_at)}</div>
                  <div className="text-slate-300 transition group-hover:text-slate-600 max-lg:hidden">›</div>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
