import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

type AdminTopbarProps = {
  userName: string;
};

export default function AdminTopbar({ userName }: AdminTopbarProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/78 backdrop-blur">
      <div className="flex min-h-(--header-height) items-center justify-between gap-3 px-4 lg:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mx-1 hidden data-[orientation=vertical]:h-4 sm:block"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-950">FOGUS Backoffice</p>
            <p className="truncate text-xs text-slate-500">
              พร้อมทำงานในชื่อ {userName}
            </p>
          </div>
        </div>

        <p className="hidden text-xs text-slate-500 lg:block">
          Sidebar นี้ครอบทุกหน้าใน `/admin` แล้ว
        </p>
      </div>
    </header>
  );
}