import { notFound, redirect } from "next/navigation";

import { resolveAdminAccess } from "@/lib/admin-auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

import { DeliveryTrackingForm } from "./delivery-tracking-form";

export const dynamic = "force-dynamic";

export default async function AdminDeliveryPage(props: { params: Promise<{ id: string }> }) {
  const { id: jobId } = await props.params;

  const authClient = await createClient();
  const { data: authData } = await authClient.auth.getClaims();
  const access = resolveAdminAccess(authData?.claims);
  if (!access.authenticated) {
    redirect(`/auth/login?next=/admin/jobs/${jobId}/delivery`);
  }
  if (!access.allowed) {
    redirect("/admin?error=forbidden");
  }

  const supabase = createAdminClient();
  const { data: job } = await supabase
    .from("jobs")
    .select(
      "id, quote_id, status, delivery_provider, delivery_tracking_url, delivery_tracking_number, delivery_dispatched_at, delivery_notes, leads(fulfillment_mode, customers(display_name))"
    )
    .eq("id", jobId)
    .maybeSingle();
  if (!job) notFound();

  const lead = Array.isArray(job.leads) ? job.leads[0] : job.leads;
  const customer = lead ? (Array.isArray(lead.customers) ? lead.customers[0] : lead.customers) : null;

  if (lead?.fulfillment_mode !== "delivery") {
    return (
      <div className="mx-auto max-w-2xl space-y-3 p-6">
        <h1 className="text-lg font-semibold text-slate-950">งานนี้ไม่ใช่งานส่งของ</h1>
        <p className="text-sm text-slate-600">
          /admin/jobs/[id]/delivery ใช้ได้เฉพาะงานที่ลูกค้าเลือก fulfillment_mode = delivery
        </p>
        <a href="/admin" className="text-sm font-semibold text-sky-700 underline">
          กลับหน้าหลัก
        </a>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <header className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          การส่งของ
        </p>
        <h1 className="text-xl font-semibold text-slate-950">
          ลิงก์ติดตามพัสดุ: {customer?.display_name ?? "ลูกค้าไม่ระบุชื่อ"}
        </h1>
        <p className="text-xs text-slate-500">
          job id: <code className="font-mono">{job.id}</code> · job status: {job.status}
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-950">ข้อมูลการจัดส่ง</h2>
        <p className="mt-1 text-xs text-slate-500">
          จองรอบส่งจาก Lalamove / Grab / Kerry / ฯลฯ ก่อน แล้วเอา tracking URL มาวางที่นี่ —
          ลูกค้าจะเปิดดูสถานะส่งจากหน้า status ของตัวเอง
        </p>
        <div className="mt-4">
          <DeliveryTrackingForm
            jobId={job.id}
            initial={{
              provider: (job.delivery_provider as string | null) ?? null,
              trackingUrl: (job.delivery_tracking_url as string | null) ?? null,
              trackingNumber: (job.delivery_tracking_number as string | null) ?? null,
              dispatchedAt: (job.delivery_dispatched_at as string | null) ?? null,
              notes: (job.delivery_notes as string | null) ?? null,
            }}
          />
        </div>
      </section>
    </div>
  );
}
