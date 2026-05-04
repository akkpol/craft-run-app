import type { CSSProperties } from "react";
import { redirect } from "next/navigation";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { buildAdminLoginRedirect } from "@/lib/admin-auth-flow";
import { resolveAdminAccess } from "@/lib/admin-auth";
import { createClient } from "@/lib/supabase/server";

import AdminSidebar from "./admin-sidebar";
import AdminTopbar from "./admin-topbar";

function getDisplayName(email: string | null, userMetadata: Record<string, unknown> | null) {
  const candidates = [
    userMetadata?.full_name,
    userMetadata?.display_name,
    userMetadata?.name,
  ];

  const displayName = candidates.find(
    (candidate): candidate is string =>
      typeof candidate === "string" && candidate.trim().length > 0
  );

  if (displayName) {
    return displayName.trim();
  }

  return email?.split("@")[0] || "Admin User";
}

function getAvatarUrl(userMetadata: Record<string, unknown> | null) {
  const avatarValue = userMetadata?.avatar_url;
  return typeof avatarValue === "string" ? avatarValue : "";
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    redirect("/auth/login");
  }

  const user = data.user;
  const access = resolveAdminAccess({ email: user.email ?? null });
  if (!access.allowed) {
    redirect(
      buildAdminLoginRedirect("/admin", access.loginErrorCode ?? undefined)
    );
  }

  const displayName = getDisplayName(user.email ?? null, user.user_metadata ?? null);

  return (
    <TooltipProvider>
      <SidebarProvider
        className="admin-shell text-slate-900"
        style={
          {
            "--sidebar-width": "clamp(15rem, 22vw, calc(var(--spacing) * 74))",
            "--header-height": "calc(var(--spacing) * 13)",
          } as CSSProperties
        }
      >
        <AdminSidebar
          user={{
            name: displayName,
            email: user.email ?? "",
            avatar: getAvatarUrl(user.user_metadata ?? null),
          }}
        />
        <SidebarInset className="min-w-0 w-0 overflow-x-hidden bg-transparent md:peer-data-[variant=inset]:m-1.5 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-[20px] md:peer-data-[variant=inset]:bg-transparent md:peer-data-[variant=inset]:shadow-none lg:peer-data-[variant=inset]:m-2 lg:peer-data-[variant=inset]:ml-0 lg:peer-data-[variant=inset]:rounded-2xl">
          <AdminTopbar userName={displayName} />
          <div className="flex flex-1 flex-col">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
