"use client";

import type { AdminOverviewPage } from "@/lib/admin-overview";
import type { BackofficeAutomationSnapshot } from "@/lib/backoffice-automation";

import {
  AdminSectionBlock as SurfaceSection,
  OverviewCombinedQueueTable,
  AdminSummaryStripBlock as SummaryStrip,
} from "./admin-dashboard-sections";

type DashboardProps = {
  baseUrl: string;
  automation: BackofficeAutomationSnapshot;
  overview: AdminOverviewPage;
};

export default function AdminDashboardClient({ baseUrl, automation, overview }: DashboardProps) {
  return (
    <div className="pb-8 pt-3 text-slate-900">
      <div className="px-4">
        <div className="space-y-3">
          <SummaryStrip
            items={[
              {
                label: "ระบบดูแลอยู่",
                value: automation.summary.activeManagedCount,
                hint: "จำนวน lead, quote และ job ที่ยังอยู่ใน flow ปัจจุบัน",
                tone: "neutral",
              },
              {
                label: "ไหลต่ออัตโนมัติ",
                value: automation.summary.autoFlowingCount,
                hint: "item ที่ตอนนี้ยังไม่ต้องให้คนเข้า override หรือ review",
                tone: "success",
              },
              {
                label: "ต้องให้คนตัดสินใจ",
                value: automation.summary.needsHumanNowCount,
                hint: "manual review, escalation, payment gate และ production evidence ที่ยังค้าง",
                tone: "danger",
              },
              {
                label: "รอลูกค้า",
                value: automation.summary.waitingOnCustomerCount,
                hint: "คิวที่ flow ยังเดินต่อไม่ได้เพราะกำลังรอข้อมูลหรือ feedback จากลูกค้า",
                tone: "warning",
              },
            ]}
          />

          <SurfaceSection
            title="ตารางหลักของงานทั้งหมด"
            description="รวมทั้งคิวที่ต้องให้คนช่วยจัดการและงานที่กำลังรันอยู่ไว้ในตารางเดียว แล้วค่อยกรองดูตามชนิดงาน"
            count={overview.totalCount}
          >
            <OverviewCombinedQueueTable overview={overview} baseUrl={baseUrl} />
          </SurfaceSection>
        </div>
      </div>
    </div>
  );
}

