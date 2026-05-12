import { createHash } from "node:crypto";

import {
  LIFF_VALIDATION_CHECK_IDS,
  LIFF_VALIDATION_CHECK_TITLES,
  type LiffValidationCheckId,
  type LiffValidationCheckResult,
  type LiffValidationEnvironment,
  type LiffValidationReportRecord,
} from "@/lib/liff-validation";

const MAX_NOTES_LENGTH = 2000;
const MAX_SUMMARY_LENGTH = 240;
const MAX_DETAIL_LENGTH = 1200;
const MAX_EVIDENCE_KEYS = 20;
const MAX_EVIDENCE_ARRAY_ITEMS = 20;
const MAX_ENV_USER_AGENT_LENGTH = 320;

type UnknownRecord = Record<string, unknown>;

export type NormalizedLiffValidationReportPayload = {
  idToken: string;
  record: LiffValidationReportRecord;
};

function asRecord(value: unknown): UnknownRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as UnknownRecord;
}

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

function sanitizeBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function sanitizeJsonValue(value: unknown, depth = 0): unknown {
  if (depth > 4) {
    return null;
  }

  if (
    value === null ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "string") {
    return value.slice(0, MAX_DETAIL_LENGTH);
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_EVIDENCE_ARRAY_ITEMS)
      .map((entry) => sanitizeJsonValue(entry, depth + 1));
  }

  const record = asRecord(value);
  if (!record) {
    return null;
  }

  return Object.fromEntries(
    Object.entries(record)
      .slice(0, MAX_EVIDENCE_KEYS)
      .map(([key, entry]) => [key, sanitizeJsonValue(entry, depth + 1)])
  );
}

function normalizeEnvironment(value: unknown): LiffValidationEnvironment {
  const record = asRecord(value);
  const context = asRecord(record?.context);

  return {
    collectedAt: sanitizeString(record?.collectedAt, 64),
    userAgent: sanitizeString(record?.userAgent, MAX_ENV_USER_AGENT_LENGTH),
    appLanguage: sanitizeString(record?.appLanguage, 32),
    liffSdkVersion: sanitizeString(record?.liffSdkVersion, 32),
    lineVersion: sanitizeString(record?.lineVersion, 32),
    os: sanitizeString(record?.os, 32),
    isInClient: sanitizeBoolean(record?.isInClient),
    isLoggedIn: sanitizeBoolean(record?.isLoggedIn),
    hasIdToken: Boolean(record?.hasIdToken),
    context: context
      ? {
          type: sanitizeString(context.type, 32),
          liffId: sanitizeString(context.liffId, 128),
          viewType: sanitizeString(context.viewType, 32),
          endpointUrl: sanitizeString(context.endpointUrl, 320),
          scope: Array.isArray(context.scope)
            ? context.scope
                .map((entry) => sanitizeString(entry, 64))
                .filter((entry): entry is string => Boolean(entry))
                .slice(0, MAX_EVIDENCE_ARRAY_ITEMS)
            : [],
          availability:
            ((sanitizeJsonValue(context.availability) as NonNullable<
              LiffValidationEnvironment["context"]
            >["availability"]) || {}),
          miniAppId: sanitizeString(context.miniAppId, 128),
          miniDomainAllowed: sanitizeBoolean(context.miniDomainAllowed),
          permanentLinkPattern: sanitizeString(
            context.permanentLinkPattern,
            320
          ),
        }
      : null,
  };
}

function normalizeCheckResult(value: unknown): LiffValidationCheckResult | null {
  const record = asRecord(value);
  const id = sanitizeString(record?.id, 32);
  if (!id || !LIFF_VALIDATION_CHECK_IDS.includes(id as LiffValidationCheckId)) {
    return null;
  }

  return {
    id: id as LiffValidationCheckId,
    title:
      sanitizeString(record?.title, 120) ||
      LIFF_VALIDATION_CHECK_TITLES[id as LiffValidationCheckId],
    passed: Boolean(record?.passed),
    summary: sanitizeString(record?.summary, MAX_SUMMARY_LENGTH) || "No summary",
    detail: sanitizeString(record?.detail, MAX_DETAIL_LENGTH),
    startedAt: sanitizeString(record?.startedAt, 64),
    completedAt: sanitizeString(record?.completedAt, 64),
    evidence:
      (sanitizeJsonValue(record?.evidence) as Record<string, unknown> | null) || null,
  };
}

export function normalizeLiffValidationReportPayload(
  input: unknown
): NormalizedLiffValidationReportPayload {
  const root = asRecord(input);
  const idToken = sanitizeString(root?.idToken, 8192);
  if (!idToken) {
    throw new Error("LIFF ID token is required");
  }

  const checks = Array.isArray(root?.checks)
    ? root.checks
        .map((entry) => normalizeCheckResult(entry))
        .filter((entry): entry is LiffValidationCheckResult => Boolean(entry))
    : [];

  if (checks.length === 0) {
    throw new Error("At least one validation check is required");
  }

  const failedChecks = checks
    .filter((check) => !check.passed)
    .map((check) => check.id);
  const environment = normalizeEnvironment(root?.environment);

  return {
    idToken,
    record: {
      environment,
      liffIsInClient: environment.isInClient,
      liffLoggedIn: environment.isLoggedIn,
      lineVersion: environment.lineVersion,
      checks,
      passed: failedChecks.length === 0,
      failedChecks,
      notes: sanitizeString(root?.notes, MAX_NOTES_LENGTH),
    },
  };
}

export function hashLineUserId(lineUserId: string) {
  return createHash("sha256")
    .update(lineUserId.trim())
    .digest("hex");
}