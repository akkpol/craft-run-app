"use client";

import Link from "next/link";
import { formatBangkokDate } from "@/lib/bangkok-date-time";
import {
  BILLING_ENTITY_TYPE_LABELS,
  DOCUMENT_REQUEST_TYPE_LABELS,
  FULFILLMENT_MODE_LABELS,
  type BillingEntityType,
  type DocumentRequestType,
  type FulfillmentMode,
} from "@/lib/types";

const STATE_LABELS: Record<string, string> = {
  NEW_MESSAGE: "ข้อความใหม่",
  COLLECTING_REQUIREMENTS: "กำลังเก็บข้อมูล",
  REQUIREMENTS_REVIEW: "ตรวจสอบข้อมูล",
  WAITING_QUOTE_APPROVAL: "รออนุมัติใบเสนอราคา",
  WAITING_PAYMENT: "รอชำระเงิน",
  IN_DESIGN: "ออกแบบ",
  IN_PRODUCTION: "ผลิต",
  READY_FOR_FULFILLMENT: "พร้อมส่ง",
  COMPLETED: "เสร็จสิ้น",
  ON_HOLD_CUSTOMER_INPUT: "รอข้อมูลลูกค้า",
  HUMAN_REVIEW_REQUIRED: "รอแอดมิน",
  CANCELLED: "ยกเลิก",
};

const STATE_COLORS: Record<string, string> = {
  COMPLETED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-slate-100 text-slate-500",
  WAITING_QUOTE_APPROVAL: "bg-amber-100 text-amber-700",
  WAITING_PAYMENT: "bg-orange-100 text-orange-700",
  IN_DESIGN: "bg-sky-100 text-sky-700",
  IN_PRODUCTION: "bg-blue-100 text-blue-700",
  HUMAN_REVIEW_REQUIRED: "bg-rose-100 text-rose-700",
  ON_HOLD_CUSTOMER_INPUT: "bg-yellow-100 text-yellow-700",
};

const QUOTE_STATUS_LABELS: Record<string, string> = {
  draft: "แบบร่าง",
  sent: "ส่งแล้ว",
  approved: "อนุมัติแล้ว",
  rejected: "ปฏิเสธ",
  expired: "หมดอายุ",
};

const QUOTE_STATUS_COLORS: Record<string, string> = {
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-rose-100 text-rose-700",
  expired: "bg-slate-100 text-slate-500",
  sent: "bg-amber-100 text-amber-700",
  draft: "bg-slate-100 text-slate-600",
};

function formatDate(iso: string | null) {
  return iso ? formatBangkokDate(iso) : "—";
}

function formatBaht(value: number) {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 0,
  }).format(value);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value
        .map((entry) => asString(entry))
        .filter((entry): entry is string => Boolean(entry))
    : [];
}

function formatContextType(type: string | null) {
  switch (type) {
    case "utou":
      return "1:1 chat";
    case "group":
      return "Group";
    case "room":
      return "Multi-person room";
    case "external":
      return "External browser";
    case "none":
      return "Other LINE surface";
    default:
      return "—";
  }
}

function formatCustomerSource(lineUserId: string) {
  if (lineUserId.startsWith("manual:")) {
    const source = lineUserId.split(":")[1] || "other";
    if (source === "walk_in") return "Manual: หน้าร้าน";
    if (source === "phone") return "Manual: โทรศัพท์";
    if (source === "facebook") return "Manual: Facebook";
    if (source === "email") return "Manual: อีเมล";
    return "Manual intake";
  }

  return `LINE: ${lineUserId}`;
}

function StateChip({ state }: { state: string }) {
  const color = STATE_COLORS[state] ?? "bg-slate-100 text-slate-600";
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>
      {STATE_LABELS[state] ?? state}
    </span>
  );
}

type Customer = {
  id: string;
  line_user_id: string;
  display_name: string | null;
  phone: string | null;
  line_email?: string | null;
  line_picture_url?: string | null;
  line_status_message?: string | null;
  line_friendship_status?: boolean | null;
  last_liff_profile?: Record<string, unknown> | null;
  last_liff_context?: Record<string, unknown> | null;
  created_at: string;
};

type Conversation = {
  id: string;
  state: string;
  last_message_at: string | null;
  created_at: string;
};

type Lead = {
  id: string;
  product_type: string | null;
  width_mm: number | null;
  height_mm: number | null;
  qty: number | null;
  status: string;
  due_date: string | null;
  design_brief?: string | null;
  ai_image_prompt?: string | null;
  ai_prompt_snapshot?: string | null;
  note_from_form: string | null;
  requested_document_type?: string | null;
  billing_entity_type?: string | null;
  billing_name?: string | null;
  tax_id?: string | null;
  billing_address?: string | null;
  fulfillment_mode?: FulfillmentMode | null;
  liff_profile_snapshot?: Record<string, unknown> | null;
  liff_context_snapshot?: Record<string, unknown> | null;
  created_at: string;
};

type Quote = {
  id: string;
  total: number | null;
  status: string;
  created_at: string;
  jobs?: Array<{ id: string; status: string; created_at: string }>;
};

type Summary = {
  totalOrders: number;
  totalRevenue: number;
  completedJobs: number;
  activeJobs: number;
};

export default function Customer360Client({
  customer,
  conversations,
  leads,
  quotes,
  summary,
}: {
  customer: Customer;
  conversations: Conversation[];
  leads: Lead[];
  quotes: Quote[];
  summary: Summary;
}) {
  const latestLiffProfile = asRecord(customer.last_liff_profile);
  const latestLiffContext = asRecord(customer.last_liff_context);
  const latestLiffContextMeta = asRecord(latestLiffContext?.context);
  const latestGrantedScopes = asStringArray(
    latestLiffContext?.grantedScopes || latestLiffContextMeta?.scope
  );
  const latestLead = leads[0] ?? null;
  const latestBillingEntityType = asString(
    latestLead?.billing_entity_type
  ) as BillingEntityType | null;
  const latestDocumentType = asString(
    latestLead?.requested_document_type
  ) as DocumentRequestType | null;
  const latestDesignBrief = asString(latestLead?.design_brief);
  const latestAiImagePrompt = asString(latestLead?.ai_image_prompt);
  const latestAiPromptSnapshot = asString(latestLead?.ai_prompt_snapshot);

  return (
    <div className="admin-shell min-h-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="mx-auto max-w-5xl">
          <Link
            href="/admin"
            className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
          >
            ← กลับแดชบอร์ด
          </Link>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                {customer.display_name || "ลูกค้าไม่ระบุชื่อ"}
              </h1>
              <div className="mt-1 flex flex-wrap gap-3 text-sm text-slate-600">
                {customer.phone ? <span>{customer.phone}</span> : null}
                <span className="text-slate-400">{formatCustomerSource(customer.line_user_id)}</span>
                <span className="text-slate-400">
                  สมัครเมื่อ {formatDate(customer.created_at)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="admin-kpi-card">
            <p className="text-xs font-medium text-slate-500">คำสั่งซื้อ</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{summary.totalOrders}</p>
          </div>
          <div className="admin-kpi-card">
            <p className="text-xs font-medium text-slate-500">รายได้รวม</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600">
              {formatBaht(summary.totalRevenue)}
            </p>
          </div>
          <div className="admin-kpi-card">
            <p className="text-xs font-medium text-slate-500">งานเสร็จสิ้น</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{summary.completedJobs}</p>
          </div>
          <div className="admin-kpi-card">
            <p className="text-xs font-medium text-slate-500">งานในคิว</p>
            <p className="mt-1 text-2xl font-bold text-sky-600">{summary.activeJobs}</p>
          </div>
        </div>

        <div className="grid items-start gap-4 lg:grid-cols-3">
          <section className="admin-panel lg:col-span-1">
            <h2 className="text-sm font-semibold text-slate-700">ข้อมูล LINE</h2>
            <div className="mt-4 flex items-start gap-4">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 text-lg font-semibold text-slate-500">
                {customer.line_picture_url || asString(latestLiffProfile?.pictureUrl) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={customer.line_picture_url || asString(latestLiffProfile?.pictureUrl) || ""}
                    alt={customer.display_name || "LINE profile"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  (customer.display_name || "?").slice(0, 1)
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-1.5 text-sm text-slate-600">
                <p className="font-semibold text-slate-900">
                  {customer.display_name || asString(latestLiffProfile?.displayName) || "ลูกค้าไม่ระบุชื่อ"}
                </p>
                <p className="wrap-break-word text-slate-500">แหล่งที่มา: {formatCustomerSource(customer.line_user_id)}</p>
                <p>{customer.line_email || asString(latestLiffProfile?.email) || "ยังไม่มีอีเมลจาก LINE"}</p>
                <p>{customer.phone || "ยังไม่มีเบอร์โทรในระบบ"}</p>
                <p>{customer.line_status_message || asString(latestLiffProfile?.statusMessage) || "ยังไม่มี status message"}</p>
                <p>
                  สถานะ OA: {customer.line_friendship_status ? "เป็นเพื่อนแล้ว" : customer.line_friendship_status === false ? "ยังไม่ได้เป็นเพื่อนหรือบล็อกอยู่" : "ยังไม่ทราบ"}
                </p>
              </div>
            </div>
          </section>

          <section className="admin-panel lg:col-span-1">
            <h2 className="text-sm font-semibold text-slate-700">ข้อมูล LIFF ล่าสุด</h2>
            <div className="mt-4 space-y-2 text-sm text-slate-600">
              <p>เก็บล่าสุด: {formatDate(asString(latestLiffContext?.collectedAt))}</p>
              <p>เปิดจาก: {formatContextType(asString(latestLiffContextMeta?.type))}</p>
              <p>OS: {asString(latestLiffContext?.os) || "—"}</p>
              <p>App language: {asString(latestLiffContext?.appLanguage) || "—"}</p>
              <p>LINE version: {asString(latestLiffContext?.lineVersion) || "—"}</p>
              <p>LIFF SDK: {asString(latestLiffContext?.liffSdkVersion) || "—"}</p>
              <p>View type: {asString(latestLiffContextMeta?.viewType) || "—"}</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {latestGrantedScopes.length > 0 ? (
                latestGrantedScopes.map((scope) => (
                  <span
                    key={scope}
                    className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600"
                  >
                    {scope}
                  </span>
                ))
              ) : (
                <span className="text-sm text-slate-400">ยังไม่มี scope snapshot</span>
              )}
            </div>
          </section>

          <section className="admin-panel lg:col-span-1">
            <h2 className="text-sm font-semibold text-slate-700">เอกสาร / บิลล่าสุด</h2>
            {latestLead ? (
              <div className="mt-4 space-y-2 text-sm text-slate-600">
                <p>
                  เอกสารหลัก: {latestDocumentType ? DOCUMENT_REQUEST_TYPE_LABELS[latestDocumentType] : "—"}
                </p>
                <p>
                  ประเภทลูกค้า: {latestBillingEntityType ? BILLING_ENTITY_TYPE_LABELS[latestBillingEntityType] : "—"}
                </p>
                <p>
                  การรับงาน: {latestLead.fulfillment_mode ? FULFILLMENT_MODE_LABELS[latestLead.fulfillment_mode] : "—"}
                </p>
                <p>{latestLead.billing_name || "ยังไม่ได้ระบุชื่อออกเอกสาร"}</p>
                <p>{latestLead.tax_id || "ยังไม่ได้ระบุ Tax ID"}</p>
                <p className="wrap-break-word">
                  {latestLead.billing_address || "ยังไม่ได้ระบุที่อยู่ออกเอกสาร"}
                </p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-400">ยังไม่มี lead ในระบบ</p>
            )}
          </section>

          <section className="admin-panel lg:col-span-3">
            <h2 className="text-sm font-semibold text-slate-700">แหล่งข้อมูลพรอมพ์ AI</h2>
            {latestLead ? (
              <div className="mt-4 grid gap-3 text-sm text-slate-600 lg:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
                  <p className="text-xs font-semibold text-slate-500">
                    Design brief จากลูกค้า
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-slate-700">
                    {latestDesignBrief || "ยังไม่มี design brief"}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
                  <p className="text-xs font-semibold text-slate-500">
                    AI prompt (ดิบ)
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-slate-700">
                    {latestAiImagePrompt || "ยังไม่มี AI prompt ที่ระบุโดยตรง"}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
                  <p className="text-xs font-semibold text-slate-500">
                    AI prompt (snapshot ที่ระบบเตรียมส่งจริง)
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-slate-700">
                    {latestAiPromptSnapshot || "ยังไม่มี snapshot ที่ระบบเตรียมไว้"}
                  </p>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-400">ยังไม่มี lead สำหรับตรวจสอบ prompt source</p>
            )}
          </section>
        </div>

        <section className="admin-panel">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">
            บทสนทนา ({conversations.length})
          </h2>
          {conversations.length === 0 ? (
            <p className="text-sm text-slate-400">ยังไม่มีบทสนทนา</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs font-medium text-slate-500">
                    <th className="pb-2 pr-4">สถานะ</th>
                    <th className="pb-2 pr-4">ข้อความล่าสุด</th>
                    <th className="pb-2">สร้างเมื่อ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {conversations.map((conv) => (
                    <tr key={conv.id}>
                      <td className="py-2.5 pr-4">
                        <StateChip state={conv.state} />
                      </td>
                      <td className="py-2.5 pr-4 text-slate-600">
                        {formatDate(conv.last_message_at)}
                      </td>
                      <td className="py-2.5 text-slate-500">
                        {formatDate(conv.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="admin-panel">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">
            ลีด ({leads.length})
          </h2>
          {leads.length === 0 ? (
            <p className="text-sm text-slate-400">ยังไม่มี lead</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs font-medium text-slate-500">
                    <th className="pb-2 pr-4">ประเภทงาน</th>
                    <th className="pb-2 pr-4">เอกสาร / บิล</th>
                    <th className="pb-2 pr-4">การรับงาน</th>
                    <th className="pb-2 pr-4">ขนาด</th>
                    <th className="pb-2 pr-4">จำนวน</th>
                    <th className="pb-2 pr-4">สถานะ</th>
                    <th className="pb-2">วันที่</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {leads.map((lead) => (
                    <tr key={lead.id}>
                      <td className="py-2.5 pr-4 font-medium text-slate-800">
                        {lead.product_type || "—"}
                      </td>
                      <td className="py-2.5 pr-4 text-slate-600">
                        <div className="min-w-45 space-y-1">
                          <p>
                            {lead.requested_document_type && DOCUMENT_REQUEST_TYPE_LABELS[lead.requested_document_type as DocumentRequestType]
                              ? DOCUMENT_REQUEST_TYPE_LABELS[lead.requested_document_type as DocumentRequestType]
                              : "—"}
                          </p>
                          <p className="wrap-break-word text-xs text-slate-500">
                            {lead.billing_name || "ยังไม่ระบุชื่อออกเอกสาร"}
                          </p>
                        </div>
                      </td>
                      <td className="py-2.5 pr-4 text-slate-600">
                        {lead.fulfillment_mode ? FULFILLMENT_MODE_LABELS[lead.fulfillment_mode] : "—"}
                      </td>
                      <td className="py-2.5 pr-4 text-slate-600">
                        {lead.width_mm && lead.height_mm
                          ? `${lead.width_mm}×${lead.height_mm} mm`
                          : "—"}
                      </td>
                      <td className="py-2.5 pr-4 text-slate-600">
                        {lead.qty ?? "—"}
                      </td>
                      <td className="py-2.5 pr-4">
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                          {lead.status}
                        </span>
                      </td>
                      <td className="py-2.5 text-slate-500">
                        {formatDate(lead.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="admin-panel">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">
            ใบเสนอราคา & งาน ({quotes.length})
          </h2>
          {quotes.length === 0 ? (
            <p className="text-sm text-slate-400">ยังไม่มีใบเสนอราคา</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs font-medium text-slate-500">
                    <th className="pb-2 pr-4">ราคารวม</th>
                    <th className="pb-2 pr-4">สถานะใบเสนอราคา</th>
                    <th className="pb-2 pr-4">งาน</th>
                    <th className="pb-2">วันที่</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {quotes.map((quote) => {
                    const jobs = Array.isArray(quote.jobs) ? quote.jobs : [];
                    const statusColor =
                      QUOTE_STATUS_COLORS[quote.status] ??
                      "bg-slate-100 text-slate-600";

                    return (
                      <tr key={quote.id}>
                        <td className="py-2.5 pr-4 font-semibold text-slate-800">
                          {quote.total ? formatBaht(quote.total) : "—"}
                        </td>
                        <td className="py-2.5 pr-4">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor}`}
                          >
                            {QUOTE_STATUS_LABELS[quote.status] ?? quote.status}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4 text-slate-600">
                          {jobs.length > 0 ? jobs.map((job) => job.status).join(", ") : "—"}
                        </td>
                        <td className="py-2.5 text-slate-500">
                          {formatDate(quote.created_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
