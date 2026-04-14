import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import { PRODUCT_TYPES } from "@/lib/types";

const STATUS_DISPLAY: Record<string, { label: string; color: string; icon: string }> = {
  JOB_CREATED: { label: "สร้างงานแล้ว", color: "bg-blue-100 text-blue-700", icon: "📋" },
  IN_PROGRESS: { label: "กำลังดำเนินการ", color: "bg-yellow-100 text-yellow-700", icon: "🔧" },
  COMPLETED: { label: "เสร็จสมบูรณ์", color: "bg-green-100 text-green-700", icon: "✅" },
  CANCELLED: { label: "ยกเลิก", color: "bg-red-100 text-red-700", icon: "❌" },
};

export default async function StatusPage(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;
  const supabase = createAdminClient();

  // Find quote by public token, then get job
  const { data: quote } = await supabase
    .from("quotes")
    .select("*, leads(*, customers(*)), jobs(*, job_timeline(*))")
    .eq("public_token", token)
    .single();

  if (!quote) notFound();

  const lead = quote.leads;
  const customer = lead?.customers;
  const jobs = quote.jobs || [];
  const job = jobs[0];
  const timeline = job?.job_timeline?.sort(
    (a: { created_at: string }, b: { created_at: string }) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  ) || [];

  const productLabel = PRODUCT_TYPES.find((p) => p.value === lead?.product_type)?.label || lead?.product_type || "ไม่ระบุ";
  const statusInfo = STATUS_DISPLAY[job?.status] || { label: job?.status || "ไม่ระบุ", color: "bg-gray-100 text-gray-700", icon: "📋" };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="bg-white rounded-t-2xl px-6 py-5 border-b border-gray-100 text-center">
          <h1 className="text-lg font-bold text-gray-900">📊 สถานะงาน</h1>
          <p className="text-xs text-gray-400 mt-1">FOGUS Print &amp; Sign</p>
        </div>

        {/* Current status */}
        <div className="bg-white px-6 py-6 border-b border-gray-100 text-center">
          <div className="text-4xl mb-2">{statusInfo.icon}</div>
          <div className={`inline-block px-4 py-1.5 rounded-full text-sm font-medium ${statusInfo.color}`}>
            {statusInfo.label}
          </div>
        </div>

        {/* Job details */}
        <div className="bg-white px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-medium text-gray-500 mb-2">รายละเอียด</h2>
          <div className="space-y-1 text-sm">
            <p><span className="text-gray-500">ลูกค้า:</span> {customer?.display_name || "ไม่ระบุ"}</p>
            <p><span className="text-gray-500">ประเภท:</span> {productLabel}</p>
            {lead && <p><span className="text-gray-500">ขนาด:</span> {(lead.width_mm / 10).toFixed(1)} × {(lead.height_mm / 10).toFixed(1)} ซม.</p>}
            {lead?.qty && <p><span className="text-gray-500">จำนวน:</span> {lead.qty} ชิ้น</p>}
            <p><span className="text-gray-500">ราคารวม:</span> <span className="font-medium">฿{Number(quote.total).toLocaleString()}</span></p>
          </div>
        </div>

        {/* Timeline */}
        {timeline.length > 0 && (
          <div className="bg-white px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-medium text-gray-500 mb-3">ประวัติสถานะ</h2>
            <div className="space-y-3">
              {timeline.map((entry: { id: string; status: string; note: string; created_at: string }, idx: number) => {
                const entryInfo = STATUS_DISPLAY[entry.status] || { label: entry.status, icon: "📋" };
                return (
                  <div key={entry.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-2.5 h-2.5 rounded-full ${idx === 0 ? "bg-[#1a1a2e]" : "bg-gray-300"}`} />
                      {idx < timeline.length - 1 && <div className="w-0.5 flex-1 bg-gray-200 mt-1" />}
                    </div>
                    <div className="pb-3">
                      <p className={`text-sm font-medium ${idx === 0 ? "text-gray-900" : "text-gray-500"}`}>
                        {entryInfo.icon} {entryInfo.label}
                      </p>
                      {entry.note && <p className="text-xs text-gray-400 mt-0.5">{entry.note}</p>}
                      <p className="text-xs text-gray-300 mt-0.5">
                        {new Date(entry.created_at).toLocaleString("th-TH")}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="bg-white rounded-b-2xl px-6 py-4 text-center">
          <p className="text-xs text-gray-400">มีคำถาม? ทักหาเราทาง LINE ได้เลยค่ะ</p>
        </div>
      </div>
    </div>
  );
}
