import Link from "next/link";

import SettingsForm from "../settings-form";

export const dynamic = "force-dynamic";

export default function AdminAiSettingsPage() {
  return (
    <div className="px-4 py-6 text-slate-900">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4 rounded-[32px] bg-[#2a1842] px-6 py-6 text-white shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-violet-200">AI Configuration</p>
            <h1 className="mt-2 text-2xl font-bold">AI Provider &amp; Credentials</h1>
            <p className="mt-2 max-w-2xl text-sm text-violet-100/90">
              หน้านี้แยกไว้สำหรับตั้งค่า OpenAI และ Google AI Studio โดยเฉพาะ เพื่อไม่ให้ secret/config ปนกับ settings ด้าน LINE, payment และ asset runtime
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/admin/prompts" className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15">
              ไป Prompt Workbench
            </Link>
            <Link href="/admin/settings" className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15">
              กลับไป Settings
            </Link>
          </div>
        </div>

        <SettingsForm mode="ai" />
      </div>
    </div>
  );
}