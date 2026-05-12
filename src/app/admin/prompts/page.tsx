import Link from "next/link";

import AdminLeadDesignActions from "@/app/admin/lead-design-actions";
import LeadAiPreviewActions from "@/app/admin/lead-ai-preview-actions";
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
import { getWorkflowOwnerContract } from "@/lib/workflow-owner-map";

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
    label: "Prompt Ops",
    description: "คิวที่มี prompt พร้อมแล้ว แต่ทีมออกแบบยังต้องกด generate, retry หรือปรับข้อความก่อนปล่อย preview loop",
    panelClassName: "border-violet-200 bg-violet-50/70",
    badgeClassName: "border-violet-200 bg-violet-100 text-violet-800",
    countClassName: "text-violet-900",
  },
  active: {
    label: "Preview Loop",
    description: "คิวที่ AI กำลังวิ่ง, มี preview แล้ว หรือส่งแบบให้ลูกค้าตรวจแล้ว ต้องคุมคุณภาพและการส่งต่อ",
    panelClassName: "border-emerald-200 bg-emerald-50/70",
    badgeClassName: "border-emerald-200 bg-emerald-100 text-emerald-800",
    countClassName: "text-emerald-900",
  },
  missing: {
    label: "Need Context",
    description: "คิวที่ยังไม่มี prompt พร้อมใช้ ต้องเติม brief, override หรือรายละเอียดงานก่อนให้ AI ขยับต่อ",
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
      preparedPrompt ? `seed ${PROMPT_SEED_LABELS[preparedPrompt.seed]}` : "ยังไม่มี seed prompt",
      `AI ${AI_STATUS_LABELS[aiStatus]}`,
      `แบบ ${DESIGN_STATUS_LABELS[designStatus]}`,
      previewCount > 0 ? `preview ${previewCount}` : null,
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
  const designContract = getWorkflowOwnerContract("IN_DESIGN");
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
    <div className="admin-shell min-h-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="mx-auto max-w-6xl">
          <Link
            href="/admin"
            prefetch={false}
            className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
          >
            ← กลับแดชบอร์ด
          </Link>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-700">
            {designContract.ownerLabel}
          </p>
          <h1 className="mt-2 text-2xl font-bold text-slate-950">Prompt &amp; AI Workbench</h1>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
            surface นี้ใช้คุม prompt, preview loop และสถานะแบบในคิวออกแบบ เพื่อให้เห็นว่า lead ไหนพร้อม generate, lead ไหนมี preview แล้ว และ lead ไหนยังขาดบริบทจน AI ยังไม่ควรวิ่งต่อ
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-700">
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
              owner {designContract.ownerLabel}
            </span>
            {designContract.autoEvents.map((event) => (
              <span
                key={event}
                className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-violet-800"
              >
                auto {event}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="admin-kpi-card">
            <p className="text-xs font-medium text-slate-500">Lead ล่าสุด</p>
            <p className="mt-1 text-2xl font-bold text-slate-950">{leads.length}</p>
          </div>
          <div className="admin-kpi-card">
            <p className="text-xs font-medium text-slate-500">Need Context</p>
            <p className="mt-1 text-2xl font-bold text-amber-700">{missingCount}</p>
          </div>
          <div className="admin-kpi-card">
            <p className="text-xs font-medium text-slate-500">Prompt Ops</p>
            <p className="mt-1 text-2xl font-bold text-violet-700">{readyCount}</p>
          </div>
          <div className="admin-kpi-card">
            <p className="text-xs font-medium text-slate-500">Preview Loop</p>
            <p className="mt-1 text-2xl font-bold text-emerald-700">{activeCount}</p>
          </div>
        </div>

        <section className="admin-panel mb-4 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="max-w-4xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Design Queue Contract</p>
            <h2 className="mt-2 text-xl font-bold text-slate-950">AI ช่วย generate ได้ แต่ design loop ยังต้องมีคนคุมคุณภาพ</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{designContract.summary}</p>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {groupedCards.map((group) => (
              <div
                key={group.key}
                className={`rounded-[20px] border px-4 py-4 ${group.panelClassName}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${group.badgeClassName}`}>
                    {group.label}
                  </span>
                  <span className={`text-lg font-semibold ${group.countClassName}`}>{group.cards.length}</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-700">{group.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          {groupedCards.map((group) => (
            <section
              key={group.key}
              className={`rounded-[28px] border p-5 shadow-sm ${group.panelClassName}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="max-w-3xl">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                    <span className={`rounded-full border px-3 py-1 ${group.badgeClassName}`}>
                      {group.label}
                    </span>
                    <span className="rounded-full border border-white/80 bg-white/70 px-3 py-1 text-slate-600">
                      owner {designContract.ownerLabel}
                    </span>
                  </div>
                  <h2 className="mt-3 text-lg font-semibold text-slate-950">{group.label}</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{group.description}</p>
                </div>
                <div className="rounded-[18px] border border-white/80 bg-white/80 px-4 py-3 text-right shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">รายการ</p>
                  <p className={`mt-1 text-2xl font-semibold ${group.countClassName}`}>{group.cards.length}</p>
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

                        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_1.3fr]">
                          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Design brief</p>
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                              {card.lead.design_brief || "ยังไม่มี design brief"}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Prompt source</p>
                            <p className="mt-2 text-sm font-medium text-slate-700">
                              {card.preparedPrompt
                                ? PROMPT_SEED_LABELS[card.preparedPrompt.seed]
                                : "ยังไม่มี source ที่ compose เป็น prompt ได้"}
                            </p>
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                              {card.lead.ai_image_prompt || card.lead.ai_prompt_snapshot || card.lead.reference_info || "ยังไม่มี prompt override หรือ snapshot"}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-dashed border-violet-200 bg-violet-50/60 p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-violet-700">Final prompt</p>
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                              {card.prompt ? truncate(card.prompt) : "ยังไม่มี prompt ที่พร้อมใช้"}
                            </p>
                          </div>
                        </div>
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
