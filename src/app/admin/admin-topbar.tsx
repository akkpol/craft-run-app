import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

type AdminTopbarProps = {
  userName: string;
};

export default function AdminTopbar({ userName }: AdminTopbarProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/84 backdrop-blur">
      <div className="flex min-h-(--header-height) items-center justify-between gap-3 px-3 md:px-4 xl:px-6">
        <div className="flex min-w-0 items-center gap-2.5 md:gap-3">
          <SidebarTrigger className="-ml-1 shrink-0" />
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

        <p className="hidden rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs text-slate-500 xl:block">
          Sidebar นี้ครอบทุกหน้าใน `/admin` แล้ว
        </p>
      </div>
    </header>
  );
}