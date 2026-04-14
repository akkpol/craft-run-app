import { createAdminClient } from "@/lib/supabase/admin";
import { PRODUCT_TYPES, WORKFLOW_STATES, JOB_STATUSES } from "@/lib/types";
import AdminJobActions from "./job-actions";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = createAdminClient();

  // Fetch all data in parallel
  const [leadsRes, quotesRes, jobsRes, escalationsRes, convsRes] =
    await Promise.all([
      supabase
        .from("leads")
        .select("*, customers(*)")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("quotes")
        .select("*, leads(*, customers(*)), quote_items(*)")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("jobs")
        .select("*, quotes(*, leads(*, customers(*))), job_timeline(*)")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("escalations")
        .select("*, conversations(*)")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("conversations")
        .select("*")
        .order("last_message_at", { ascending: false })
        .limit(20),
    ]);

  const leads = leadsRes.data || [];
  const quotes = quotesRes.data || [];
  const jobs = jobsRes.data || [];
  const escalations = escalationsRes.data || [];
  const conversations = convsRes.data || [];

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#1a1a2e] text-white px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold">🏭 FOGUS Admin</h1>
            <p className="text-sm text-gray-300">Dashboard</p>
          </div>
          <Link
            href="/flow"
            target="_blank"
            className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs font-medium text-white transition hover:bg-white/15"
          >
            เปิดหน้า Customer Flow
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="px-4 py-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-2xl font-bold text-[#1a1a2e]">{leads.length}</p>
            <p className="text-xs text-gray-500">Leads</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-2xl font-bold text-yellow-600">{quotes.filter((q: { status: string }) => q.status === "sent").length}</p>
            <p className="text-xs text-gray-500">รอลูกค้าอนุมัติ</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-2xl font-bold text-blue-600">{jobs.filter((j: { status: string }) => j.status !== "COMPLETED" && j.status !== "CANCELLED").length}</p>
            <p className="text-xs text-gray-500">งานที่กำลังทำ</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-2xl font-bold text-red-600">{escalations.length}</p>
            <p className="text-xs text-gray-500">Escalations</p>
          </div>
        </div>
      </div>

      {/* Escalations */}
      {escalations.length > 0 && (
        <div className="px-4 pb-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <h2 className="text-sm font-bold text-red-700 mb-2">🚨 ต้องตรวจสอบ ({escalations.length})</h2>
            {escalations.map((esc: { id: string; reason: string; created_at: string; conversations?: { line_user_id: string } }) => (
              <div key={esc.id} className="text-sm py-2 border-b border-red-100 last:border-0">
                <p className="text-red-800">{esc.reason}</p>
                <p className="text-red-400 text-xs mt-1">
                  LINE: {esc.conversations?.line_user_id || "?"} · {new Date(esc.created_at).toLocaleString("th-TH")}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Jobs */}
      <div className="px-4 pb-4">
        <h2 className="text-sm font-bold text-gray-700 mb-2">📋 Jobs ({jobs.length})</h2>
        <div className="space-y-2">
          {jobs.map((job: { id: string; status: string; created_at: string; quotes?: { public_token: string; total: number; leads?: { product_type: string; customers?: { display_name: string } } } }) => {
            const productLabel = PRODUCT_TYPES.find((p) => p.value === job.quotes?.leads?.product_type)?.label || "ไม่ระบุ";
            return (
              <div key={job.id} className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-sm font-medium">{job.quotes?.leads?.customers?.display_name || "ลูกค้า"}</span>
                    <span className="text-xs text-gray-400 ml-2">{productLabel}</span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    job.status === "COMPLETED" ? "bg-green-100 text-green-700" :
                    job.status === "IN_PROGRESS" ? "bg-yellow-100 text-yellow-700" :
                    job.status === "CANCELLED" ? "bg-red-100 text-red-700" :
                    "bg-blue-100 text-blue-700"
                  }`}>{job.status}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">{new Date(job.created_at).toLocaleDateString("th-TH")}</span>
                  <div className="flex gap-2 items-center">
                    {job.quotes?.public_token && (
                      <a href={`${baseUrl}/status/${job.quotes.public_token}`} target="_blank" className="text-xs text-blue-500 underline">status</a>
                    )}
                    <AdminJobActions jobId={job.id} currentStatus={job.status} />
                  </div>
                </div>
              </div>
            );
          })}
          {jobs.length === 0 && <p className="text-sm text-gray-400 text-center py-4">ยังไม่มี jobs</p>}
        </div>
      </div>

      {/* Quotes */}
      <div className="px-4 pb-4">
        <h2 className="text-sm font-bold text-gray-700 mb-2">📄 Quotes ({quotes.length})</h2>
        <div className="space-y-2">
          {quotes.map((q: { id: string; status: string; total: number; public_token: string; created_at: string; leads?: { product_type: string; customers?: { display_name: string } } }) => (
            <div key={q.id} className="bg-white rounded-xl p-4 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{q.leads?.customers?.display_name || "ลูกค้า"}</p>
                <p className="text-xs text-gray-400">
                  {PRODUCT_TYPES.find((p) => p.value === q.leads?.product_type)?.label || q.leads?.product_type} · ฿{Number(q.total).toLocaleString()}
                </p>
              </div>
              <div className="text-right">
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  q.status === "approved" ? "bg-green-100 text-green-700" :
                  q.status === "sent" ? "bg-yellow-100 text-yellow-700" :
                  "bg-gray-100 text-gray-600"
                }`}>{q.status}</span>
                <div className="mt-1">
                  <a href={`${baseUrl}/quote/${q.public_token}`} target="_blank" className="text-xs text-blue-500 underline">ดู</a>
                </div>
              </div>
            </div>
          ))}
          {quotes.length === 0 && <p className="text-sm text-gray-400 text-center py-4">ยังไม่มี quotes</p>}
        </div>
      </div>

      {/* Leads */}
      <div className="px-4 pb-4">
        <h2 className="text-sm font-bold text-gray-700 mb-2">🎯 Leads ({leads.length})</h2>
        <div className="space-y-2">
          {leads.map((l: { id: string; product_type: string; width_mm: number; height_mm: number; qty: number; status: string; created_at: string; customers?: { display_name: string; phone: string } }) => (
            <div key={l.id} className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{l.customers?.display_name || "ลูกค้า"}</p>
                  <p className="text-xs text-gray-400">
                    {PRODUCT_TYPES.find((p) => p.value === l.product_type)?.label || l.product_type} · {(l.width_mm / 10).toFixed(0)}×{(l.height_mm / 10).toFixed(0)} ซม. × {l.qty}
                  </p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${l.status === "new" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>{l.status}</span>
              </div>
            </div>
          ))}
          {leads.length === 0 && <p className="text-sm text-gray-400 text-center py-4">ยังไม่มี leads</p>}
        </div>
      </div>

      {/* Recent Conversations */}
      <div className="px-4 pb-8">
        <h2 className="text-sm font-bold text-gray-700 mb-2">💬 Recent Conversations ({conversations.length})</h2>
        <div className="space-y-2">
          {conversations.map((c: { id: string; line_user_id: string; state: string; last_message_at: string }) => (
            <div key={c.id} className="bg-white rounded-xl p-3 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-mono text-gray-500">{c.line_user_id.slice(0, 12)}...</p>
                <p className="text-xs text-gray-400">{new Date(c.last_message_at).toLocaleString("th-TH")}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                c.state === "HUMAN_REVIEW_REQUIRED" ? "bg-red-100 text-red-700" :
                c.state === "COMPLETED" ? "bg-green-100 text-green-700" :
                "bg-gray-100 text-gray-600"
              }`}>{c.state}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
