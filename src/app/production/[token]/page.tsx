import { createAdminClient } from "@/lib/supabase/admin";
import { getRuntimeAppConfig } from "@/lib/app-settings";
import { resolveProductionToken } from "@/lib/production-media";
import { JOB_STATUS_LABELS, PRODUCT_TYPES } from "@/lib/types";
import ProductionUploadForm from "./production-upload-form";

export const dynamic = "force-dynamic";

function InvalidLinkState() {
  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-md rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold">ลิงก์นี้ใช้งานไม่ได้</h1>
        <p className="mt-2 text-sm text-slate-600">
          ลิงก์อาจหมดอายุ ถูกยกเลิก หรือไม่ถูกต้อง กรุณาติดต่อแอดมินเพื่อรับลิงก์ใหม่
        </p>
      </div>
    </div>
  );
}

export default async function ProductionPage(props: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await props.params;
  const [runtimeConfig, resolved] = await Promise.all([
    getRuntimeAppConfig(),
    resolveProductionToken(createAdminClient(), token),
  ]);

  if (!resolved) {
    return <InvalidLinkState />;
  }

  const lead = Array.isArray(resolved.job?.quotes?.leads)
    ? resolved.job?.quotes?.leads[0]
    : resolved.job?.quotes?.leads;
  const customer = Array.isArray(lead?.customers) ? lead?.customers[0] : lead?.customers;
  const productLabel =
    PRODUCT_TYPES.find((product) => product.value === lead?.product_type)?.label ||
    lead?.product_type ||
    "ไม่ระบุสินค้า";

  return (
    <div
      className="min-h-screen bg-[linear-gradient(180deg,#e2e8f0_0%,#f8fafc_35%,#ffffff_100%)] px-4 py-6 text-slate-900"
      style={{ paddingBottom: "calc(24px + env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto max-w-md space-y-4">
        <div className="overflow-hidden rounded-[30px] border border-slate-900/10 bg-[#0f172a] text-white shadow-[0_24px_70px_rgba(15,23,42,0.18)]">
          <div className="px-6 py-6">
            <p className="text-xs uppercase tracking-[0.28em] text-slate-300">
              Production Link
            </p>
            <h1 className="mt-2 text-2xl font-bold">
              {customer?.display_name || "งานหน้างาน"}
            </h1>
            <p className="mt-2 text-sm text-slate-300">
              ส่งรูป proof, ready for production หรือ completed เข้าระบบได้ทันทีจากมือถือ
            </p>
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Job</p>
              <p className="mt-1 text-lg font-semibold text-slate-950">{productLabel}</p>
            </div>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
              {resolved.job?.status ? JOB_STATUS_LABELS[resolved.job.status as keyof typeof JOB_STATUS_LABELS] || resolved.job.status : "IN_PRODUCTION"}
            </span>
          </div>
          <dl className="mt-4 space-y-2 text-sm text-slate-600">
            <div className="flex items-center justify-between gap-3">
              <dt>ชื่อลูกค้า</dt>
              <dd className="font-medium text-slate-900">
                {customer?.display_name || "ไม่ระบุ"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt>สถานะ upload</dt>
              <dd className="font-medium text-slate-900">
                {runtimeConfig.productionUploadEnabled ? "เปิดใช้งาน" : "ปิดชั่วคราว"}
              </dd>
            </div>
          </dl>
        </div>

        {!runtimeConfig.productionUploadEnabled ? (
          <div className="rounded-[28px] border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800 shadow-sm">
            ระบบปิดรับ upload ชั่วคราว กรุณาติดต่อแอดมินเพื่อส่งงานผ่านช่องทาง fallback
          </div>
        ) : (
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">ส่งหลักฐานงาน</h2>
            <p className="mt-1 text-sm text-slate-500">
              หลักฐานที่ส่งเข้ามาจะยังไม่ถูกส่งถึงลูกค้าทันที จนกว่าแอดมินจะตรวจสอบ
            </p>
            <div className="mt-5">
              <ProductionUploadForm token={token} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
