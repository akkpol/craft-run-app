import Link from "next/link";

import ManualIntakeForm from "./manual-intake-form";

export const dynamic = "force-dynamic";

export default function AdminManualIntakePage() {
  return (
    <div className="px-4 py-6 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <Link href="/admin" prefetch={false} className="text-sm font-medium text-slate-500 hover:text-slate-700">
            กลับ CRM
          </Link>
          <div className="mt-4 max-w-3xl">
            <h1 className="text-2xl font-bold text-slate-950">รับงานด้วยตนเอง</h1>
            <p className="mt-1.5 text-sm text-slate-500">
              สำหรับลูกค้าที่ติดต่อมาจากหน้าร้าน โทรศัพท์ Facebook หรือช่องทางอื่นนอก LINE
            </p>
          </div>
        </section>

        <ManualIntakeForm />
      </div>
    </div>
  );
}
