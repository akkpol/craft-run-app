"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CircleHelpIcon,
  CircleUserRoundIcon,
  ClipboardCheckIcon,
  CommandIcon,
  LayoutDashboardIcon,
  Settings2Icon,
  SmartphoneIcon,
  ScrollTextIcon,
} from "lucide-react";

import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";

type AdminSidebarProps = {
  user: {
    name: string;
    email: string;
    avatar: string;
  };
};

const primaryItems = [
  {
    title: "CRM Inbox",
    href: "/admin",
    icon: LayoutDashboardIcon,
    isActive: (pathname: string) => pathname === "/admin",
  },
  {
    title: "Customer Waiting",
    href: "/admin/follow-up",
    icon: ClipboardCheckIcon,
    isActive: (pathname: string) => pathname.startsWith("/admin/follow-up"),
  },

  {
    title: "Intake Ops",
    href: "/admin/liff-monitor",
    icon: SmartphoneIcon,
    isActive: (pathname: string) => pathname.startsWith("/admin/liff-monitor"),
  },
  {
    title: "Finance & Documents",
    href: "/admin/accounting",
    icon: ScrollTextIcon,
    isActive: (pathname: string) => pathname.startsWith("/admin/accounting"),
  },
  {
    title: "Teams & Profiles",
    href: "/admin/profile",
    icon: CircleUserRoundIcon,
    isActive: (pathname: string) => pathname.startsWith("/admin/profile"),
  },
] as const;

const secondaryItems = [
  {
    title: "Automation Settings",
    href: "/admin/settings",
    icon: Settings2Icon,
    isActive: (pathname: string) => pathname.startsWith("/admin/settings"),
    external: false,
  },
  {
    title: "Flow Reference",
    href: "/flow",
    icon: CircleHelpIcon,
    isActive: (pathname: string) => pathname.startsWith("/flow"),
    external: true,
  },
] as const;

export default function AdminSidebar({ user }: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <Sidebar variant="inset" collapsible="offcanvas">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              size="lg"
              className="bg-[linear-gradient(135deg,rgba(0,174,239,0.18),rgba(15,118,110,0.08))] text-sidebar-foreground"
            >
              <Link href="/admin" prefetch={false}>
                <span className="flex size-8 items-center justify-center rounded-2xl bg-slate-950 text-white">
                  <CommandIcon className="size-4" />
                </span>
                <span className="flex flex-col">
                  <span className="text-sm font-semibold">FOGUS Print & Sign</span>
                  <span className="text-xs text-sidebar-foreground/70">B2B operations</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Operations</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {primaryItems.map((item) => {
                const Icon = item.icon;

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={item.isActive(pathname)} tooltip={item.title}>
                      <Link href={item.href} prefetch={false}>
                        <Icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup className="mt-auto">
          <SidebarGroupLabel>Configuration</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {secondaryItems.map((item) => {
                const Icon = item.icon;

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={item.isActive(pathname)} tooltip={item.title}>
                      {item.external ? (
                        <a href={item.href} target="_blank" rel="noreferrer">
                          <Icon />
                          <span>{item.title}</span>
                        </a>
                      ) : (
                        <Link href={item.href} prefetch={false}>
                          <Icon />
                          <span>{item.title}</span>
                        </Link>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}