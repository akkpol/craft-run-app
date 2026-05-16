import Link from "next/link";

import AdminLeadDesignActions from "@/app/admin/lead-design-actions";
import LeadAiPreviewActions from "@/app/admin/lead-ai-preview-actions";
import LeadManualDesignActions from "@/app/admin/lead-manual-design-actions";
import LeadPromptActions from "@/app/admin/lead-prompt-actions";
import LeadSendPreviewActions from "@/app/admin/lead-send-preview-actions";
import { Badge } from "@/components/ui/badge";
import { formatBangkokDate } from "@/lib/bangkok-date-time";
import {
  prepareLeadAiPrompt,
  type PreparedLeadAiPrompt,
} from "@/lib/lead-ai-prompt";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  DESIGN_STATUS_LABELS,
  designStatusNeedsCustomerResponse,
  getProductTypeLabel,
  type DesignStatus,
} from "@/lib/types";

export const dynamic = "force-dynamic";

type PromptWorkbenchLaneKey = "ready" | "active" | "missing";

type PromptLeadRow = {
  id: string;
  customer_id: string | null;
  product_type: string | null;
  width_mm: number | null;
  height_mm: number | null;
  qty: number | null;
  note_from_form: string | null;
  reference_info: string | null;
  design_brief?: string | null;
  ai_image_prompt?: string | null;
  ai_prompt_snapshot?: string | null;
  ai_image_status?: "not_requested" | "pending" | "generated" | "failed" | null;
  ai_generated_images?: string[] | null;
  design_status?: DesignStatus | null;
  created_at: string;
  customers?: {
    id: string;
    display_name: string | null;
    phone: string | null;
    line_user_id: string;
  } | null;
};

type PromptCardModel = {
  laneKey: PromptWorkbenchLaneKey;
  lead: PromptLeadRow;
  prompt: string;
  preparedPrompt: PreparedLeadAiPrompt | null;
  productLabel: string;
  customerLabel: string;
  aiStatus: "not_requested" | "pending" | "generated" | "failed";
  designStatus: DesignStatus;
  stopReason: string;
  nextActionLabel: string;
  nextActionOwner: "internal" | "customer";
  evidence: string[];
  routingSummary: string;
  previewCount: number;
};

const PROMPT_LANE_COPY: Record<
  PromptWorkbenchLaneKey,
  {
    label: string;
    description: string;
    panelClassName: string;
    badgeClassName: string;
    countClassName: string;
  }
> = {
  ready: {
    label: "พร้อมสั่ง AI",
    description: "มีพรอมพ์พร้อมแล้ว — ตรวจข้อความและสั่ง AI สร้างภาพได้เลย",
    panelClassName: "border-violet-200 bg-violet-50/70",
    badgeClassName: "border-violet-200 bg-violet-100 text-violet-800",
    countClassName: "text-violet-900",
  },
  active: {
    label: "มี preview แล้ว",
    description: "AI สร้างภาพแล้ว หรือส่งให้ลูกค้าตรวจแล้ว — คุมคุณภาพและส่งต่อ",
    panelClassName: "border-emerald-200 bg-emerald-50/70",
    badgeClassName: "border-emerald-200 bg-emerald-100 text-emerald-800",
    countClassName: "text-emerald-900",
  },
  missing: {
    label: "รอเติมข้อมูล",
    description: "ยังไม่มีข้อมูลพอให้ AI ทำงาน — เติม brief หรือรายละเอียดงานก่อน",
    panelClassName: "border-amber-200 bg-amber-50/70",
    badgeClassName: "border-amber-200 bg-amber-100 text-amber-800",
    countClassName: "text-amber-900",
  },
};

const AI_STATUS_LABELS = {
  not_requested: "ยังไม่สั่ง AI",
  pending: "AI กำลังสร้างภาพ",
  generated: "มีภาพตัวอย่างแล้ว",
  failed: "AI สร้างภาพไม่สำเร็จ",
} as const;

const AI_STATUS_BADGE_CLASSNAMES = {
  not_requested: "border-slate-200 bg-slate-100 text-slate-700",
  pending: "border-sky-200 bg-sky-100 text-sky-800",
  generated: "border-emerald-200 bg-emerald-100 text-emerald-800",
  failed: "border-rose-200 bg-rose-100 text-rose-800",
} as const;

const PROMPT_SEED_LABELS = {
  snapshot: "snapshot ที่ล็อกแล้ว",
  explicit_prompt: "prompt override",
  design_brief: "design brief",
  structured: "context จากฟอร์ม",
} as const;

function truncate(value: string, maxLength = 180) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}

function formatDimensions(lead: PromptLeadRow) {
  if (!lead.width_mm || !lead.height_mm || !lead.qty) {
    return null;
  }

  return `${(lead.width_mm / 10).toFixed(1)} × ${(lead.height_mm / 10).toFixed(1)} ซม. · ${lead.qty} ชิ้น`;
}

function buildPromptCardModel(lead: PromptLeadRow): PromptCardModel {
  const preparedPrompt = prepareLeadAiPrompt(lead);
  const prompt = preparedPrompt?.prompt || "";
  const aiStatus = lead.ai_image_status || "not_requested";
  const designStatus = lead.design_status || "not_started";
  const previewCount = Array.isArray(lead.ai_generated_images)
    ? lead.ai_generated_images.length
    : 0;

  let laneKey: PromptWorkbenchLaneKey = "ready";
  let stopReason = "มี prompt พร้อมให้ generate";
  let nextActionLabel = "ตรวจ prompt แล้วสั่ง AI preview";

  if (!preparedPrompt) {
    laneKey = "missing";
    stopReason = "ยังไม่มี prompt ที่พร้อมใช้";
    nextActionLabel = "เติม brief หรือแก้ prompt ก่อน";
  } else if (
    aiStatus === "pending" ||
    aiStatus === "generated" ||
    previewCount > 0 ||
    designStatus === "preview_sent"
  ) {
    laneKey = "active";

    if (designStatus === "preview_sent") {
      stopReason = "ส่ง preview ให้ลูกค้าตรวจแล้ว";
      nextActionLabel = "รอ feedback ลูกค้าหรือแก้แบบรอบถัดไป";
    } else if (aiStatus === "pending") {
      stopReason = "AI กำลังสร้างภาพตัวอย่าง";
      nextActionLabel = "รอผล generation หรือแก้ prompt ถ้าค้างนาน";
    } else {
      stopReason = previewCount > 0 ? `มี preview ${previewCount} แบบ รอคัดและส่งต่อ` : "มี preview พร้อมให้ทีมตรวจ";
      nextActionLabel = "คัด preview แล้วส่งลูกค้าหรืออัปเดตสถานะแบบ";
    }
  } else if (aiStatus === "failed") {
    stopReason = "AI สร้างภาพไม่สำเร็จ ต้องแก้ prompt หรือ retry";
    nextActionLabel = "แก้ prompt แล้วลอง generate ใหม่";
  } else if (preparedPrompt.seed === "structured") {
    stopReason = "ระบบประกอบ prompt จากข้อมูลหน้างานได้แล้ว แต่ยังไม่มีคนตรวจข้อความ";
    nextActionLabel = "ตรวจ prompt ก่อนกด generate";
  }

  return {
    laneKey,
    lead,
    prompt,
    preparedPrompt,
    productLabel: getProductTypeLabel(lead.product_type) || lead.product_type || "ไม่ระบุสินค้า",
    customerLabel: lead.customers?.display_name || "ลูกค้าไม่ระบุชื่อ",
    aiStatus,
    designStatus,
    stopReason,
    nextActionLabel,
    nextActionOwner: designStatusNeedsCustomerResponse(designStatus) ? "customer" : "internal",
    routingSummary: preparedPrompt
      ? "มี AI prompt พร้อมใช้งาน"
      : "คิวนี้ยังต้องเพิ่มบริบทก่อนให้ AI ขยับต่อ",
    previewCount,
    evidence: [
      previewCount > 0 ? `${previewCount} preview` : null,
      formatDimensions(lead),
    ].filter((value): value is string => Boolean(value)),
  };
}

export default async function AdminPromptsPage() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("leads")
    .select(
      "id, customer_id, product_type, width_mm, height_mm, qty, note_from_form, reference_info, design_brief, ai_image_prompt, ai_prompt_snapshot, ai_image_status, ai_generated_images, design_status, created_at, customers(id, display_name, phone, line_user_id)"
    )
    .order("created_at", { ascending: false })
    .limit(80);

  const leads = (data || []) as unknown as PromptLeadRow[];
  const cards = leads.map(buildPromptCardModel);
  const groupedCards = (Object.keys(PROMPT_LANE_COPY) as PromptWorkbenchLaneKey[]).map(
    (key) => ({
      key,
      ...PROMPT_LANE_COPY[key],
      cards: cards.filter((card) => card.laneKey === key),
    })
  );

  const missingCount = groupedCards.find((group) => group.key === "missing")?.cards.length || 0;
  const readyCount = groupedCards.find((group) => group.key === "ready")?.cards.length || 0;
  const activeCount = groupedCards.find((group) => group.key === "active")?.cards.length || 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="mx-auto max-w-6xl">
          <Link
            href="/admin"
            prefetch={false}
            className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
          >
            ← กลับแดชบอร์ด
          </Link>
          <h1 className="text-2xl font-bold text-slate-950">ออกแบบ · AI</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            คิวงานออกแบบที่ต้องตรวจพรอมพ์ สั่ง AI สร้างภาพ และส่ง preview ให้ลูกค้า
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <div className="admin-kpi-card">
            <p className="text-sm font-medium text-slate-500">รอเติมข้อมูล</p>
            <p className={`mt-1 text-3xl font-bold ${missingCount > 0 ? "text-amber-600" : "text-slate-400"}`}>
              {missingCount}
            </p>
          </div>
          <div className="admin-kpi-card">
            <p className="text-sm font-medium text-slate-500">พร้อมสั่ง AI</p>
            <p className={`mt-1 text-3xl font-bold ${readyCount > 0 ? "text-violet-600" : "text-slate-400"}`}>
              {readyCount}
            </p>
          </div>
          <div className="admin-kpi-card">
            <p className="text-sm font-medium text-slate-500">มี preview แล้ว</p>
            <p className={`mt-1 text-3xl font-bold ${activeCount > 0 ? "text-emerald-600" : "text-slate-400"}`}>
              {activeCount}
            </p>
          </div>
        </div>

        <section className="space-y-4">
          {groupedCards.filter((group) => group.cards.length > 0).map((group) => (
            <section
              key={group.key}
              className={`rounded-[28px] border p-5 shadow-sm ${group.panelClassName}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="max-w-3xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${group.badgeClassName}`}>
                      {group.label}
                    </span>
                    <span className={`text-2xl font-semibold ${group.countClassName}`}>{group.cards.length}</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{group.description}</p>
                </div>
              </div>

              {group.cards.length > 0 ? (
                <div className="mt-4 grid gap-4">
                  {group.cards.map((card) => {
                    const customer = card.lead.customers;

                    return (
                      <article
                        key={card.lead.id}
                        className="rounded-[24px] border border-white/90 bg-white/92 p-5 shadow-[0_14px_32px_rgba(15,23,42,0.06)]"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="min-w-0 max-w-3xl">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-base font-semibold text-slate-950">{card.customerLabel}</h3>
                              <Badge
                                className={`border ${AI_STATUS_BADGE_CLASSNAMES[card.aiStatus]}`}
                              >
                                {AI_STATUS_LABELS[card.aiStatus]}
                              </Badge>
                              <Badge className="border border-slate-200 bg-slate-50 text-slate-700">
                                {DESIGN_STATUS_LABELS[card.designStatus]}
                              </Badge>
                            </div>
                            <p className="mt-1 text-sm text-slate-500">
                              {card.productLabel} · {formatBangkokDate(card.lead.created_at)}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2 text-xs">
                              {card.evidence.map((item) => (
                                <span
                                  key={`${card.lead.id}-${item}`}
                                  className="rounded-full border border-slate-200 bg-white px-3 py-1 font-medium text-slate-600"
                                >
                                  {item}
                                </span>
                              ))}
                            </div>
                            {customer?.id ? (
                              <Link
                                href={`/admin/customers/${customer.id}`}
                                prefetch={false}
                                className="mt-3 inline-flex text-xs font-semibold text-sky-700 hover:text-sky-900"
                              >
                                เปิดโปรไฟล์ลูกค้า
                              </Link>
                            ) : null}
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <LeadPromptActions
                              leadId={card.lead.id}
                              prompt={card.prompt}
                              promptRoutingLabel={card.routingSummary}
                              buttonLabel="แก้พรอมพ์"
                            />
                            <LeadAiPreviewActions
                              leadId={card.lead.id}
                              prompt={card.prompt}
                              status={card.aiStatus}
                            />
                            {card.aiStatus === "failed" ? (
                              <LeadManualDesignActions leadId={card.lead.id} />
                            ) : null}
                            <LeadSendPreviewActions
                              leadId={card.lead.id}
                              previewCount={card.previewCount}
                            />
                            <AdminLeadDesignActions
                              leadId={card.lead.id}
                              designStatus={card.designStatus}
                            />
                          </div>
                        </div>

                        <div className="mt-4 rounded-[18px] border border-slate-200 bg-slate-50/80 px-4 py-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">หยุดเพราะ</p>
                          <p className="mt-1 text-sm font-medium text-slate-900">{card.stopReason}</p>
                          <p className="mt-2 text-xs leading-5 text-slate-500">
                            ต่อไป: {card.nextActionLabel} · เจ้าของ action {card.nextActionOwner === "customer" ? "ลูกค้า" : "ทีมออกแบบ"}
                          </p>
                        </div>

                        <details className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                          <summary className="cursor-pointer text-sm font-semibold text-slate-700 hover:text-slate-900">
                            ดูบรีฟและพรอมพ์ทั้งหมด
                          </summary>
                          <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1fr_1.3fr]">
                            <div className="rounded-xl border border-slate-200 bg-white p-3">
                              <p className="text-xs font-semibold text-slate-500">Design brief จากลูกค้า</p>
                              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                                {card.lead.design_brief || "ยังไม่มี design brief"}
                              </p>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-white p-3">
                              <p className="text-xs font-semibold text-slate-500">แหล่งพรอมพ์</p>
                              <p className="mt-2 text-sm font-medium text-slate-700">
                                {card.preparedPrompt
                                  ? PROMPT_SEED_LABELS[card.preparedPrompt.seed]
                                  : "ยังไม่มีแหล่งให้สร้างพรอมพ์"}
                              </p>
                              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                                {card.lead.ai_image_prompt || card.lead.ai_prompt_snapshot || card.lead.reference_info || "ยังไม่มี override หรือ snapshot"}
                              </p>
                            </div>
                            <div className="rounded-xl border border-dashed border-violet-200 bg-violet-50/60 p-3">
                              <p className="text-xs font-semibold text-violet-700">พรอมพ์สุดท้าย</p>
                              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                                {card.prompt ? truncate(card.prompt) : "ยังไม่มีพรอมพ์ที่พร้อมใช้"}
                              </p>
                            </div>
                          </div>
                        </details>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-4 rounded-[20px] border border-white/80 bg-white/80 px-4 py-4 text-sm text-slate-600">
                  ตอนนี้ไม่มี lead ใน lane นี้
                </div>
              )}
            </section>
          ))}
        </section>
      </div>
    </div>
  );
}
