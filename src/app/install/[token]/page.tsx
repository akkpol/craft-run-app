import { notFound } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";

import { InstallProofUploader } from "./install-proof-uploader";

export const dynamic = "force-dynamic";

function formatBangkokDateTime(iso: string | null): string {
  if (!iso) return "ยังไม่กำหนด";
  try {
    return new Intl.DateTimeFormat("th-TH", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Bangkok",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default async function InstallPage(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;
  const supabase = createAdminClient();

  const { data: install } = await supabase
    .from("installations")
    .select(
      "id, public_token, scheduled_at, install_team, on_site_address, on_site_contact_name, on_site_contact_phone, notes, status, photo_proof_paths, completed_at, quotes(public_token, total, leads(customers(display_name)))"
    )
    .eq("public_token", token)
    .maybeSingle();

  if (!install) notFound();

  const quoteRow = Array.isArray(install.quotes) ? install.quotes[0] : install.quotes;
  const leadRow = quoteRow ? (Array.isArray(quoteRow.leads) ? quoteRow.leads[0] : quoteRow.leads) : null;
  const customerRow = leadRow ? (Array.isArray(leadRow.customers) ? leadRow.customers[0] : leadRow.customers) : null;
  const customerName = customerRow?.display_name ?? "ไม่ระบุชื่อ";
  const photoCount = (install.photo_proof_paths ?? []).length;
  const isOpen = install.status === "scheduled" || install.status === "in_progress";

  const statusLabel: Record<string, string> = {
    scheduled: "นัดติดตั้งแล้ว",
    in_progress: "กำลังติดตั้ง",
    done: "ติดตั้งเสร็จ ✓",
    cancelled: "ยกเลิก",
  };
  const statusToneClass: Record<string, string> = {
    scheduled: "border-sky-200 bg-sky-50 text-sky-900",
    in_progress: "border-amber-200 bg-amber-50 text-amber-900",
    done: "border-emerald-200 bg-emerald-50 text-emerald-900",
    cancelled: "border-slate-200 bg-slate-100 text-slate-700",
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="mx-auto max-w-md space-y-4">
        <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            FOGUS Install
          </p>
          <h1 className="mt-1 text-lg font-semibold text-slate-950">หน้างานติดตั้ง</h1>
          <div className={`mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${statusToneClass[install.status] ?? "border-slate-200 bg-slate-50 text-slate-700"}`}>
            {statusLabel[install.status] ?? install.status}
          </div>
        </header>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-2 text-sm">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">ลูกค้า</p>
          <p className="font-semibold text-slate-950">{customerName}</p>

          <div className="grid gap-1 text-xs text-slate-700">
            <p><span className="text-slate-500">วันเวลา:</span> {formatBangkokDateTime(install.scheduled_at)}</p>
            <p><span className="text-slate-500">ทีม:</span> {install.install_team || "ยังไม่ระบุ"}</p>
            <p><span className="text-slate-500">ที่อยู่หน้างาน:</span> {install.on_site_address || "ยังไม่ระบุ"}</p>
            <p><span className="text-slate-500">คนติดต่อหน้างาน:</span> {[install.on_site_contact_name, install.on_site_contact_phone].filter(Boolean).join(" · ") || "—"}</p>
          </div>

          {install.notes ? (
            <div className="rounded-2xl bg-slate-50 px-3 py-2 text-xs text-slate-700">
              📝 {install.notes}
            </div>
          ) : null}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-950">หลักฐานติดตั้ง</h2>
            <span className="text-xs text-slate-500">{photoCount} รูป</span>
          </div>
          {isOpen ? (
            <InstallProofUploader token={token} />
          ) : (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              {install.status === "done"
                ? `บันทึกครบ — ${formatBangkokDateTime(install.completed_at)}`
                : "งานติดตั้งถูกยกเลิก ไม่รับ upload เพิ่ม"}
            </div>
          )}
        </section>

        <p className="text-center text-[11px] text-slate-400">
          ลิงก์นี้สำหรับทีมงานติดตั้งเท่านั้น โปรดอย่าแชร์ให้ลูกค้า
        </p>
      </div>
    </div>
  );
}
