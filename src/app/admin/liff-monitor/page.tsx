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

function getSince24hIsoString() {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
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

export default async function AdminLiffMonitorPage() {
  const supabase = createAdminClient();
  const since24h = getSince24hIsoString();

  const [{ data: incidents }, { data: customers }, { data: leads }] = await Promise.all([
    supabase
      .from("action_log")
      .select("id, action_ref, action_type, actor_label, note, payload, created_at")
      .like("action_type", "liff.%")
      .order("created_at", { ascending: false })
      .limit(40),
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
  ]);

  const incidentRows = (incidents || []).map((row) => {
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

  const recent24hCount = incidentRows.filter((row) => {
    if (!row.createdAt) {
      return false;
    }

    return row.createdAt >= since24h;
  }).length;
  const initFailureCount = incidentRows.filter((row) => row.stage === "init_failed").length;
  const sdkTimeoutCount = incidentRows.filter((row) => row.stage === "sdk_load_timeout").length;

  return (
    <div className="admin-shell min-h-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="mx-auto max-w-7xl">
          <Link
            href="/admin"
            prefetch={false}
            className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
          >
            ← กลับแดชบอร์ด
          </Link>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">
                LIFF Observability
              </p>
              <h1 className="mt-2 text-2xl font-bold text-slate-950">LIFF Monitor</h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                เมนูแยกสำหรับดูเคส LIFF ที่ลูกค้ามองไม่เห็นจากหน้าแบบฟอร์ม เช่น SDK ไม่ขึ้น,
                init ล้ม, prefill พัง, หรือ token ถูกฝั่ง server ปัดทิ้ง โดยรวมทั้ง incident log
                และ snapshot ล่าสุดจากลูกค้าที่ submit ผ่าน
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/admin/settings"
                prefetch={false}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                Settings
              </Link>
              <Link
                href="/admin/profile"
                prefetch={false}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                Profile
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="admin-kpi-card">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">24h incidents</p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">{recent24hCount}</p>
            <p className="mt-2 text-xs text-slate-500">นับจากรายการ LIFF ล่าสุดที่ถูกเขียนเข้า action_log</p>
          </div>
          <div className="admin-kpi-card">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Init failures</p>
            <p className="mt-2 text-3xl font-semibold text-amber-600">{initFailureCount}</p>
            <p className="mt-2 text-xs text-slate-500">ดูจาก stage `init_failed` ใน log ล่าสุด</p>
          </div>
          <div className="admin-kpi-card">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">SDK timeouts</p>
            <p className="mt-2 text-3xl font-semibold text-rose-600">{sdkTimeoutCount}</p>
            <p className="mt-2 text-xs text-slate-500">เคสที่ `window.liff` ไม่มาใน 5 วินาที</p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_380px]">
          <section className="admin-panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Recent LIFF incidents</h2>
                <p className="mt-1 text-sm text-slate-500">
                  รวมทั้ง client-side beacon และ server-side token/prefill rejection
                </p>
              </div>
              <Badge variant="outline">{incidentRows.length} รายการล่าสุด</Badge>
            </div>

            {incidentRows.length === 0 ? (
              <div className="px-6 py-8 text-sm text-slate-500">ยังไม่มี incident LIFF ใน action_log</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs font-medium text-slate-500">
                      <th className="px-6 py-3">เวลา</th>
                      <th className="px-4 py-3">Stage</th>
                      <th className="px-4 py-3">รายละเอียด</th>
                      <th className="px-4 py-3">Context</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {incidentRows.map((row) => (
                      <tr key={row.id} className="align-top">
                        <td className="px-6 py-4 text-slate-600">
                          <p className="font-medium text-slate-900">{formatDateTime(row.createdAt)}</p>
                          <p className="mt-1 font-mono text-xs text-slate-400">{row.actionRef || "-"}</p>
                        </td>
                        <td className="px-4 py-4">
                          <Badge variant={getStageVariant(row.stage)}>{getStageLabel(row.stage)}</Badge>
                          <p className="mt-2 text-xs text-slate-500">{row.actionType || row.actorLabel || "liff"}</p>
                        </td>
                        <td className="px-4 py-4 text-slate-700">
                          <p className="font-medium text-slate-950">{row.note || row.message || "-"}</p>
                          <div className="mt-2 space-y-1 text-xs text-slate-500">
                            <p>trace: {row.fingerprint || "-"}</p>
                            <p>path: {row.pathname || "-"}</p>
                            <p>query keys: {row.searchParamKeys.join(", ") || "-"}</p>
                            <p>mode: {row.intakeMode || "-"}</p>
                            <p>line user: {compactId(row.lineUserId || row.lineUserHint, 6, 4)}</p>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-xs text-slate-500">
                          <div className="space-y-1">
                            <p>sdk: {row.liffSdkVersion || "-"}</p>
                            <p>line: {row.lineVersion || "-"}</p>
                            <p>lang: {row.appLanguage || "-"}</p>
                            <p>context: {row.contextType || "-"}</p>
                            <p>in client: {row.isInClient === null ? "-" : row.isInClient ? "yes" : "no"}</p>
                            <p>logged in: {row.isLoggedIn === null ? "-" : row.isLoggedIn ? "yes" : "no"}</p>
                            <p>sdk present: {row.sdkPresent === null ? "-" : row.sdkPresent ? "yes" : "no"}</p>
                            <p>liff configured: {row.liffIdConfigured === null ? "-" : row.liffIdConfigured ? "yes" : "no"}</p>
                            <p>scopes: {row.grantedScopes.join(", ") || "-"}</p>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <div className="space-y-6">
            <section className="admin-panel p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">Latest customer snapshots</h2>
                  <p className="mt-1 text-sm text-slate-500">ดึงจาก `customers.last_liff_context` ล่าสุด</p>
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
                      className="block rounded-[20px] border border-slate-200 bg-slate-50/90 px-4 py-3 transition hover:border-slate-300 hover:bg-white"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-950">{customer.display_name || "ลูกค้าไม่ทราบชื่อ"}</p>
                          <p className="mt-1 font-mono text-xs text-slate-500">{compactId(customer.line_user_id, 6, 4)}</p>
                        </div>
                        <Badge variant={customer.line_friendship_status ? "success" : "outline"}>
                          {customer.line_friendship_status ? "friend" : "unknown"}
                        </Badge>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
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

            <section className="admin-panel p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">Latest intake snapshots</h2>
                  <p className="mt-1 text-sm text-slate-500">ดึงจาก `leads.liff_context_snapshot` ล่าสุด</p>
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
                      className="rounded-[20px] border border-slate-200 bg-slate-50/90 px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-950">
                            {leadCustomer?.display_name || "ลูกค้าไม่ทราบชื่อ"}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {lead.product_type || "-"} · {lead.status || "-"}
                          </p>
                        </div>
                        <Badge variant="outline">{formatDateTime(lead.created_at)}</Badge>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
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