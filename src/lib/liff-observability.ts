import type { SupabaseClient } from "@supabase/supabase-js";

import { logSystemAction } from "@/lib/action-log";
import {
  normalizeLiffContextSnapshot,
  parseLiffContextSnapshot,
  type LiffContextSnapshot,
} from "@/lib/liff-capture";

const MAX_MESSAGE_LENGTH = 280;
const MAX_PATH_LENGTH = 180;
const MAX_USER_AGENT_LENGTH = 240;
const MAX_STAGE_LENGTH = 64;
const MAX_FINGERPRINT_LENGTH = 64;

function sanitizeString(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, maxLength);
}

function compactLineUserId(value: unknown) {
  const sanitized = sanitizeString(value, 128);
  if (!sanitized || sanitized.length <= 12) {
    return sanitized;
  }

  return `${sanitized.slice(0, 6)}...${sanitized.slice(-4)}`;
}

function sanitizeBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function sanitizeStringArray(value: unknown, maxItems = 12) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value
    .map((entry) => sanitizeString(entry, 64))
    .filter((entry): entry is string => Boolean(entry))
    .slice(0, maxItems);
}

function extractSearchParamKeys(value: unknown) {
  if (Array.isArray(value)) {
    return sanitizeStringArray(value, 20);
  }

  if (typeof value !== "string") {
    return [] as string[];
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return [] as string[];
  }

  try {
    const query = trimmed.startsWith("?") ? trimmed.slice(1) : trimmed;
    return Array.from(new URLSearchParams(query).keys())
      .map((entry) => sanitizeString(entry, 64))
      .filter((entry): entry is string => Boolean(entry))
      .slice(0, 20);
  } catch {
    return [];
  }
}

function summarizeContext(snapshot: LiffContextSnapshot | null) {
  if (!snapshot) {
    return null;
  }

  return {
    collectedAt: snapshot.collectedAt,
    os: snapshot.os,
    appLanguage: snapshot.appLanguage,
    lineVersion: snapshot.lineVersion,
    liffSdkVersion: snapshot.liffSdkVersion,
    isInClient: snapshot.isInClient,
    isLoggedIn: snapshot.isLoggedIn,
    grantedScopes: snapshot.grantedScopes,
    context: snapshot.context,
  };
}

export type LiffIncidentPayload = {
  fingerprint: string | null;
  stage: string;
  message: string | null;
  pathname: string | null;
  searchParamKeys: string[];
  intakeMode: string | null;
  userAgent: string | null;
  sdkPresent: boolean | null;
  liffIdConfigured: boolean | null;
  lineUserId: string | null;
  lineUserHint: string | null;
  context: ReturnType<typeof summarizeContext>;
};

export function normalizeLiffIncidentPayload(input: unknown): LiffIncidentPayload | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return null;
  }

  const root = input as Record<string, unknown>;
  const stage = sanitizeString(root.stage, MAX_STAGE_LENGTH);
  if (!stage) {
    return null;
  }

  const normalizedContext =
    typeof root.liffContextSnapshot === "string"
      ? parseLiffContextSnapshot(root.liffContextSnapshot)
      : normalizeLiffContextSnapshot(root.liffContextSnapshot);

  return {
    fingerprint: sanitizeString(root.fingerprint, MAX_FINGERPRINT_LENGTH),
    stage,
    message: sanitizeString(root.message, MAX_MESSAGE_LENGTH),
    pathname: sanitizeString(root.pathname, MAX_PATH_LENGTH),
    searchParamKeys: extractSearchParamKeys(root.searchParamKeys ?? root.query),
    intakeMode: sanitizeString(root.intakeMode, 32),
    userAgent: sanitizeString(root.userAgent, MAX_USER_AGENT_LENGTH),
    sdkPresent: sanitizeBoolean(root.sdkPresent),
    liffIdConfigured: sanitizeBoolean(root.liffIdConfigured),
    lineUserId: sanitizeString(root.lineUserId, 128),
    lineUserHint: compactLineUserId(root.lineUserId),
    context: summarizeContext(normalizedContext),
  };
}

export async function logLiffIncident(supabase: SupabaseClient, incident: LiffIncidentPayload) {
  const note = incident.message
    ? `${incident.stage}: ${incident.message}`
    : `LIFF incident: ${incident.stage}`;

  return logSystemAction(supabase, {
    entityType: "system",
    actionType: "liff.client_issue",
    serviceName: "liff-client",
    note,
    payload: {
      source: "liff-intake",
      ...incident,
    },
  });
}

export function isLiffIncidentAction(actionType: string | null | undefined) {
  return typeof actionType === "string" && actionType.startsWith("liff.");
}

export function summarizeIncidentStages(payloads: Array<Record<string, unknown> | null | undefined>) {
  return payloads.reduce<Record<string, number>>((summary, payload) => {
    const stage = sanitizeString(payload?.stage, MAX_STAGE_LENGTH);
    if (!stage) {
      return summary;
    }

    summary[stage] = (summary[stage] || 0) + 1;
    return summary;
  }, {});
}

export function collectScopeList(payload: Record<string, unknown> | null | undefined) {
  return sanitizeStringArray(
    payload?.context && typeof payload.context === "object"
      ? (payload.context as Record<string, unknown>).grantedScopes
      : null
  );
}
