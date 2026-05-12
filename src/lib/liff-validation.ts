import type { LiffContextSnapshot } from "@/lib/liff-capture";

export const LIFF_VALIDATION_MODE = "liff_validation_harness";
export const LIFF_VALIDATION_TEST_MARKER = "[LIFF_VALIDATION_TEST]";

export const LIFF_VALIDATION_CHECK_IDS = [
  "LIFF-VAL-006",
  "LIFF-VAL-007",
  "LIFF-VAL-008",
] as const;

export type LiffValidationCheckId = (typeof LIFF_VALIDATION_CHECK_IDS)[number];

export type LiffValidationEnvironment = {
  collectedAt: string | null;
  userAgent: string | null;
  appLanguage: string | null;
  liffSdkVersion: string | null;
  lineVersion: string | null;
  os: string | null;
  isInClient: boolean | null;
  isLoggedIn: boolean | null;
  hasIdToken: boolean;
  context: LiffContextSnapshot["context"] | null;
};

export type LiffValidationCheckResult = {
  id: LiffValidationCheckId;
  title: string;
  passed: boolean;
  summary: string;
  detail: string | null;
  startedAt: string | null;
  completedAt: string | null;
  evidence: Record<string, unknown> | null;
};

export type LiffValidationReportRecord = {
  environment: LiffValidationEnvironment;
  liffIsInClient: boolean | null;
  liffLoggedIn: boolean | null;
  lineVersion: string | null;
  checks: LiffValidationCheckResult[];
  passed: boolean;
  failedChecks: LiffValidationCheckId[];
  notes: string | null;
};

export const LIFF_VALIDATION_CHECK_TITLES: Record<
  LiffValidationCheckId,
  string
> = {
  "LIFF-VAL-006": "Prefill route is public to LIFF",
  "LIFF-VAL-007": "Tax invoice intake works with LIFF identity",
  "LIFF-VAL-008": "Runtime catalog is active",
};

export function buildLiffValidationTestNote(runLabel: string) {
  return [
    LIFF_VALIDATION_TEST_MARKER,
    `Run ${runLabel}`,
    "Generated from /liff/validation-harness",
    "Do not process as a paid customer job.",
  ].join(" | ");
}