"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { DashboardTrendPoint } from "@/lib/dashboard-trends";

type Props = {
  trends: DashboardTrendPoint[];
};

const chartConfig = {
  newLeads: { label: "Lead เข้าใหม่", color: "var(--chart-1)" },
  newQuotes: { label: "Quote ออกใหม่", color: "var(--chart-2)" },
  newJobs: { label: "Job เปิดใหม่", color: "var(--chart-3)" },
  completedJobs: { label: "Job ปิด", color: "var(--chart-4)" },
  issuedDocuments: { label: "เอกสารออก", color: "var(--chart-5)" },
} satisfies ChartConfig;

function formatDateLabel(dateKey: string) {
  const [, month, day] = dateKey.split("-");
  return `${Number(day)}/${Number(month)}`;
}

export function DashboardTrendChart({ trends }: Props) {
  const totals = trends.reduce(
    (acc, point) => ({
      newLeads: acc.newLeads + point.newLeads,
      newQuotes: acc.newQuotes + point.newQuotes,
      newJobs: acc.newJobs + point.newJobs,
      completedJobs: acc.completedJobs + point.completedJobs,
      issuedDocuments: acc.issuedDocuments + point.issuedDocuments,
    }),
    { newLeads: 0, newQuotes: 0, newJobs: 0, completedJobs: 0, issuedDocuments: 0 }
  );

  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-950">กิจกรรม 7 วันย้อนหลัง</h2>
          <p className="mt-1 text-xs text-slate-500">
            นับตาม Asia/Bangkok — แสดงปริมาณงานที่ไหลผ่านระบบในแต่ละวัน
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
          {(
            [
              ["newLeads", totals.newLeads],
              ["newQuotes", totals.newQuotes],
              ["newJobs", totals.newJobs],
              ["completedJobs", totals.completedJobs],
              ["issuedDocuments", totals.issuedDocuments],
            ] as Array<[keyof typeof chartConfig, number]>
          ).map(([key, value]) => (
            <span key={key} className="flex items-center gap-1.5 rounded-full bg-slate-50 px-2 py-1">
              <span
                aria-hidden
                className="inline-block size-2 rounded-full"
                style={{ backgroundColor: `var(--color-${key})` }}
              />
              <span className="font-medium text-slate-700">{chartConfig[key].label}</span>
              <span className="font-semibold text-slate-950">{value}</span>
            </span>
          ))}
        </div>
      </header>

      <ChartContainer config={chartConfig} className="h-[220px] w-full">
        <LineChart data={trends} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDateLabel}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "#64748b" }}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "#64748b" }}
            width={28}
          />
          <ChartTooltip
            cursor={{ stroke: "#cbd5e1", strokeDasharray: "3 3" }}
            content={
              <ChartTooltipContent
                labelFormatter={(label) =>
                  typeof label === "string" ? formatDateLabel(label) : String(label ?? "")
                }
              />
            }
          />
          <ChartLegend content={<ChartLegendContent />} />
          {(Object.keys(chartConfig) as Array<keyof typeof chartConfig>).map((key) => (
            <Line
              key={key}
              dataKey={key}
              type="monotone"
              stroke={`var(--color-${key})`}
              strokeWidth={2}
              dot={{ r: 2.5 }}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ChartContainer>
    </section>
  );
}
