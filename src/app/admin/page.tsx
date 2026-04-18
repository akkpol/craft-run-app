import { getRuntimeAppConfig } from "@/lib/app-settings";
import {
  fetchBackofficeSnapshot,
  getBackofficeKpis,
} from "@/lib/backoffice-snapshot";
import {
  DESIGN_STATUS_LABELS,
  JOB_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_TERM_LABELS,
  PRODUCT_TYPES,
  WORKFLOW_STATE_LABELS,
} from "@/lib/types";
import AdminJobActions from "./job-actions";
import AdminQuoteActions from "./quote-actions";
import AdminConversationActions from "./conversation-actions";
import LeadAiPreviewActions from "./lead-ai-preview-actions";
import AdminLeadDesignActions from "./lead-design-actions";
import Link from "next/link";
import {
  PRODUCTION_EVENT_TYPE_LABELS,
} from "@/lib/production-review";
import {
  buildProductionLinkUrl,
} from "@/lib/production-links";
import { getShareableProductionToken, isExpired } from "@/lib/production-media";
import ProductionReviewActions from "./production-review-actions";
import ProductionLinkCopy from "./production-link-copy";
import { firstRow } from "@/lib/utils";

export const dynamic = "force-dynamic";

function getJobBadgeTone(status: string): string {
  if (status === "COMPLETED") {
    return "bg-green-100 text-green-700";
  }

  if (status === "IN_PRODUCTION") {
    return "bg-yellow-100 text-yellow-700";
  }

  if (status === "IN_DESIGN") {
    return "bg-violet-100 text-violet-700";
  }

  if (status === "READY_FOR_FULFILLMENT") {
    return "bg-blue-100 text-blue-700";
  }

  if (status === "ON_HOLD_CUSTOMER_INPUT") {
    return "bg-amber-100 text-amber-700";
  }

  if (status === "HUMAN_REVIEW_REQUIRED") {
    return "bg-rose-100 text-rose-700";
  }

  if (status === "CANCELLED") {
    return "bg-red-100 text-red-700";
  }

  return "bg-gray-100 text-gray-600";
}

function getConversationBadgeTone(state: string): string {
  if (state === "WAITING_PAYMENT") {
    return "bg-amber-100 text-amber-700";
  }

  if (state === "WAITING_QUOTE_APPROVAL") {
    return "bg-yellow-100 text-yellow-700";
  }

  if (state === "IN_DESIGN") {
    return "bg-violet-100 text-violet-700";
  }

  if (state === "IN_PRODUCTION") {
    return "bg-yellow-100 text-yellow-700";
  }

  if (state === "READY_FOR_FULFILLMENT") {
    return "bg-blue-100 text-blue-700";
  }

  if (state === "ON_HOLD_CUSTOMER_INPUT") {
    return "bg-amber-100 text-amber-700";
  }

  if (state === "HUMAN_REVIEW_REQUIRED") {
    return "bg-rose-100 text-rose-700";
  }

  if (state === "COMPLETED") {
    return "bg-green-100 text-green-700";
  }

  if (state === "CANCELLED") {
    return "bg-red-100 text-red-700";
  }

  return "bg-gray-100 text-gray-600";
}

export default async function AdminPage() {
  const config = await getRuntimeAppConfig();
  const snapshot = await fetchBackofficeSnapshot();
  const leads = snapshot.leads;
  const quotes = snapshot.quotes;
  const jobs = snapshot.jobs;
  const productionReviewQueue = snapshot.productionReviewQueue;
  const pendingProductionReviewQueue = productionReviewQueue.filter(
    (event) => event.review_status === "pending"
  );
  const approvedProductionReviewQueue = productionReviewQueue.filter(
    (event) => event.review_status === "approved"
  );
  const escalations = snapshot.escalations;
  const conversations = snapshot.recentConversations;
  const kpis = getBackofficeKpis(snapshot);
  const blockedConversations = conversations.filter((conversation) =>
    ["WAITING_PAYMENT", "ON_HOLD_CUSTOMER_INPUT", "HUMAN_REVIEW_REQUIRED"].includes(
      conversation.state
    )
  );

  const baseUrl = config.baseUrl;
  const sentQuotes = quotes.filter((q) => q.status === "sent");
  const actionQueueCount =
    pendingProductionReviewQueue.length + sentQuotes.length + blockedConversations.length;

  return (
    <div className="pb-2 text-slate-900">
      {/* Header */}
      <div className="mx-4 mt-4 overflow-hidden rounded-[28px] border border-slate-800/80 bg-[#0f172a] text-white shadow-[0_24px_60px_rgba(15,23,42,0.28)]">
        <div className="flex items-start justify-between gap-4 px-6 py-5">
          <div>
            <h1 className="text-xl font-bold">🏭 FOGUS Admin</h1>
            <p className="text-sm text-gray-300">Dashboard</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/studio"
              className="rounded-lg border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-xs font-medium text-emerald-100 transition hover:bg-emerald-400/15"
            >
              เปิด Cute Studio
            </Link>
            <Link
              href="/admin/settings"
              className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs font-medium text-white transition hover:bg-white/15"
            >
              Settings
            </Link>
            <Link
              href="/flow"
              target="_blank"
              className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs font-medium text-white transition hover:bg-white/15"
            >
              เปิดหน้า Customer Flow
            </Link>
          </div>
        </div>
      </div>

      <div className="px-4 pb-4">
        <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                Action Queue
              </p>
              <h2 className="mt-2 text-lg font-semibold text-slate-950">
                สิ่งที่ต้องลงมือตอนนี้
              </h2>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
              {actionQueueCount} รายการ
            </span>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-[1.4fr_1fr]">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-amber-900">
                    1. Production review
                  </h3>
                  <p className="mt-1 text-xs text-amber-700">
                    หลักฐานจากหน้างานที่ยังรอแอดมินตรวจ
                  </p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-amber-700">
                  {pendingProductionReviewQueue.length}
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {pendingProductionReviewQueue.slice(0, 3).map((event) => {
                  const job = firstRow(event.jobs);
                  const quote = firstRow(job?.quotes);
                  const lead = firstRow(quote?.leads);
                  const customer = firstRow(lead?.customers);

                  return (
                    <div
                      key={event.id}
                      className="rounded-2xl border border-amber-200/70 bg-white px-4 py-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            {customer?.display_name || "ลูกค้า"}
                          </p>
                          <p className="text-xs text-slate-500">
                            {PRODUCTION_EVENT_TYPE_LABELS[event.event_type]} ·{" "}
                            {new Date(event.created_at).toLocaleString("th-TH")}
                          </p>
                        </div>
                        <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-800">
                          pending
                        </span>
                      </div>
                    </div>
                  );
                })}
                {pendingProductionReviewQueue.length === 0 ? (
                  <p className="text-sm text-amber-700">ยังไม่มีหลักฐานที่รอตรวจ</p>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    2. งานรอจ่าย / รออนุมัติ / รอคนตอบ
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    รวม quote ที่ยังไม่ approve และ conversation ที่ติดค้าง
                  </p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700">
                  {sentQuotes.length + blockedConversations.length}
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {sentQuotes
                  .slice(0, 2)
                  .map((quote) => (
                    <div
                      key={quote.id}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3"
                    >
                      <p className="text-sm font-medium text-slate-900">
                        {quote.leads?.customers?.display_name || "ลูกค้า"}
                      </p>
                      <p className="text-xs text-slate-500">
                        รออนุมัติใบเสนอราคา · ฿{Number(quote.total).toLocaleString()}
                      </p>
                    </div>
                  ))}
                {blockedConversations.slice(0, 2).map((conversation) => (
                  <div
                    key={conversation.id}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3"
                  >
                    <p className="text-sm font-medium text-slate-900">
                      LINE {conversation.line_user_id.slice(0, 12)}...
                    </p>
                    <p className="text-xs text-slate-500">
                      {WORKFLOW_STATE_LABELS[conversation.state]}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="px-4 py-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="admin-kpi-card p-4">
            <p className="text-2xl font-bold text-[#1a1a2e]">{kpis.leadsCount}</p>
            <p className="text-xs text-gray-500">Leads</p>
          </div>
          <div className="admin-kpi-card p-4">
            <p className="text-2xl font-bold text-yellow-600">{kpis.quotesWaitingApproval}</p>
            <p className="text-xs text-gray-500">รอลูกค้าอนุมัติ</p>
          </div>
          <div className="admin-kpi-card p-4">
            <p className="text-2xl font-bold text-blue-600">{kpis.activeJobsCount}</p>
            <p className="text-xs text-gray-500">งานที่กำลังทำ</p>
          </div>
          <div className="admin-kpi-card p-4">
            <p className="text-2xl font-bold text-red-600">{kpis.escalationsCount}</p>
            <p className="text-xs text-gray-500">Escalations</p>
          </div>
        </div>
      </div>

      <div className="px-4 pb-4">
        <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Production Review</h2>
              <p className="mt-1 text-sm text-slate-500">
                หลักฐานจากหน้างานจะเข้าคิวที่นี่ก่อนส่งให้ลูกค้า
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
              {pendingProductionReviewQueue.length} pending · {approvedProductionReviewQueue.length} approved
            </span>
          </div>

          <div className="mt-5 space-y-4">
            {productionReviewQueue.map((event) => {
              const job = firstRow(event.jobs);
              const quote = firstRow(job?.quotes);
              const lead = firstRow(quote?.leads);
              const customer = firstRow(lead?.customers);
              const link =
                event.job_production_links?.status === "active"
                  ? buildProductionLinkUrl(
                      baseUrl,
                      getShareableProductionToken(event.job_production_links.id)
                    )
                  : null;

              return (
                <div
                  key={event.id}
                  className="rounded-[24px] border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">
                        {customer?.display_name || "ลูกค้า"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {PRODUCTION_EVENT_TYPE_LABELS[event.event_type]} ·{" "}
                        {new Date(event.created_at).toLocaleString("th-TH")}
                      </p>
                      {event.note ? (
                        <p className="mt-2 text-sm text-slate-700">{event.note}</p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                        event.review_status === "approved"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      }`}>
                        {event.review_status}
                      </span>
                      {quote?.public_token ? (
                        <a
                          href={`${baseUrl}/status/${quote.public_token}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-blue-600 underline"
                        >
                          เปิด status
                        </a>
                      ) : null}
                    </div>
                  </div>

                  {Array.isArray(event.job_media_assets) && event.job_media_assets.length > 0 ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {event.job_media_assets.map((asset) =>
                        asset.signed_url ? (
                          <a
                            key={asset.id}
                            href={asset.signed_url}
                            target="_blank"
                            rel="noreferrer"
                            className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
                          >
                            <img
                              src={asset.signed_url}
                              alt="Production upload"
                              className="h-24 w-24 object-cover"
                            />
                          </a>
                        ) : null
                      )}
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <ProductionReviewActions
                      eventId={event.id}
                      reviewStatus={event.review_status}
                    />
                    {link ? <ProductionLinkCopy url={link} compact /> : null}
                  </div>
                </div>
              );
            })}
            {productionReviewQueue.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                ยังไม่มีหลักฐานจาก production ที่รอแอดมินตรวจ
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Escalations */}
      {escalations.length > 0 && (
        <div className="px-4 pb-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <h2 className="text-sm font-bold text-red-700 mb-2">🚨 ต้องตรวจสอบ ({escalations.length})</h2>
            {escalations.map((esc) => (
              <div key={esc.id} className="flex items-center justify-between gap-3 py-2 border-b border-red-100 last:border-0">
                <div>
                  <p className="text-red-800">{esc.reason}</p>
                  <p className="text-red-400 text-xs mt-1">
                    LINE: {esc.conversations?.line_user_id || "?"} · {new Date(esc.created_at).toLocaleString("th-TH")}
                  </p>
                </div>
                {esc.conversations?.id ? (
                  <AdminConversationActions
                    conversationId={esc.conversations.id}
                    currentState={esc.conversations.state}
                    compact
                  />
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Jobs */}
      <div className="px-4 pb-4">
        <h2 className="text-sm font-bold text-gray-700 mb-2">📋 Jobs ({jobs.length})</h2>
        <div className="space-y-2">
          {jobs.map((job) => {
            const productLabel = PRODUCT_TYPES.find((p) => p.value === job.quotes?.leads?.product_type)?.label || "ไม่ระบุ";
            const activeLink = (job.job_production_links || []).find(
              (link) => link.status === "active" && !isExpired(link.expires_at)
            );
            const pendingReviewCount = (job.job_media_events || []).filter(
              (event) => event.review_status === "pending"
            ).length;
            const lastUploadAt = (job.job_media_events || [])
              .slice()
              .sort(
                (left, right) =>
                  new Date(right.created_at).getTime() -
                  new Date(left.created_at).getTime()
              )[0]?.created_at;
            const productionLinkUrl = activeLink
              ? buildProductionLinkUrl(
                  baseUrl,
                  getShareableProductionToken(activeLink.id)
                )
              : null;
            return (
              <div key={job.id} className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-sm font-medium">{job.quotes?.leads?.customers?.display_name || "ลูกค้า"}</span>
                    <span className="text-xs text-gray-400 ml-2">{productLabel}</span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getJobBadgeTone(job.status)}`}>
                    {JOB_STATUS_LABELS[job.status] || job.status}
                  </span>
                </div>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  {activeLink ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700">
                      มี production link
                    </span>
                  ) : null}
                  {pendingReviewCount > 0 ? (
                    <span className="rounded-full bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700">
                      รอตรวจ {pendingReviewCount}
                    </span>
                  ) : null}
                  {lastUploadAt ? (
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
                      last upload {new Date(lastUploadAt).toLocaleDateString("th-TH")}
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">{new Date(job.created_at).toLocaleDateString("th-TH")}</span>
                  <div className="flex gap-2 items-center">
                    {job.quotes?.public_token && (
                      <a href={`${baseUrl}/status/${job.quotes.public_token}`} target="_blank" rel="noreferrer" className="text-xs text-blue-500 underline">status</a>
                    )}
                    {productionLinkUrl ? (
                      <ProductionLinkCopy url={productionLinkUrl} compact />
                    ) : null}
                    <AdminJobActions jobId={job.id} currentStatus={job.status} />
                  </div>
                </div>
              </div>
            );
          })}
          {jobs.length === 0 && <p className="text-sm text-gray-400 text-center py-4">ยังไม่มี jobs</p>}
        </div>
      </div>

      {/* Quotes */}
      <div className="px-4 pb-4">
        <h2 className="text-sm font-bold text-gray-700 mb-2">📄 Quotes ({quotes.length})</h2>
        <div className="space-y-2">
          {quotes.map((q) => (
            <div key={q.id} className="bg-white rounded-xl p-4 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{q.leads?.customers?.display_name || "ลูกค้า"}</p>
                <p className="text-xs text-gray-400">
                  {PRODUCT_TYPES.find((p) => p.value === q.leads?.product_type)?.label || q.leads?.product_type} · ฿{Number(q.total).toLocaleString()}
                </p>
                <p className="text-[11px] text-gray-500 mt-1">
                  {PAYMENT_TERM_LABELS[q.payment_terms as keyof typeof PAYMENT_TERM_LABELS]} · {PAYMENT_STATUS_LABELS[q.payment_status as keyof typeof PAYMENT_STATUS_LABELS]}
                </p>
              </div>
              <div className="text-right">
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  q.status === "approved" ? "bg-green-100 text-green-700" :
                  q.status === "sent" ? "bg-yellow-100 text-yellow-700" :
                  "bg-gray-100 text-gray-600"
                }`}>{q.status}</span>
                <div className="mt-1">
                  <a href={`${baseUrl}/quote/${q.public_token}`} target="_blank" rel="noreferrer" className="text-xs text-blue-500 underline">ดู</a>
                </div>
                <AdminQuoteActions
                  quoteId={q.id}
                  publicToken={q.public_token}
                  quoteStatus={q.status}
                  paymentTerms={q.payment_terms}
                  paymentStatus={q.payment_status}
                  hasJob={Array.isArray(q.jobs) && q.jobs.length > 0}
                />
              </div>
            </div>
          ))}
          {quotes.length === 0 && <p className="text-sm text-gray-400 text-center py-4">ยังไม่มี quotes</p>}
        </div>
      </div>

      {/* Leads */}
      <div className="px-4 pb-4">
        <h2 className="text-sm font-bold text-gray-700 mb-2">🎯 Leads ({leads.length})</h2>
        <div className="space-y-2">
          {leads.map((l) => (
            <div key={l.id} className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{l.customers?.display_name || "ลูกค้า"}</p>
                  <p className="text-xs text-gray-400">
                    {PRODUCT_TYPES.find((p) => p.value === l.product_type)?.label || l.product_type} · {(l.width_mm / 10).toFixed(0)}×{(l.height_mm / 10).toFixed(0)} ซม. × {l.qty}
                  </p>
                  {l.ai_image_prompt ? (
                    <p className="mt-1 text-xs text-gray-500">AI prompt: {l.ai_image_prompt}</p>
                  ) : null}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${l.status === "new" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>{l.status}</span>
              </div>
              {Array.isArray(l.ai_generated_images) && l.ai_generated_images.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {l.ai_generated_images.map((imageUrl) => (
                    <a key={imageUrl} href={imageUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-gray-200">
                      <img src={imageUrl} alt="AI preview" className="h-20 w-20 object-cover" />
                    </a>
                  ))}
                </div>
              ) : null}
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="space-y-1 text-[11px] text-gray-500">
                  <p>
                    {l.ai_image_status ? `AI status: ${l.ai_image_status}` : "AI status: not_requested"}
                  </p>
                  {l.design_status ? (
                    <p>Design: {DESIGN_STATUS_LABELS[l.design_status as keyof typeof DESIGN_STATUS_LABELS] || l.design_status}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <LeadAiPreviewActions leadId={l.id} prompt={l.ai_image_prompt || ""} status={l.ai_image_status || "not_requested"} />
                  <AdminLeadDesignActions leadId={l.id} designStatus={l.design_status || "not_started"} />
                </div>
              </div>
            </div>
          ))}
          {leads.length === 0 && <p className="text-sm text-gray-400 text-center py-4">ยังไม่มี leads</p>}
        </div>
      </div>

      {/* Recent Conversations */}
      <div className="px-4 pb-8">
        <h2 className="text-sm font-bold text-gray-700 mb-2">💬 Recent Conversations ({conversations.length})</h2>
        <div className="space-y-2">
          {conversations.map((c) => (
            <div key={c.id} className="bg-white rounded-xl p-3 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-mono text-gray-500">{c.line_user_id.slice(0, 12)}...</p>
                <p className="text-xs text-gray-400">{new Date(c.last_message_at).toLocaleString("th-TH")}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full ${getConversationBadgeTone(c.state)}`}>
                  {WORKFLOW_STATE_LABELS[c.state] || c.state}
                </span>
                <AdminConversationActions
                  conversationId={c.id}
                  currentState={c.state}
                  compact
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
