import { NextRequest, NextResponse } from "next/server";

import { APP_SETTINGS_ID, getRuntimeAppConfig } from "@/lib/app-settings";
import { getLineLoginChannelIdFromLiffId } from "@/lib/line-liff-identity";
import { createAdminClient } from "@/lib/supabase/admin";

type HealthCheck = {
  id: string;
  title: string;
  ok: boolean;
  detail: string;
};

type LatestValidationRun = {
  reportId: string;
  createdAt: string;
  passed: boolean;
  failedChecks: string[];
} | null;

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

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value
    .map((entry) => asString(entry))
    .filter((entry): entry is string => Boolean(entry));
}

function isHttpsUrl(value: string) {
  if (!value) {
    return false;
  }

  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function describeConfigValue(ok: boolean, truthyDetail: string, falsyDetail: string) {
  return ok ? truthyDetail : falsyDetail;
}

export async function GET(request: NextRequest) {
  const runtimeConfig = await getRuntimeAppConfig();
  const supabase = createAdminClient();
  const checkedAt = new Date().toISOString();
  const sinceOneHour = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const runtimeLiffId = runtimeConfig.liffId.trim();
  const envLiffId = process.env.LIFF_ID?.trim() || "";
  const publicLiffId = process.env.NEXT_PUBLIC_LIFF_ID?.trim() || "";
  const runtimeChannelId = getLineLoginChannelIdFromLiffId(runtimeLiffId);
  const baseUrlHost = (() => {
    try {
      return runtimeConfig.baseUrl ? new URL(runtimeConfig.baseUrl).host : null;
    } catch {
      return null;
    }
  })();
  const [appSettingsProbe, incidentsRes, latestValidationRunRes] = await Promise.all([
    supabase.from("app_settings").select("id").eq("id", APP_SETTINGS_ID).maybeSingle(),
    supabase
      .from("action_log")
      .select("created_at, payload, action_type")
      .like("action_type", "liff.%")
      .gte("created_at", sinceOneHour)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("liff_validation_runs")
      .select("id, created_at, passed, failed_checks")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const incidentRows = (incidentsRes.data || []).map((row) => {
    const payload = asRecord(row.payload);

    return {
      createdAt: asString(row.created_at),
      actionType: asString(row.action_type),
      stage: asString(payload?.stage),
    };
  });

  const latestValidationRun: LatestValidationRun = latestValidationRunRes.data
    ? {
        reportId: latestValidationRunRes.data.id,
        createdAt: latestValidationRunRes.data.created_at,
        passed: Boolean(latestValidationRunRes.data.passed),
        failedChecks: asStringArray(latestValidationRunRes.data.failed_checks),
      }
    : null;

  const initFailureCount = incidentRows.filter((row) => row.stage === "init_failed").length;
  const sdkTimeoutCount = incidentRows.filter((row) => row.stage === "sdk_load_timeout").length;
  const dbReadable =
    !appSettingsProbe.error && !incidentsRes.error && !latestValidationRunRes.error;
  const checks: HealthCheck[] = [
    {
      id: "runtime_liff_id",
      title: "Runtime LIFF ID configured",
      ok: Boolean(runtimeLiffId),
      detail: describeConfigValue(
        Boolean(runtimeLiffId),
        `Using runtime LIFF ID ${runtimeLiffId}`,
        "Missing runtime LIFF ID from app_settings and env fallback"
      ),
    },
    {
      id: "liff_channel_id",
      title: "LIFF ID can resolve LINE Login channel",
      ok: Boolean(runtimeChannelId),
      detail: describeConfigValue(
        Boolean(runtimeChannelId),
        `Resolved LINE Login channel ${runtimeChannelId}`,
        "Runtime LIFF ID format is invalid for channel extraction"
      ),
    },
    {
      id: "env_liff_pair",
      title: "Server/browser LIFF env pair matches",
      ok: Boolean(envLiffId && publicLiffId && envLiffId === publicLiffId),
      detail: envLiffId && publicLiffId
        ? envLiffId === publicLiffId
          ? "LIFF_ID and NEXT_PUBLIC_LIFF_ID are aligned"
          : "LIFF_ID and NEXT_PUBLIC_LIFF_ID do not match"
        : "Missing LIFF_ID or NEXT_PUBLIC_LIFF_ID in environment",
    },
    {
      id: "line_credentials",
      title: "LINE credentials available",
      ok: Boolean(runtimeConfig.lineChannelAccessToken && runtimeConfig.lineChannelSecret),
      detail: describeConfigValue(
        Boolean(runtimeConfig.lineChannelAccessToken && runtimeConfig.lineChannelSecret),
        "Runtime LINE channel access token and secret are available",
        "Missing runtime LINE channel access token or secret"
      ),
    },
    {
      id: "base_url_https",
      title: "Base URL is HTTPS",
      ok: isHttpsUrl(runtimeConfig.baseUrl),
      detail: describeConfigValue(
        isHttpsUrl(runtimeConfig.baseUrl),
        `Base URL is ${runtimeConfig.baseUrl}`,
        "Base URL is missing or not HTTPS"
      ),
    },
    {
      id: "admin_observability_read",
      title: "Server can read LIFF observability tables",
      ok: dbReadable,
      detail: dbReadable
        ? "app_settings, action_log, and liff_validation_runs queries succeeded"
        : appSettingsProbe.error?.message || incidentsRes.error?.message || latestValidationRunRes.error?.message || "Failed to query LIFF observability tables",
    },
  ];
  const healthy = checks.every((check) => check.ok);

  return NextResponse.json(
    {
      ok: healthy,
      checkedAt,
      checks,
      runtime: {
        liffId: runtimeLiffId || null,
        lineLoginChannelId: runtimeChannelId,
        baseUrl: runtimeConfig.baseUrl || null,
        baseUrlHost,
        requestHost: request.nextUrl.host,
        requestHostMatchesBaseUrl: baseUrlHost ? baseUrlHost === request.nextUrl.host : null,
        liffEndpointUrl: runtimeConfig.liffEndpointUrl || null,
        webhookUrl: runtimeConfig.webhookUrl || null,
        appSettingsRowPresent: Boolean(appSettingsProbe.data),
      },
      observability: {
        recentIncidentCount: incidentRows.length,
        initFailureCount,
        sdkTimeoutCount,
        latestIncidentAt: incidentRows[0]?.createdAt || null,
        latestValidationRun,
      },
    },
    {
      status: healthy ? 200 : 503,
    }
  );
}