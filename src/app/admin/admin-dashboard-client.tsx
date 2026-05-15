"use client";

import type { AdminOverviewPage } from "@/lib/admin-overview";
import type { BackofficeAutomationSnapshot } from "@/lib/backoffice-automation";
import type { DashboardTrendPoint } from "@/lib/dashboard-trends";

import {
  AdminSectionBlock as SurfaceSection,
  OverviewCombinedQueueTable,
} from "./admin-dashboard-sections";
import { DashboardTrendChart } from "./DashboardTrendChart";

type DashboardProps = {
  baseUrl: string;
  automation: BackofficeAutomationSnapshot;
  overview: AdminOverviewPage;
  trends: DashboardTrendPoint[];
};

const severityDotClassName = {
  healthy: "bg-emerald-500",
  info: "bg-sky-500",
  warning: "bg-amber-500",
  critical: "bg-rose-500",
} as const;

const severityChipClassName = {
  healthy: "border-emerald-200 bg-emerald-50 text-emerald-800",
  info: "border-sky-200 bg-sky-50 text-sky-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  critical: "border-rose-200 bg-rose-50 text-rose-800",
} as const;

export default function AdminDashboardClient({
  baseUrl,
  automation,
  overview,
  trends,
}: DashboardProps) {
  const totalLaneCount = automation.lanes.reduce((total, lane) => total + lane.count, 0);

  return (
    <div className="pb-8 pt-3 text-slate-900">
      <div className="px-4">
        <div className="space-y-3">
          <DashboardTrendChart trends={trends} />

          <SurfaceSection
            title="Automation lanes"
            description="คอขวดตาม owner — ดูได้แวบเดียวว่าคิวไหนมีของค้าง"
            count={totalLaneCount}
          >
            <div className="flex flex-wrap gap-2">
              {automation.lanes.map((lane) => (
                <span
                  key={lane.key}
                  title={lane.description}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${severityChipClassName[lane.severity]}`}
                >
                  <span
                    aria-hidden
                    className={`inline-block size-1.5 rounded-full ${severityDotClassName[lane.severity]}`}
                  />
                  <span>{lane.label}</span>
                  <span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[11px] font-semibold text-slate-900">
                    {lane.count}
                  </span>
                </span>
              ))}
            </div>
          </SurfaceSection>

          <SurfaceSection
            title="CRM inbox ของงานทั้งหมด"
            description="รวมคิวตาม owner และ readiness stage ไว้ในตารางเดียว แล้วค่อยกรองต่อว่าทีมไหนควรขยับงานนี้ก่อน"
            count={overview.totalCount}
          >
            <OverviewCombinedQueueTable overview={overview} baseUrl={baseUrl} />
          </SurfaceSection>
        </div>
      </div>
    </div>
  );
}
