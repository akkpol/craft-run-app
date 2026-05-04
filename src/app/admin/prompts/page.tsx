import Link from "next/link";

import LeadAiPreviewActions from "@/app/admin/lead-ai-preview-actions";
import LeadPromptActions from "@/app/admin/lead-prompt-actions";
import { Badge } from "@/components/ui/badge";
import { formatBangkokDate } from "@/lib/bangkok-date-time";
import {
  getLeadAiDisplayPrompt,
  getLeadDesignRoutingSummary,
  hasLeadAiSeedPrompt,
} from "@/lib/lead-ai-prompt";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProductTypeLabel } from "@/lib/types";

export const dynamic = "force-dynamic";

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
  ai_image_status?: string | null;
  created_at: string;
  customers?: {
    id: string;
    display_name: string | null;
    phone: string | null;
    line_user_id: string;
  } | null;
};

function truncate(value: string, maxLength = 180) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}

export default async function AdminPromptsPage() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("leads")
    .select("id, customer_id, product_type, width_mm, height_mm, qty, note_from_form, reference_info, design_brief, ai_image_prompt, ai_prompt_snapshot, ai_image_status, created_at, customers(id, display_name, phone, line_user_id)")
    .order("created_at", { ascending: false })
    .limit(80);

  const leads = (data || []) as unknown as PromptLeadRow[];
  const withPrompt = leads.filter((lead) => hasLeadAiSeedPrompt(lead)).length;
  const generated = leads.filter((lead) => lead.ai_image_status === "generated").length;

  return (
    <div className="px-4 py-6 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-700">Prompt Center</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-950">พรอมพ์และ AI Preview</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            รวมพรอมพ์จาก design brief, prompt override และ prompt snapshot ของทุก lead เพื่อให้ทีมเห็นว่าต้นทาง AI มาจากไหน แก้ไขได้ และส่งต่อไป Studio หรือ preview ได้โดยตรง
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-slate-700">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">Lead ล่าสุด {leads.length}</span>
            <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-violet-800">มีพรอมพ์ {withPrompt}</span>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-800">generated {generated}</span>
          </div>
        </section>

        <section className="grid gap-4">
          {leads.map((lead) => {
            const prompt = getLeadAiDisplayPrompt(lead);
            const routingLabel = getLeadDesignRoutingSummary(lead);
            const customer = lead.customers;

            return (
              <article key={lead.id} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 max-w-3xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold text-slate-950">{customer?.display_name || "ลูกค้าไม่ระบุชื่อ"}</h2>
                      <Badge className="border border-violet-200 bg-violet-50 text-violet-800">{lead.ai_image_status || "not_requested"}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {getProductTypeLabel(lead.product_type) || lead.product_type || "ไม่ระบุสินค้า"} · {formatBangkokDate(lead.created_at)}
                    </p>
                    {customer?.id ? (
                      <Link href={`/admin/customers/${customer.id}`} className="mt-2 inline-flex text-xs font-semibold text-sky-700 hover:text-sky-900">
                        เปิดโปรไฟล์ลูกค้า
                      </Link>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <LeadPromptActions leadId={lead.id} prompt={prompt} promptRoutingLabel={routingLabel} buttonLabel="แก้พรอมพ์" />
                    <LeadAiPreviewActions leadId={lead.id} prompt={prompt} status={lead.ai_image_status || "not_requested"} />
                  </div>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_1.3fr]">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Design brief</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{lead.design_brief || "ยังไม่มี design brief"}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Prompt override</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{lead.ai_image_prompt || "ยังไม่มี prompt override"}</p>
                  </div>
                  <div className="rounded-2xl border border-dashed border-violet-200 bg-violet-50/60 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-violet-700">Final prompt</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{prompt ? truncate(prompt) : "ยังไม่มี prompt ที่พร้อมใช้"}</p>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </div>
  );
}
