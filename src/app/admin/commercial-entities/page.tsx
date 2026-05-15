import { redirect } from "next/navigation";

import { resolveAdminAccess } from "@/lib/admin-auth";
import { createClient } from "@/lib/supabase/server";

import { CommercialEntitiesEditor } from "./commercial-entities-editor";

export const dynamic = "force-dynamic";

export default async function AdminCommercialEntitiesPage() {
  const authClient = await createClient();
  const { data: authData } = await authClient.auth.getClaims();
  const access = resolveAdminAccess(authData?.claims);
  if (!access.authenticated) {
    redirect("/auth/login?next=/admin/commercial-entities");
  }
  if (!access.allowed) {
    redirect("/admin?error=forbidden");
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-6">
      <header className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Backoffice / ผู้รับเงิน
        </p>
        <h1 className="text-xl font-semibold text-slate-950">
          ผู้รับเงิน / Commercial Entities
        </h1>
        <p className="text-xs text-slate-500">
          แต่ละ entity คือ &ldquo;ใครรับเงินและใครออกเอกสาร&rdquo; — บริษัทหลัก, บริษัทย่อย,
          บัญชีบุคคลของเจ้าของร้าน ฯลฯ — สำหรับ commerce flow ทั้งระบบ
        </p>
      </header>

      <CommercialEntitiesEditor />
    </div>
  );
}
