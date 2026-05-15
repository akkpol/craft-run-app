import { notFound, redirect } from "next/navigation";

import { resolveAdminAccess } from "@/lib/admin-auth";
import { createPickupProofSignedUrl } from "@/lib/pickup-proof-storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import { PickupProofForm } from "./pickup-proof-form";

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

const STATUS_LABEL: Record<string, string> = {
  not_ready: "ยังไม่พร้อมส่งมอบ",
  ready: "พร้อมให้มารับ",
  picked_up: "ลูกค้ารับเรียบร้อย",
  delivered: "ส่งมอบแล้ว",
};

export default async function AdminPickupPage(props: { params: Promise<{ id: string }> }) {
  const { id: jobId } = await props.params;

  const authClient = await createClient();
  const { data: authData } = await authClient.auth.getClaims();
  const access = resolveAdminAccess(authData?.claims);
  if (!access.authenticated) {
    redirect(`/auth/login?next=/admin/jobs/${jobId}/pickup`);
  }
  if (!access.allowed) {
    redirect("/admin?error=forbidden");
  }

  const supabase = createAdminClient();
  const { data: job } = await supabase
    .from("jobs")
    .select(
      "id, quote_id, status, fulfillment_status, picked_up_at, pickup_recipient_name, pickup_recipient_phone, pickup_proof_paths, leads(fulfillment_mode, customers(display_name, phone))"
    )
    .eq("id", jobId)
    .maybeSingle();
  if (!job) notFound();

  const lead = Array.isArray(job.leads) ? job.leads[0] : job.leads;
  const customer = lead
    ? Array.isArray(lead.customers)
      ? lead.customers[0]
      : lead.customers
    : null;

  if (lead?.fulfillment_mode !== "pickup") {
    return (
      <div className="mx-auto max-w-2xl space-y-3 p-6">
        <h1 className="text-lg font-semibold text-slate-950">งานนี้ไม่ใช่งานมารับเอง</h1>
        <p className="text-sm text-slate-600">
          /admin/jobs/[id]/pickup ใช้ได้เฉพาะงานที่ลูกค้าเลือก fulfillment_mode = pickup
        </p>
        <a href="/admin" className="text-sm font-semibold text-sky-700 underline">
          กลับหน้าหลัก
        </a>
      </div>
    );
  }

  const proofPaths: string[] = job.pickup_proof_paths ?? [];
  const signedUrls = await Promise.all(
    proofPaths.map((path) => createPickupProofSignedUrl(path, 60 * 10))
  );

  const isClosed =
    job.fulfillment_status === "picked_up" ||
    job.fulfillment_status === "delivered";

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <header className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          ลูกค้ามารับเอง
        </p>
        <h1 className="text-xl font-semibold text-slate-950">
          บันทึกการรับสินค้า: {customer?.display_name ?? "ลูกค้าไม่ระบุชื่อ"}
        </h1>
        <p className="text-xs text-slate-500">
          job id: <code className="font-mono">{job.id}</code> · job status: {job.status}
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-950">สถานะปัจจุบัน</h2>
        <dl className="mt-3 grid gap-2 text-sm md:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">fulfillment_status</dt>
            <dd className="text-slate-900">
              {STATUS_LABEL[job.fulfillment_status ?? "not_ready"] ?? job.fulfillment_status}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">เวลารับ</dt>
            <dd className="text-slate-900">{formatBangkokDateTime(job.picked_up_at)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">ชื่อผู้รับ</dt>
            <dd className="text-slate-900">{job.pickup_recipient_name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">เบอร์ผู้รับ</dt>
            <dd className="text-slate-900">{job.pickup_recipient_phone ?? "—"}</dd>
          </div>
        </dl>
      </section>

      {isClosed ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-emerald-950">บันทึกเรียบร้อย — งานนี้ปิดการส่งมอบแล้ว</h2>
          <p className="mt-1 text-xs text-emerald-900/80">
            ต้องการอัปโหลดเพิ่มหรือแก้ข้อมูลผู้รับ — ติดต่อ admin หลักเพื่อเปิด case
          </p>
        </section>
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-950">บันทึกการรับ</h2>
          <p className="mt-1 text-xs text-slate-500">
            ถ่ายรูปขณะส่งมอบของ + พิมพ์ชื่อผู้รับ → กด &ldquo;บันทึกและปิดงาน&rdquo;
            เพื่อ flip สถานะเป็น picked_up อัตโนมัติ
          </p>
          <div className="mt-4">
            <PickupProofForm
              jobId={job.id}
              defaultRecipientName={
                job.pickup_recipient_name ?? customer?.display_name ?? null
              }
              defaultRecipientPhone={job.pickup_recipient_phone ?? customer?.phone ?? null}
            />
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-950">
          หลักฐานการรับ ({proofPaths.length} ไฟล์)
        </h2>
        {proofPaths.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">ยังไม่มีหลักฐาน</p>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
            {proofPaths.map((path, idx) => {
              const url = signedUrls[idx];
              const isPdf = path.toLowerCase().endsWith(".pdf");
              return (
                <a
                  key={path}
                  href={url ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block overflow-hidden rounded-xl border border-slate-200 bg-white"
                >
                  {isPdf ? (
                    <div className="flex aspect-square items-center justify-center bg-slate-100 text-xs text-slate-600">
                      📄 PDF #{idx + 1}
                    </div>
                  ) : url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={url}
                      alt={`pickup proof ${idx + 1}`}
                      className="aspect-square h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex aspect-square items-center justify-center text-xs text-slate-500">
                      ไม่สามารถโหลด
                    </div>
                  )}
                </a>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
