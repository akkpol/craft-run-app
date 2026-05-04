import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { buildAdminLoginRedirect } from "@/lib/admin-auth-flow";
import { getAdminAllowedEmails, normalizeAdminEmail } from "@/lib/admin-access";
import { resolveAdminAccess } from "@/lib/admin-auth";
import { formatBangkokDateTime } from "@/lib/bangkok-date-time";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type StaffUser = {
  id: string;
  email?: string;
  created_at?: string;
  last_sign_in_at?: string | null;
  email_confirmed_at?: string | null;
  user_metadata?: Record<string, unknown>;
};

function displayName(user: StaffUser | null, email: string) {
  const metadata = user?.user_metadata || {};
  const candidates = [metadata.full_name, metadata.display_name, metadata.name];
  const found = candidates.find((value): value is string => typeof value === "string" && value.trim().length > 0);
  return found?.trim() || email.split("@")[0];
}

function formatDate(value: string | null | undefined) {
  return value ? formatBangkokDateTime(value) : "ยังไม่มีข้อมูล";
}

export default async function AdminStaffPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    redirect("/auth/login");
  }

  const access = resolveAdminAccess({ email: data.user.email ?? null });
  if (!access.allowed) {
    redirect(buildAdminLoginRedirect("/admin/staff", access.loginErrorCode ?? undefined));
  }

  const allowedEmails = getAdminAllowedEmails();
  const adminClient = createAdminClient();
  const { data: listData, error: listError } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 200 });
  const users = (listData?.users || []) as StaffUser[];
  const userByEmail = new Map(
    users
      .map((user) => [normalizeAdminEmail(user.email), user] as const)
      .filter((entry): entry is readonly [string, StaffUser] => Boolean(entry[0]))
  );

  return (
    <div className="px-4 py-6 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-700">Staff Access</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-950">พนักงานและสิทธิ์หลังบ้าน</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            หน้านี้แสดงบัญชีที่อยู่ใน admin allowlist และสถานะ Supabase Auth เพื่อให้รู้ว่าใครเข้าใช้งานหลังบ้านได้จริง
          </p>
          {listError ? (
            <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              อ่าน user list จาก Supabase Auth ไม่สำเร็จ แต่ยังแสดง allowlist จาก environment ได้
            </p>
          ) : null}
        </section>

        <section className="grid gap-4">
          {allowedEmails.map((email) => {
            const user = userByEmail.get(email) || null;
            const isCurrentUser = normalizeAdminEmail(data.user.email) === email;

            return (
              <article key={email} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold text-slate-950">{displayName(user, email)}</h2>
                      <Badge className={user ? "border border-emerald-200 bg-emerald-50 text-emerald-800" : "border border-amber-200 bg-amber-50 text-amber-800"}>
                        {user ? "มี user ใน Auth" : "อยู่ใน allowlist แต่ยังไม่พบ user"}
                      </Badge>
                      {isCurrentUser ? <Badge className="border border-sky-200 bg-sky-50 text-sky-800">บัญชีที่ใช้อยู่</Badge> : null}
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{email}</p>
                  </div>
                  <Link href="/admin/profile" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                    โปรไฟล์ของฉัน
                  </Link>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold text-slate-500">สร้างบัญชี</p>
                    <p className="mt-1 text-sm text-slate-900">{formatDate(user?.created_at)}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold text-slate-500">เข้าใช้งานล่าสุด</p>
                    <p className="mt-1 text-sm text-slate-900">{formatDate(user?.last_sign_in_at)}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold text-slate-500">ยืนยันอีเมล</p>
                    <p className="mt-1 text-sm text-slate-900">{user?.email_confirmed_at ? "ยืนยันแล้ว" : "ยังไม่ยืนยันหรือยังไม่มี user"}</p>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </div>
  );
}
