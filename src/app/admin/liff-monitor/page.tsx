import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { formatBangkokDateTime } from "@/lib/bangkok-date-time";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as JsonRecord;
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value
    .map((entry) => asString(entry))
    .filter((entry): entry is string => Boolean(entry));
}

function compactId(value: string | null | undefined, head = 8, tail = 6) {
  if (!value) {
    return "-";
  }

  if (value.length <= head + tail + 3) {
    return value;
  }

  return `${value.slice(0, head)}...${value.slice(-tail)}`;
}

function formatDateTime(value: string | null | undefined) {
  return formatBangkokDateTime(value);
}

function getSinceHoursIsoString(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function getStageLabel(stage: string | null | undefined) {
  switch (stage) {
    case "sdk_load_timeout":
      return "SDK โหลดไม่ขึ้น";
    case "init_failed":
      return "init ล้มเหลว";
    case "prefill_http_error":
      return "prefill ตอบ error";
    case "prefill_failed":
      return "prefill request ล้มเหลว";
    case "submit_missing_identity":
      return "submit ไม่มี token";
    case "prefill_verify_token_failed":
      return "prefill token ไม่ผ่าน";
    case "intake_verify_token_failed":
      return "intake token ไม่ผ่าน";
    case "intake_access_profile_failed":
      return "อ่าน access profile ไม่ได้";
    default:
      return stage || "ไม่ระบุ stage";
  }
}

function getStageVariant(stage: string | null | undefined): "success" | "warning" | "info" | "outline" {
  switch (stage) {
    case "sdk_load_timeout":
    case "init_failed":
    case "prefill_verify_token_failed":
    case "intake_verify_token_failed":
      return "warning";
    case "prefill_http_error":
    case "prefill_failed":
    case "intake_access_profile_failed":
    case "submit_missing_identity":
      return "info";
    default:
      return "outline";
  }
}

function getValidationVariant(
  passed: boolean | null | undefined
): "success" | "warning" | "outline" {
  if (passed === true) {
    return "success";
  }

  if (passed === false) {
    return "warning";
  }

  return "outline";
}

const OPS_FILTERS = [
  { key: "all", label: "All" },
  { key: "errors", label: "Errors" },
  { key: "webhook", label: "Webhook" },
  { key: "reply", label: "Reply" },
  { key: "push", label: "Push" },
  { key: "quote", label: "Quote" },
  { key: "document", label: "Document" },
  { key: "liff", label: "LIFF" },
] as const;

type OpsFilter = (typeof OPS_FILTERS)[number]["key"];
type OpsSeverity = "success" | "warning" | "info";

type OpsRow = {
  id: string;
  actionRef: string | null;
  actionType: string | null;
  actorLabel: string | null;
  actorType: string | null;
  entityType: string | null;
  entityId: string | null;
  note: string | null;
  createdAt: string | null;
  payload: JsonRecord | null;
  source: string;
  flow: string;
  severity: OpsSeverity;
  summary: string;
  detail: string;
};

type AdminLiffMonitorPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function normalizeFilter(value: string | string[] | undefined): OpsFilter {
  const candidate = Array.isArray(value) ? value[0] : value;
  return OPS_FILTERS.some((option) => option.key === candidate)
    ? (candidate as OpsFilter)
    : "all";
}

function isBlockingLiffStage(stage: string | null | undefined) {
  return ["sdk_load_timeout", "init_failed", "prefill_verify_token_failed", "intake_verify_token_failed"].includes(
    stage || ""
  );
}

function isOpsRelevantActionType(actionType: string | null | undefined) {
  if (!actionType) {
    return false;
  }

  return (
    actionType.startsWith("line.") ||
    actionType.startsWith("liff.") ||
    actionType.startsWith("commercial.") ||
    actionType.startsWith("production.") ||
    actionType.startsWith("quote.") ||
    actionType === "job.status_changed" ||
    actionType === "follow_up_sent" ||
    actionType === "lead.design_preview_sent" ||
    actionType === "message.unsent" ||
    actionType === "conversation.escalated"
  );
}

function getOpsSource(actionType: string | null | undefined) {
  if (!actionType) {
    return "workflow";
  }

  if (actionType === "line.webhook_received" || actionType === "message.unsent") {
    return "webhook";
  }

  if (actionType === "line.reply_sent" || actionType === "line.reply_failed") {
    return "reply";
  }

  if (actionType === "line.push_sent" || actionType === "line.push_failed" || actionType === "follow_up_sent") {
    return "push";
  }

  if (actionType.startsWith("liff.")) {
    return "liff";
  }

  if (actionType.startsWith("commercial.")) {
    return "document";
  }

  if (actionType.startsWith("quote.")) {
    return "quote";
  }

  return "workflow";
}

function getOpsFlow(actionType: string | null | undefined, payload: JsonRecord | null) {
  const declaredFlow = asString(payload?.flow);
  if (declaredFlow) {
    return declaredFlow;
  }

  const pushVariant = asString(payload?.push_variant);
  if (pushVariant) {
    return pushVariant;
  }

  const replyVariant = asString(payload?.reply_variant);
  if (replyVariant) {
    return replyVariant;
  }

  if (!actionType) {
    return "workflow";
  }

  if (actionType.startsWith("liff.")) {
    return "liff";
  }

  if (actionType.startsWith("commercial.")) {
    return "commercial";
  }

  if (actionType.startsWith("quote.")) {
    return "quote";
  }

  if (actionType.startsWith("production.") || actionType === "job.status_changed") {
    return "production";
  }

  if (actionType === "follow_up_sent") {
    return "follow_up";
  }

  return "workflow";
}

function humanizeOpsToken(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const labelMap: Record<string, string> = {
    intake_link: "intake link",
    resume_or_fresh: "resume or fresh",
    quote_link: "quote link",
    quote_context: "quote context",
    quote_context_missing_link: "quote context (missing link)",
    payment_context: "payment context",
    payment_context_missing_link: "payment context (missing link)",
    production_status: "production status",
    production_status_missing_link: "production status (missing link)",
    terminal_follow_up: "terminal follow-up",
    status_update: "status update",
    production_evidence: "production evidence",
    design_preview: "design preview",
    follow_up: "follow-up",
    support: "support",
  };

  return labelMap[value] || value.replace(/_/g, " ");
}

function getOpsSeverity(actionType: string | null | undefined, payload: JsonRecord | null): OpsSeverity {
  const stage = asString(payload?.stage);

  if (
    actionType === "line.reply_failed" ||
    actionType === "line.push_failed" ||
    actionType === "message.unsent" ||
    actionType === "commercial.document_delivery_skipped_no_token" ||
    actionType === "commercial.document_delivery_skipped_no_conv" ||
    actionType === "commercial.document_delivery_skipped_conv_missing" ||
    actionType === "commercial.document_delivery_skipped_no_user_id" ||
    (actionType?.startsWith("liff.") && isBlockingLiffStage(stage))
  ) {
    return "warning";
  }

  if (
    actionType === "line.reply_sent" ||
    actionType === "line.push_sent" ||
    actionType === "quote.created" ||
    actionType === "quote.sent" ||
    actionType === "quote.approved" ||
    actionType === "quote.rejected" ||
    actionType === "commercial.document_issued" ||
    actionType === "commercial.document_sent" ||
    actionType === "commercial.payment_confirmed" ||
    actionType === "production.event_sent" ||
    actionType === "follow_up_sent" ||
    actionType === "lead.design_preview_sent"
  ) {
    return "success";
  }

  return "info";
}

function getSeverityVariant(severity: OpsSeverity): "success" | "warning" | "info" {
  if (severity === "success") {
    return "success";
  }

  if (severity === "warning") {
    return "warning";
  }

  return "info";
}

function getOpsSummary(actionType: string | null | undefined, note: string | null, payload: JsonRecord | null) {
  switch (actionType) {
    case "line.webhook_received":
      return "Inbound webhook received";
    case "line.reply_sent":
      return `Reply sent: ${humanizeOpsToken(asString(payload?.reply_variant))}`;
    case "line.reply_failed":
      return `Reply failed: ${humanizeOpsToken(asString(payload?.reply_variant))}`;
    case "line.push_sent":
      return `Push sent: ${humanizeOpsToken(asString(payload?.push_variant))}`;
    case "line.push_failed":
      return `Push failed: ${humanizeOpsToken(asString(payload?.push_variant))}`;
    case "quote.created":
      return "Quote created";
    case "quote.sent":
      return "Quote delivered";
    case "quote.approved":
      return "Quote approved";
    case "quote.rejected":
      return "Quote rejected";
    case "commercial.document_issued":
      return "Commercial document issued";
    case "commercial.document_sent":
      return "Commercial document delivered";
    case "commercial.document_delivery_skipped_no_token":
      return "Document delivery skipped (no quote token)";
    case "commercial.document_delivery_skipped_no_conv":
      return "Document delivery skipped (no conversation id)";
    case "commercial.document_delivery_skipped_conv_missing":
      return "Document delivery skipped (conversation not found)";
    case "commercial.document_delivery_skipped_no_user_id":
      return "Document delivery skipped (no LINE user id)";
    case "commercial.payment_confirmed":
      return "Payment confirmed";
    case "job.status_changed":
      return `Job status -> ${asString(payload?.to) || "updated"}`;
    case "production.event_sent":
      return "Production event sent to customer";
    case "follow_up_sent":
      return "Follow-up batch sent";
    case "lead.design_preview_sent":
      return "Design preview sent";
    case "message.unsent":
      return "Customer unsent a LINE message";
    default:
      if (actionType?.startsWith("liff.")) {
        return note || getStageLabel(asString(payload?.stage));
      }

      return note || actionType || "LINE event";
  }
}

function getOpsDetail(actionType: string | null | undefined, note: string | null, payload: JsonRecord | null) {
  const stage = asString(payload?.stage);
  const errorMessage = asString(payload?.error_message);

  if (actionType === "line.webhook_received") {
    return [
      `state ${asString(payload?.conversation_state) || "-"}`,
      `len ${typeof payload?.message_length === "number" ? payload.message_length : "-"}`,
      `reused ${asBoolean(payload?.reused_conversation) === true ? "yes" : "no"}`,
    ].join(" | ");
  }

  if (actionType === "line.reply_sent" || actionType === "line.reply_failed") {
    return [
      humanizeOpsToken(asString(payload?.reply_variant)),
      asString(payload?.conversation_state),
      errorMessage,
    ]
      .filter(Boolean)
      .join(" | ");
  }

  if (actionType === "line.push_sent" || actionType === "line.push_failed") {
    return [
      humanizeOpsToken(asString(payload?.push_variant)),
      asString(payload?.status),
      asString(payload?.conversation_state),
      asString(payload?.event_type),
      errorMessage,
    ]
      .filter(Boolean)
      .join(" | ");
  }

  if (actionType?.startsWith("liff.")) {
    return [
      stage ? `stage ${getStageLabel(stage)}` : null,
      asString(payload?.pathname),
      asString(payload?.message),
      asString(payload?.lineUserHint),
    ]
      .filter(Boolean)
      .join(" | ");
  }

  if (actionType === "quote.created") {
    return [
      asString(payload?.payment_terms) ? `payment ${asString(payload?.payment_terms)}` : null,
      typeof payload?.total === "number" ? `total ${payload.total}` : null,
      asString(payload?.to_state) ? `to ${asString(payload?.to_state)}` : null,
    ]
      .filter(Boolean)
      .join(" | ");
  }

  if (actionType === "quote.sent") {
    return [
      asString(payload?.quote_token) ? `token ${asString(payload?.quote_token)}` : null,
      asString(payload?.line_user_id) ? `user ${compactId(asString(payload?.line_user_id), 6, 4)}` : null,
      note,
    ]
      .filter(Boolean)
      .join(" | ");
  }

  if (actionType === "commercial.document_issued" || actionType === "commercial.document_sent") {
    return [
      asString(payload?.document_number),
      asString(payload?.document_type),
      asString(payload?.line_user_id) ? `user ${compactId(asString(payload?.line_user_id), 6, 4)}` : null,
      note,
    ]
      .filter(Boolean)
      .join(" | ");
  }

  if (actionType?.startsWith("commercial.document_delivery_skipped")) {
    return [
      asString(payload?.document_number),
      asString(payload?.document_type),
      asString(payload?.skip_reason)?.replace(/_/g, " "),
      asString(payload?.conversation_id)
        ? `conv ${compactId(asString(payload?.conversation_id), 8, 6)}`
        : null,
      asString(payload?.line_user_id)
        ? `user ${compactId(asString(payload?.line_user_id), 6, 4)}`
        : null,
      asString(payload?.detail),
    ]
      .filter(Boolean)
      .join(" | ");
  }

  if (actionType === "job.status_changed") {
    return [
      asString(payload?.from) ? `from ${asString(payload?.from)}` : null,
      asString(payload?.to) ? `to ${asString(payload?.to)}` : null,
      note,
    ]
      .filter(Boolean)
      .join(" | ");
  }

  return note || errorMessage || "No extra detail";
}

function matchesFilter(row: OpsRow, filter: OpsFilter) {
  if (filter === "all") {
    return true;
  }

  if (filter === "errors") {
    return row.severity === "warning";
  }

  return row.source === filter;
}

export default async function AdminLiffMonitorPage({ searchParams }: AdminLiffMonitorPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const activeFilter = normalizeFilter(resolvedSearchParams.filter);
  const supabase = createAdminClient();
  const since24h = getSinceHoursIsoString(24);

  const [{ data: actionEntries }, { data: customers }, { data: leads }, { data: latestValidationRun }] = await Promise.all([
    supabase
      .from("action_log")
      .select("id, action_ref, action_type, actor_type, actor_label, entity_type, entity_id, note, payload, created_at")
      .order("created_at", { ascending: false })
      .limit(160),
    supabase
      .from("customers")
      .select("id, display_name, line_user_id, line_friendship_status, created_at, last_liff_context")
      .not("last_liff_context", "is", null)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("leads")
      .select("id, product_type, status, created_at, liff_context_snapshot, customers(display_name)")
      .not("liff_context_snapshot", "is", null)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("liff_validation_runs")
      .select("id, created_at, passed, failed_checks")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const opsRows = (actionEntries || [])
    .map((row) => {
      const actionType = asString(row.action_type);
      if (!isOpsRelevantActionType(actionType)) {
        return null;
      }

      const payload = asRecord(row.payload);
      const severity = getOpsSeverity(actionType, payload);

      return {
        id: asString(row.id) || `${row.action_ref || row.created_at}`,
        actionRef: asString(row.action_ref),
        actionType,
        actorLabel: asString(row.actor_label),
        actorType: asString(row.actor_type),
        entityType: asString(row.entity_type),
        entityId: asString(row.entity_id),
        note: asString(row.note),
        createdAt: asString(row.created_at),
        payload,
        source: getOpsSource(actionType),
        flow: getOpsFlow(actionType, payload),
        severity,
        summary: getOpsSummary(actionType, asString(row.note), payload),
        detail: getOpsDetail(actionType, asString(row.note), payload),
      } satisfies OpsRow;
    })
    .filter((row): row is OpsRow => Boolean(row));

  const filterCounts = OPS_FILTERS.reduce<Record<OpsFilter, number>>((acc, option) => {
    acc[option.key] =
      option.key === "all" ? opsRows.length : opsRows.filter((row) => matchesFilter(row, option.key)).length;
    return acc;
  }, {} as Record<OpsFilter, number>);

  const visibleRows = opsRows.filter((row) => matchesFilter(row, activeFilter)).slice(0, 80);

  const liffIncidentRows = (actionEntries || [])
    .filter((row) => asString(row.action_type)?.startsWith("liff."))
    .map((row) => {
    const payload = asRecord(row.payload);
    const context = asRecord(payload?.context);

    return {
      id: asString(row.id) || `${row.action_ref || row.created_at}`,
      actionRef: asString(row.action_ref),
      actionType: asString(row.action_type),
      actorLabel: asString(row.actor_label),
      note: asString(row.note),
      createdAt: asString(row.created_at),
      fingerprint: asString(payload?.fingerprint),
      stage: asString(payload?.stage),
      message: asString(payload?.message),
      pathname: asString(payload?.pathname),
      searchParamKeys: asStringArray(payload?.searchParamKeys),
      lineUserId: asString(payload?.lineUserId),
      lineUserHint: asString(payload?.lineUserHint),
      intakeMode: asString(payload?.intakeMode),
      sdkPresent: asBoolean(payload?.sdkPresent),
      liffIdConfigured: asBoolean(payload?.liffIdConfigured),
      appLanguage: asString(context?.appLanguage),
      liffSdkVersion: asString(context?.liffSdkVersion),
      lineVersion: asString(context?.lineVersion),
      isInClient: asBoolean(context?.isInClient),
      isLoggedIn: asBoolean(context?.isLoggedIn),
      contextType: asString(asRecord(context?.context)?.type),
      grantedScopes: asStringArray(context?.grantedScopes),
    };
  });

  const recentLiffIncidentCount = liffIncidentRows.filter((row) => {
    if (!row.createdAt) {
      return false;
    }

    return row.createdAt >= since24h;
  }).length;

  const blockingIncidentCount = liffIncidentRows.filter((row) => isBlockingLiffStage(row.stage)).length;
  const latestValidationFailedChecks = asStringArray(latestValidationRun?.failed_checks);
  const recentWebhookCount = opsRows.filter(
    (row) => row.actionType === "line.webhook_received" && row.createdAt && row.createdAt >= since24h
  ).length;
  const recentTransportFailureCount = opsRows.filter(
    (row) =>
      row.createdAt &&
      row.createdAt >= since24h &&
      ["line.reply_failed", "line.push_failed", "message.unsent"].includes(row.actionType || "")
  ).length;
  const recentQuoteCreateCount = opsRows.filter(
    (row) => row.actionType === "quote.created" && row.createdAt && row.createdAt >= since24h
  ).length;
  const recentQuoteSentCount = opsRows.filter(
    (row) => row.actionType === "quote.sent" && row.createdAt && row.createdAt >= since24h
  ).length;
  const recentDocumentIssuedCount = opsRows.filter(
    (row) => row.actionType === "commercial.document_issued" && row.createdAt && row.createdAt >= since24h
  ).length;
  const recentDocumentSentCount = opsRows.filter(
    (row) => row.actionType === "commercial.document_sent" && row.createdAt && row.createdAt >= since24h
  ).length;
  const quoteDeliveryGapCount = Math.max(recentQuoteCreateCount - recentQuoteSentCount, 0);
  const documentDeliveryGapCount = Math.max(recentDocumentIssuedCount - recentDocumentSentCount, 0);
  const activeAlertRules = [
    {
      key: "transport",
      label: "Outbound failures",
      state: recentTransportFailureCount > 0 ? "warning" : "success",
      detail:
        recentTransportFailureCount > 0
          ? `${recentTransportFailureCount} reply/push failures or unsent events in last 24h`
          : "No reply/push failure signal in last 24h",
    },
    {
      key: "delivery-gap",
      label: "Quote / document delivery gap",
      state: quoteDeliveryGapCount > 0 || documentDeliveryGapCount > 0 ? "warning" : "success",
      detail:
        quoteDeliveryGapCount > 0 || documentDeliveryGapCount > 0
          ? `${quoteDeliveryGapCount} quote(s) and ${documentDeliveryGapCount} document(s) missing LINE delivery proof in last 24h`
          : "Quote and document delivery are in sync",
    },
    {
      key: "liff",
      label: "LIFF regression",
      state:
        latestValidationRun?.passed === false || blockingIncidentCount > 0 || recentLiffIncidentCount >= 3
          ? "warning"
          : "success",
      detail:
        latestValidationRun?.passed === false
          ? `Latest validation failed: ${latestValidationFailedChecks.join(", ") || "unknown checks"}`
          : blockingIncidentCount > 0
            ? `${blockingIncidentCount} blocking LIFF incident(s) still visible`
            : recentLiffIncidentCount >= 3
              ? `${recentLiffIncidentCount} LIFF incidents in last 24h`
              : "No blocking LIFF signal right now",
    },
  ] as const;
  const activeAlertCount = activeAlertRules.filter((rule) => rule.state === "warning").length;
  const lastWebhookAt = opsRows.find((row) => row.actionType === "line.webhook_received")?.createdAt ?? null;
  const lastOutboundAt =
    opsRows.find((row) => row.actionType === "line.push_sent" || row.actionType === "line.reply_sent")?.createdAt ??
    null;
  const lastOutboundFailureAt =
    opsRows.find(
      (row) =>
        row.actionType === "line.push_failed" ||
        row.actionType === "line.reply_failed" ||
        row.actionType === "message.unsent"
    )?.createdAt ?? null;

  return (
    <div className="min-h-screen bg-[#050b14] text-slate-100">
      <div className="border-b border-[#1b2735] bg-[#08111d] px-6 py-5">
        <div className="mx-auto max-w-7xl">
          <Link
            href="/admin"
            prefetch={false}
            className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-400 transition hover:text-white"
          >
            ← กลับแดชบอร์ด
          </Link>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">
                LINE Operations
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-white">LINE Ops Console</h1>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                หน้า operator สำหรับไล่ incident ฝั่ง LINE แบบ log-first จาก `action_log`, LIFF validation,
                และ customer snapshots เพื่อหาว่า webhook เข้าไหม, reply/push ไปหรือเปล่า, และ flow ไหนเริ่มผิดปกติ
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <a
                href="/api/liff/health"
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-cyan-900 bg-cyan-950/60 px-4 py-2 text-sm font-medium text-cyan-200 transition hover:border-cyan-700 hover:bg-cyan-950"
              >
                Health JSON
              </a>
              <Link
                href="/liff/validation-harness"
                prefetch={false}
                className="rounded-full border border-emerald-900 bg-emerald-950/60 px-4 py-2 text-sm font-medium text-emerald-200 transition hover:border-emerald-700 hover:bg-emerald-950"
              >
                Validation Harness
              </Link>
              <Link
                href="/admin/settings"
                prefetch={false}
                className="rounded-full border border-[#223146] bg-[#0b1524] px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-[#355072] hover:bg-[#0f1a2c]"
              >
                Settings
              </Link>
              <Link
                href="/admin/profile"
                prefetch={false}
                className="rounded-full border border-[#223146] bg-[#0b1524] px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-[#355072] hover:bg-[#0f1a2c]"
              >
                Profile
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[28px] border border-[#1b2735] bg-[#08111d] p-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.26em] text-slate-500">active alerts</p>
            <p className="mt-3 font-mono text-4xl font-semibold text-white">{activeAlertCount}</p>
            <p className="mt-2 text-xs text-slate-400">กฎเตือนที่กำลังเป็น warning จาก signal ล่าสุด</p>
          </div>
          <div className="rounded-[28px] border border-[#1b2735] bg-[#08111d] p-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.26em] text-slate-500">webhook 24h</p>
            <p className="mt-3 font-mono text-4xl font-semibold text-cyan-200">{recentWebhookCount}</p>
            <p className="mt-2 text-xs text-slate-400">ข้อความ inbound ที่ถูก trace ผ่าน `line.webhook_received`</p>
          </div>
          <div className="rounded-[28px] border border-[#1b2735] bg-[#08111d] p-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.26em] text-slate-500">transport failures</p>
            <p className="mt-3 font-mono text-4xl font-semibold text-amber-300">{recentTransportFailureCount}</p>
            <p className="mt-2 text-xs text-slate-400">reply/push failures และ unsent events ใน 24 ชั่วโมงล่าสุด</p>
          </div>
          <div className="rounded-[28px] border border-[#1b2735] bg-[#08111d] p-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.26em] text-slate-500">latest validation</p>
            <div className="mt-3 flex items-center gap-3">
              <p className="font-mono text-2xl font-semibold text-white">
                {latestValidationRun?.passed === true
                  ? "PASS"
                  : latestValidationRun?.passed === false
                    ? "FAIL"
                    : "NONE"}
              </p>
              <Badge variant={getValidationVariant(latestValidationRun?.passed ?? null)}>
                {latestValidationRun?.created_at ? formatDateTime(latestValidationRun.created_at) : "awaiting run"}
              </Badge>
            </div>
            <p className="mt-2 text-xs text-slate-400">validation harness ล่าสุดสำหรับ LIFF production proof</p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_360px]">
          <section className="overflow-hidden rounded-[32px] border border-[#1b2735] bg-[#08111d]">
            <div className="border-b border-[#1b2735] px-6 py-5">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.26em] text-slate-500">event stream</p>
                <h2 className="mt-2 text-lg font-semibold text-white">Recent operator events</h2>
                <p className="mt-1 text-sm text-slate-400">
                  รวม webhook receipt, reply/push audit, quote/commercial flow และ LIFF incidents ใน feed เดียว
                </p>
              </div>
              <Badge variant="outline">{filterCounts[activeFilter]} match</Badge>
            </div>

            <div className="flex flex-wrap gap-2 border-b border-[#1b2735] px-6 py-4">
              {OPS_FILTERS.map((filter) => {
                const isActive = filter.key === activeFilter;

                return (
                  <Link
                    key={filter.key}
                    href={filter.key === "all" ? "/admin/liff-monitor" : `/admin/liff-monitor?filter=${filter.key}`}
                    prefetch={false}
                    className={[
                      "rounded-full border px-3 py-1.5 font-mono text-xs transition",
                      isActive
                        ? "border-cyan-700 bg-cyan-950 text-cyan-100"
                        : "border-[#223146] bg-[#0b1524] text-slate-300 hover:border-[#355072] hover:text-white",
                    ].join(" ")}
                  >
                    {filter.label} [{filterCounts[filter.key]}]
                  </Link>
                );
              })}
            </div>

            {visibleRows.length === 0 ? (
              <div className="px-6 py-10 text-sm text-slate-400">ยังไม่มี event ที่ตรง filter นี้ใน action_log</div>
            ) : (
              <div className="space-y-3 p-4">
                {visibleRows.map((row) => (
                  <div key={row.id} className="rounded-[24px] border border-[#1b2735] bg-[#09111d] p-4 font-mono text-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{row.source}</p>
                        <p className="mt-2 text-sm font-semibold text-white">{row.summary}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={getSeverityVariant(row.severity)}>{row.severity}</Badge>
                        <Badge variant="outline">{humanizeOpsToken(row.flow)}</Badge>
                        <Badge variant="outline">{row.actionType || "-"}</Badge>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 text-xs text-slate-400 md:grid-cols-[180px_minmax(0,1fr)]">
                      <div>
                        <p>{formatDateTime(row.createdAt)}</p>
                        <p className="mt-1 text-[11px] text-slate-500">{row.actionRef || "-"}</p>
                      </div>
                      <div className="space-y-1">
                        <p>{row.detail}</p>
                        <p>
                          entity: {row.entityType || "-"} / {compactId(row.entityId, 8, 6)}
                        </p>
                        <p>
                          actor: {row.actorLabel || row.actorType || "-"}
                        </p>
                        <p>
                          line user: {compactId(asString(row.payload?.line_user_id) || asString(row.payload?.lineUserHint), 6, 4)}
                        </p>
                      </div>
                    </div>

                    {row.payload ? (
                      <details className="mt-4 rounded-2xl border border-[#223146] bg-[#060d17] px-4 py-3 text-xs text-slate-400">
                        <summary className="cursor-pointer font-semibold text-slate-300">raw payload</summary>
                        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-all text-[11px] leading-5 text-slate-400">
                          {JSON.stringify(row.payload, null, 2)}
                        </pre>
                      </details>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="space-y-6">
            <section className="rounded-[28px] border border-[#1b2735] bg-[#08111d] p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.26em] text-slate-500">alert rules</p>
                  <h2 className="mt-2 text-lg font-semibold text-white">Incident rules</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    สัญญาณเตือนต้นทุนต่ำที่ช่วยตอบว่า LINE เงียบ, quote ไม่ถูกส่ง, หรือ LIFF เริ่ม regression หรือไม่
                  </p>
                </div>
                <Badge variant={activeAlertCount > 0 ? "warning" : "success"}>
                  {activeAlertCount > 0 ? `${activeAlertCount} active` : "all clear"}
                </Badge>
              </div>

              <div className="mt-4 space-y-3">
                {activeAlertRules.map((rule) => (
                  <div key={rule.key} className="rounded-[22px] border border-[#223146] bg-[#09111d] px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-sm font-semibold text-white">{rule.label}</p>
                        <p className="mt-2 text-xs leading-5 text-slate-400">{rule.detail}</p>
                      </div>
                      <Badge variant={rule.state === "warning" ? "warning" : "success"}>{rule.state}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[28px] border border-[#1b2735] bg-[#08111d] p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.26em] text-slate-500">readiness and tools</p>
                  <h2 className="mt-2 text-lg font-semibold text-white">Live signals</h2>
                </div>
                <Badge
                  variant={
                    blockingIncidentCount > 0 || latestValidationRun?.passed === false
                      ? "warning"
                      : latestValidationRun?.passed === true
                        ? "success"
                        : "outline"
                  }
                >
                  {blockingIncidentCount > 0 || latestValidationRun?.passed === false
                    ? "needs review"
                    : latestValidationRun?.passed === true
                      ? "healthy signal"
                      : "awaiting run"}
                </Badge>
              </div>

              <div className="mt-4 space-y-3 text-sm text-slate-300">
                <div className="rounded-[22px] border border-[#223146] bg-[#09111d] px-4 py-3">
                  <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-slate-500">last webhook</p>
                  <p className="mt-2 text-sm font-semibold text-white">{formatDateTime(lastWebhookAt)}</p>
                </div>
                <div className="rounded-[22px] border border-[#223146] bg-[#09111d] px-4 py-3">
                  <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-slate-500">last outbound success</p>
                  <p className="mt-2 text-sm font-semibold text-white">{formatDateTime(lastOutboundAt)}</p>
                </div>
                <div className="rounded-[22px] border border-[#223146] bg-[#09111d] px-4 py-3">
                  <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-slate-500">last outbound failure</p>
                  <p className="mt-2 text-sm font-semibold text-white">{formatDateTime(lastOutboundFailureAt)}</p>
                </div>
                <div className="rounded-[22px] border border-[#223146] bg-[#09111d] px-4 py-3">
                  <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-slate-500">blocking LIFF stages</p>
                  <p className="mt-2 text-sm font-semibold text-white">{blockingIncidentCount}</p>
                </div>
              </div>

              <div className="mt-4 rounded-[22px] border border-cyan-900 bg-cyan-950/40 px-4 py-3 text-xs leading-5 text-cyan-100">
                production proof ต้องมาจาก LINE WebView หรือ support tools ไม่ใช่ desktop browser อย่างเดียว
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href="/liff/validation-harness"
                  prefetch={false}
                  className="rounded-full border border-emerald-900 bg-[#0b1524] px-4 py-2 text-sm font-medium text-emerald-200 transition hover:border-emerald-700 hover:bg-[#0f1a2c]"
                >
                  เปิด validation harness
                </Link>
                <a
                  href="/api/liff/health"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-cyan-900 bg-[#0b1524] px-4 py-2 text-sm font-medium text-cyan-200 transition hover:border-cyan-700 hover:bg-[#0f1a2c]"
                >
                  เปิด health JSON
                </a>
                <Link
                  href="/admin/settings"
                  prefetch={false}
                  className="rounded-full border border-[#223146] bg-[#0b1524] px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-[#355072] hover:bg-[#0f1a2c]"
                >
                  กลับไปดู settings
                </Link>
              </div>
            </section>

            <section className="rounded-[28px] border border-[#1b2735] bg-[#08111d] p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.26em] text-slate-500">recent LIFF incidents</p>
                  <h2 className="mt-2 text-lg font-semibold text-white">Last LIFF traces</h2>
                </div>
                <Badge variant="outline">{liffIncidentRows.length} rows</Badge>
              </div>

              <div className="mt-4 space-y-3">
                {liffIncidentRows.slice(0, 5).map((row) => (
                  <div key={row.id} className="rounded-[22px] border border-[#223146] bg-[#09111d] px-4 py-3 text-xs text-slate-400">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-sm font-semibold text-white">{getStageLabel(row.stage)}</p>
                        <p className="mt-1 text-xs text-slate-400">{row.note || row.message || "-"}</p>
                      </div>
                      <Badge variant={getStageVariant(row.stage)}>{formatDateTime(row.createdAt)}</Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-[11px] text-slate-500">
                      <p>trace: {row.fingerprint || "-"}</p>
                      <p>path: {row.pathname || "-"}</p>
                      <p>line user: {compactId(row.lineUserId || row.lineUserHint, 6, 4)}</p>
                      <p>sdk: {row.liffSdkVersion || "-"}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[28px] border border-[#1b2735] bg-[#08111d] p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.26em] text-slate-500">customer snapshots</p>
                  <h2 className="mt-2 text-lg font-semibold text-white">Latest customer LIFF context</h2>
                </div>
                <Badge variant="outline">{(customers || []).length} คน</Badge>
              </div>

              <div className="mt-4 space-y-3">
                {(customers || []).map((customer) => {
                  const context = asRecord(customer.last_liff_context);
                  const innerContext = asRecord(context?.context);

                  return (
                    <Link
                      key={customer.id}
                      href={`/admin/customers/${customer.id}`}
                      prefetch={false}
                      className="block rounded-[22px] border border-[#223146] bg-[#09111d] px-4 py-3 transition hover:border-[#355072] hover:bg-[#0d1828]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">{customer.display_name || "ลูกค้าไม่ทราบชื่อ"}</p>
                          <p className="mt-1 font-mono text-xs text-slate-500">{compactId(customer.line_user_id, 6, 4)}</p>
                        </div>
                        <Badge variant={customer.line_friendship_status ? "success" : "outline"}>
                          {customer.line_friendship_status ? "friend" : "unknown"}
                        </Badge>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-[11px] text-slate-500">
                        <p>type: {asString(innerContext?.type) || "-"}</p>
                        <p>view: {asString(innerContext?.viewType) || "-"}</p>
                        <p>lang: {asString(context?.appLanguage) || "-"}</p>
                        <p>line: {asString(context?.lineVersion) || "-"}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>

            <section className="rounded-[28px] border border-[#1b2735] bg-[#08111d] p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.26em] text-slate-500">intake snapshots</p>
                  <h2 className="mt-2 text-lg font-semibold text-white">Latest intake context</h2>
                </div>
                <Badge variant="outline">{(leads || []).length} lead</Badge>
              </div>

              <div className="mt-4 space-y-3">
                {(leads || []).map((lead) => {
                  const snapshot = asRecord(lead.liff_context_snapshot);
                  const innerContext = asRecord(snapshot?.context);
                  const leadCustomer = Array.isArray(lead.customers)
                    ? lead.customers[0]
                    : lead.customers;

                  return (
                    <div
                      key={lead.id}
                      className="rounded-[22px] border border-[#223146] bg-[#09111d] px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {leadCustomer?.display_name || "ลูกค้าไม่ทราบชื่อ"}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            {lead.product_type || "-"} · {lead.status || "-"}
                          </p>
                        </div>
                        <Badge variant="outline">{formatDateTime(lead.created_at)}</Badge>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-[11px] text-slate-500">
                        <p>type: {asString(innerContext?.type) || "-"}</p>
                        <p>view: {asString(innerContext?.viewType) || "-"}</p>
                        <p>sdk: {asString(snapshot?.liffSdkVersion) || "-"}</p>
                        <p>os: {asString(snapshot?.os) || "-"}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}