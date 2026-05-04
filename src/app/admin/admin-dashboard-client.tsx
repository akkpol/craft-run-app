"use client";

import Link from "next/link";
import { getAdminQueueContract } from "@/lib/admin-queue-contract";
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
  const customerWaitingQueue = getAdminQueueContract("customer-waiting");
  const commercialGateQueue = getAdminQueueContract("commercial-gate");
  const severityToneClassName = {
    healthy: "border-emerald-200 bg-emerald-50/70",
    info: "border-sky-200 bg-sky-50/70",
    warning: "border-amber-200 bg-amber-50/80",
    critical: "border-rose-200 bg-rose-50/80",
  } as const;

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
                hint: "manual review ในคิว Exceptions, Payment Ops และ Design Ops ที่ยังค้าง",
                tone: "danger",
              },
              {
                label: customerWaitingQueue.label,
                value: automation.summary.waitingOnCustomerCount,
                hint: customerWaitingQueue.description,
                tone: "warning",
              },
              {
                label: commercialGateQueue.label,
                value: automation.summary.commercialGateCount,
                hint: commercialGateQueue.description,
                tone: automation.summary.commercialGateCount > 0 ? "danger" : "info",
              },
            ]}
          />

          <SurfaceSection
            title="ทางลัดงานหลังบ้าน"
            description="ปุ่มหลักที่ต้องใช้จริง: รับงานนอก LINE, เปิดโปรไฟล์ลูกค้า, ดูเอกสาร runtime, จัดการพรอมพ์ และดูทีมงาน"
            count={5}
          >
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              {[
                ["/admin/manual-intake", "รับงาน manual", "ลูกค้าหน้าร้าน โทร Facebook หรืออีเมล"],
                ["/admin/customers", "โปรไฟล์ลูกค้า", "Customer 360 และประวัติ lead/quote"],
                ["/admin/accounting", "เอกสาร / การเงิน", "receipt, tax invoice receipt และ export"],
                ["/admin/prompts", "พรอมพ์ / AI", "แก้ prompt และสั่ง preview จากทุก lead"],
                ["/admin/staff", "พนักงาน", "allowlist และสถานะบัญชีหลังบ้าน"],
              ].map(([href, label, description]) => (
                <Link
                  key={href}
                  href={href}
                  prefetch={false}
                  className="rounded-[20px] border border-slate-200 bg-white px-4 py-4 text-sm shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <span className="font-semibold text-slate-950">{label}</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span>
                </Link>
              ))}
            </div>
          </SurfaceSection>

          <SurfaceSection
            title="Automation lanes"
            description="แตกคิวตาม owner ที่ automation จะส่งต่อหรือหยุดรอ เพื่อให้เห็นทันทีว่าคอขวดอยู่ตรงทีมไหน"
            count={automation.lanes.reduce((total, lane) => total + lane.count, 0)}
          >
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {automation.lanes.map((lane) => (
                <div
                  key={lane.key}
                  className={`rounded-[22px] border p-4 shadow-sm ${severityToneClassName[lane.severity]}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {lane.key}
                      </p>
                      <h3 className="mt-1 text-base font-semibold text-slate-950">{lane.label}</h3>
                    </div>
                    <div className="rounded-full border border-white/80 bg-white/90 px-3 py-1 text-sm font-semibold text-slate-900 shadow-sm">
                      {lane.count}
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{lane.description}</p>
                </div>
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

