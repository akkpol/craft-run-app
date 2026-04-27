import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LogoutButton } from "@/components/logout-button";
import { Badge } from "@/components/ui/badge";
import {
  getAdminAllowedEmails,
  hasConfiguredAdminAllowlist,
  isAdminEmailAllowed,
} from "@/lib/admin-access";
import { createClient } from "@/lib/supabase/server";

import ProfileEditor from "./profile-editor";

export const dynamic = "force-dynamic";

function getDisplayName(user: User) {
  const candidates = [
    user.user_metadata?.full_name,
    user.user_metadata?.display_name,
    user.user_metadata?.name,
  ];

  const displayName = candidates.find(
    (candidate): candidate is string =>
      typeof candidate === "string" && candidate.trim().length > 0
  );

  if (displayName) {
    return displayName.trim();
  }

  if (user.email) {
    return user.email.split("@")[0];
  }

  return "Admin User";
}

function getInitials(displayName: string, email: string | null) {
  const source = displayName || email || "Admin";
  const parts = source
    .replace(/@.*/, "")
    .split(/[^a-zA-Z0-9ก-๙]+/)
    .filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatProviderList(user: User) {
  const providers = Array.isArray(user.app_metadata?.providers)
    ? user.app_metadata.providers
    : [];

  if (providers.length === 0) {
    return "Email / Password";
  }

  return providers
    .map((provider) => (provider === "email" ? "Email / Password" : provider))
    .join(", ");
}

function compactId(value: string) {
  if (value.length <= 18) {
    return value;
  }

  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

function ProfileField({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <div className="rounded-[20px] border border-slate-200 bg-slate-50/80 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 wrap-break-word text-sm font-medium text-slate-950">{value}</p>
      {helper ? <p className="mt-2 text-xs leading-5 text-slate-500">{helper}</p> : null}
    </div>
  );
}

function QuickLink({
  href,
  label,
  description,
}: {
  href: string;
  label: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-[20px] border border-slate-200 bg-white px-4 py-3 transition hover:border-slate-300 hover:bg-slate-50"
    >
      <p className="text-sm font-semibold text-slate-950">{label}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
    </Link>
  );
}

export default async function AdminProfilePage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    redirect("/auth/login");
  }

  const user = data.user;
  const email = user.email ?? null;
  const displayName = getDisplayName(user);
  const adminAllowed = isAdminEmailAllowed(email);
  const allowlistConfigured = hasConfiguredAdminAllowlist();
  const allowedEmailsCount = getAdminAllowedEmails().length;
  const avatarUrl =
    typeof user.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url : "";

  return (
    <div className="px-4 py-6 text-slate-900">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="overflow-hidden rounded-[32px] bg-[linear-gradient(135deg,#0f172a_0%,#172554_55%,#0f766e_100%)] px-6 py-6 text-white shadow-[0_24px_60px_rgba(15,23,42,0.22)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-300">
                Admin Profile
              </p>
              <h1 className="mt-2 text-2xl font-bold">โปรไฟล์ผู้ดูแลระบบ</h1>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                สรุปบัญชีที่ใช้เข้าหลังบ้าน สิทธิ์การเข้าถึง และทางลัดไปยังจุดที่ต้องใช้งานบ่อย
                โดยไม่เพิ่ม schema หรือ flow ใหม่ให้ระบบซับซ้อนขึ้น
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/admin"
                className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15"
              >
                Dashboard
              </Link>
              <Link
                href="/admin/settings"
                className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15"
              >
                Settings
              </Link>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge variant={adminAllowed ? "success" : "warning"} className="border-none">
              {adminAllowed ? "บัญชีนี้ผ่าน allowlist" : "บัญชีนี้ยังไม่ผ่าน allowlist"}
            </Badge>
            <Badge variant={user.email_confirmed_at ? "info" : "warning"} className="border-none">
              {user.email_confirmed_at ? "ยืนยันอีเมลแล้ว" : "อีเมลยังไม่ยืนยัน"}
            </Badge>
            <Badge variant="outline" className="border-white/20 bg-white/10 text-white">
              {formatProviderList(user)}
            </Badge>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_360px]">
          <section className="admin-panel p-6">
            <div className="flex flex-wrap items-start gap-4">
              <div className="flex h-18 w-18 shrink-0 items-center justify-center rounded-[24px] bg-[linear-gradient(135deg,#00AEEF_0%,#0f766e_100%)] text-xl font-semibold text-white shadow-[0_14px_30px_rgba(0,94,140,0.18)]">
                {getInitials(displayName, email)}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Current Session
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                  {displayName}
                </h2>
                <p className="mt-1 wrap-break-word text-sm text-slate-600">
                  {email || "ไม่พบอีเมลใน session ปัจจุบัน"}
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <ProfileField
                label="อีเมล"
                value={email || "-"}
                helper="บัญชีนี้ถูกใช้ตรวจสิทธิ์ allowlist ก่อนเข้าหน้าหลังบ้าน"
              />
              <ProfileField
                label="ชื่อที่แสดง"
                value={displayName}
                helper="ดึงจาก Supabase Auth metadata ถ้ามี ไม่ได้สร้างตารางโปรไฟล์เพิ่ม"
              />
              <ProfileField
                label="User ID"
                value={compactId(user.id)}
                helper="ใช้เป็น reference เวลา trace incident หรือดู action_log"
              />
              <ProfileField
                label="วิธีล็อกอิน"
                value={formatProviderList(user)}
                helper="การจัดการรหัสผ่านและ invitation อยู่ที่ Supabase Auth"
              />
              <ProfileField
                label="สร้างบัญชีเมื่อ"
                value={formatDateTime(user.created_at)}
              />
              <ProfileField
                label="เข้าใช้งานครั้งล่าสุด"
                value={formatDateTime(user.last_sign_in_at)}
              />
            </div>

            <div className="mt-6">
              <ProfileEditor
                initialDisplayName={displayName}
                initialAvatarUrl={avatarUrl}
              />
            </div>
          </section>

          <div className="space-y-6">
            <section className="admin-panel p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Access Status
              </p>
              <div className="mt-4 space-y-3 text-sm text-slate-700">
                <div className="rounded-[20px] border border-slate-200 bg-slate-50/80 px-4 py-3">
                  <p className="font-semibold text-slate-950">
                    {allowlistConfigured
                      ? `พบ allowlist แล้ว ${allowedEmailsCount} บัญชี`
                      : "ยังไม่พบ allowlist ใน environment"}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    ระบบนี้ fail-closed และควรใช้ ADMIN_ALLOWED_EMAILS เป็นตัวหลักสำหรับ production
                  </p>
                </div>
                <div className="rounded-[20px] border border-slate-200 bg-slate-50/80 px-4 py-3">
                  <p className="font-semibold text-slate-950">
                    {adminAllowed ? "สิทธิ์ของบัญชีนี้ใช้งานได้" : "สิทธิ์ของบัญชีนี้ต้องตรวจเพิ่ม"}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    ถ้าจะเพิ่มผู้ดูแลใหม่ ให้สร้าง user ใน Supabase Auth แล้วใส่อีเมลเดียวกันใน allowlist
                  </p>
                </div>
              </div>
            </section>

            <section className="admin-panel p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Quick Actions
              </p>
              <div className="mt-4 space-y-3">
                <QuickLink
                  href="/admin"
                  label="กลับไป Dashboard"
                  description="ดูคิว sales, design, production และ inbox จากหน้าหลักหลังบ้าน"
                />
                <QuickLink
                  href="/admin/settings"
                  label="ไปที่ Settings"
                  description="จัดการค่า LINE, LIFF, base URL และ config runtime อื่นของระบบ"
                />
              </div>
            </section>

            <section className="admin-panel p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Session Control
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                หากต้องสลับบัญชีหรือทดสอบ allowlist ด้วยผู้ใช้อื่น ให้ออกจากระบบจากปุ่มด้านล่างนี้
              </p>
              <div className="mt-4">
                <LogoutButton />
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}