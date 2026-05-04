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
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">Manual Intake</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-950">รับงานลูกค้าที่ไม่ได้มาจาก LINE</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              ใช้สำหรับลูกค้าหน้าร้าน โทรศัพท์ Facebook อีเมล หรือช่องทางอื่น ระบบจะสร้าง customer, conversation และ lead ให้เข้าคิวหลังบ้านโดยไม่ต้องปลอม LIFF identity
            </p>
          </div>
        </section>

        <ManualIntakeForm />
      </div>
    </div>
  );
}
