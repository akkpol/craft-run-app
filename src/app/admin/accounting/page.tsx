import Link from "next/link";
import { getAdminQueueContract } from "@/lib/admin-queue-contract";

export const dynamic = "force-dynamic";

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

export default async function AdminAccountingPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;
  const month = normalizeMonth(firstValue(searchParams.month));
  const exportHref = `/api/admin/accounting/monthly?month=${encodeURIComponent(month)}`;
  const paymentOpsQueue = getAdminQueueContract("payment-ops");
  const commercialGateQueue = getAdminQueueContract("commercial-gate");

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
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">
              {paymentOpsQueue.ownerLabel}
            </p>
            <h1 className="mt-2 text-2xl font-bold text-slate-950">Finance &amp; Documents Export</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              ดาวน์โหลด CSV รายเดือนจาก quote, payment tracking, และข้อมูลออกเอกสารที่เก็บจาก
              LIFF intake เพื่อส่งต่อให้นักบัญชีได้เป็นชุดเดียว โดยยังไม่ต้องสร้าง invoice runtime
              เต็มระบบก่อน
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 font-medium text-slate-700">
                {paymentOpsQueue.label}
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 font-medium text-slate-700">
                {commercialGateQueue.label}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <section className="admin-panel rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <form className="grid gap-4 md:grid-cols-[minmax(0,220px)_1fr] md:items-end">
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              เดือนที่ต้องการส่งนักบัญชี
              <input
                type="month"
                name="month"
                defaultValue={month}
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
                ดาวน์โหลด CSV เดือน {month}
              </a>
            </div>
          </form>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-sm font-semibold text-slate-950">สิ่งที่ export แล้ว</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                <li>Quote totals และสถานะการชำระ</li>
                <li>Document / billing identity ที่ลูกค้าให้ไว้</li>
                <li>Payment tracking timestamps และ proof reference</li>
                <li>Payment profile snapshot ที่ quote ใช้อยู่ตอนนั้น</li>
              </ul>
            </div>

            <div className="rounded-3xl border border-amber-200 bg-amber-50/70 p-4">
              <p className="text-sm font-semibold text-amber-950">ยังไม่รวมใน packet นี้</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-amber-900/80">
                <li>เลข invoice / receipt / tax invoice runtime</li>
                <li>การ sync ไปโปรแกรมบัญชีภายนอก</li>
                <li>payment gateway หรือ webhook ยืนยันจ่ายอัตโนมัติ</li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}