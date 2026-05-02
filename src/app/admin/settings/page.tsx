import Link from "next/link";
import SettingsForm from "./settings-form";

export const dynamic = "force-dynamic";

export default function AdminSettingsPage() {
  return (
    <div className="px-4 py-6 text-slate-900">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4 rounded-[32px] bg-[#1a1a2e] px-6 py-6 text-white shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-300">Admin Setup</p>
            <h1 className="mt-2 text-2xl font-bold">System Settings</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              หน้านี้มีไว้ให้เจ้าของระบบกรอกค่าที่จำเป็นสำหรับ LINE Messaging API, LINE MINI App (ผ่าน LIFF SDK) และ Base URL โดยไม่ต้องแก้ไฟล์ env ใน repo
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/admin" className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15">
              กลับไป Dashboard
            </Link>
            <Link href="/admin/profile" className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15">
              โปรไฟล์ผู้ดูแล
            </Link>
          </div>
        </div>

        <SettingsForm />
      </div>
    </div>
  );
}