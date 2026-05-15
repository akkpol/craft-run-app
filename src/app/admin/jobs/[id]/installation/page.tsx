import { notFound, redirect } from "next/navigation";

import { resolveAdminAccess } from "@/lib/admin-auth";
import { getRuntimeAppConfig } from "@/lib/app-settings";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

import { InstallScheduleForm } from "./install-schedule-form";
import { InstallProofGallery } from "./install-proof-gallery";

export const dynamic = "force-dynamic";

function formatBangkokDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
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

export default async function AdminInstallationPage(props: { params: Promise<{ id: string }> }) {
  const { id: jobId } = await props.params;

  const authClient = await createClient();
  const { data: authData } = await authClient.auth.getClaims();
  const access = resolveAdminAccess(authData?.claims);
  if (!access.authenticated) {
    redirect(`/auth/login?next=/admin/jobs/${jobId}/installation`);
  }
  if (!access.allowed) {
    redirect("/admin?error=forbidden");
  }

  const supabase = createAdminClient();
  const { data: job } = await supabase
    .from("jobs")
    .select(
      "id, quote_id, status, leads(fulfillment_mode, fulfillment_address_line1, fulfillment_address_line2, customers(display_name, phone))"
    )
    .eq("id", jobId)
    .maybeSingle();
  if (!job) notFound();

  const lead = Array.isArray(job.leads) ? job.leads[0] : job.leads;
  const customer = lead ? (Array.isArray(lead.customers) ? lead.customers[0] : lead.customers) : null;

  if (lead?.fulfillment_mode !== "install") {
    return (
      <div className="mx-auto max-w-2xl space-y-3 p-6">
        <h1 className="text-lg font-semibold text-slate-950">งานนี้ไม่ใช่งานติดตั้งหน้างาน</h1>
        <p className="text-sm text-slate-600">
          ใช้ /admin/jobs/[id]/installation ได้เฉพาะงานที่ลูกค้าเลือก fulfillment_mode = install เท่านั้น
        </p>
        <a href="/admin" className="text-sm font-semibold text-sky-700 underline">
          กลับหน้าหลัก
        </a>
      </div>
    );
  }

  const { data: install } = await supabase
    .from("installations")
    .select(
      "id, public_token, scheduled_at, install_team, on_site_address, on_site_contact_name, on_site_contact_phone, notes, status, photo_proof_paths, completed_at, completed_by_email, created_at, updated_at"
    )
    .eq("job_id", jobId)
    .maybeSingle();

  const config = await getRuntimeAppConfig();
  const installLink = install
    ? `${(config.baseUrl || "").replace(/\/$/, "")}/install/${install.public_token}`
    : null;

  const presetAddress =
    [lead?.fulfillment_address_line1, lead?.fulfillment_address_line2]
      .filter(Boolean)
      .join(" ") || "";

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <header className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          งานติดตั้งหน้างาน
        </p>
        <h1 className="text-xl font-semibold text-slate-950">
          ตั้งค่าติดตั้ง: {customer?.display_name ?? "ลูกค้าไม่ระบุชื่อ"}
        </h1>
        <p className="text-xs text-slate-500">
          job id: <code className="font-mono">{job.id}</code> · job status: {job.status}
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-950">นัดติดตั้ง + ทีมงาน</h2>
        <p className="mt-1 text-xs text-slate-500">
          บันทึก/อัปเดตได้ตลอดจนกว่าทีมงานจะ mark &quot;ติดตั้งเสร็จ&quot; — ไม่กระทบ workflow state ของงาน
        </p>
        <div className="mt-4">
          <InstallScheduleForm
            jobId={job.id}
            initial={{
              scheduledAt: install?.scheduled_at ?? null,
              installTeam: install?.install_team ?? null,
              onSiteAddress: install?.on_site_address ?? presetAddress,
              onSiteContactName: install?.on_site_contact_name ?? customer?.display_name ?? null,
              onSiteContactPhone: install?.on_site_contact_phone ?? customer?.phone ?? null,
              notes: install?.notes ?? null,
            }}
          />
        </div>
      </section>

      {install ? (
        <>
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-emerald-950">ลิงก์สำหรับทีมงานติดตั้ง</h2>
            <p className="mt-1 text-xs text-emerald-900/80">
              ส่งให้ทีมที่ออกหน้างาน — ทีมจะ upload รูปและ mark เสร็จได้จากมือถือ โดยไม่ต้องมีบัญชี admin
            </p>
            <div className="mt-3 break-all rounded-xl bg-white px-3 py-2 font-mono text-xs text-slate-900">
              {installLink || `/install/${install.public_token}`}
            </div>
            <p className="mt-2 text-[11px] text-emerald-900/80">
              สถานะปัจจุบัน: <strong>{install.status}</strong>
              {install.completed_at ? ` — เสร็จเมื่อ ${formatBangkokDateTime(install.completed_at)}` : ""}
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-950">
              หลักฐานติดตั้ง ({(install.photo_proof_paths ?? []).length} รูป)
            </h2>
            <InstallProofGallery paths={install.photo_proof_paths ?? []} />
          </section>
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-5 text-sm text-slate-600">
          ยังไม่เคยตั้งค่าติดตั้ง — กรอกฟอร์มด้านบนแล้วบันทึก จะได้ลิงก์สำหรับทีมหน้างาน
        </div>
      )}
    </div>
  );
}
