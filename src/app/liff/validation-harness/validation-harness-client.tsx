"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Copy, LoaderCircle, ShieldCheck, Smartphone } from "lucide-react";

import {
  buildLiffValidationTestNote,
  LIFF_VALIDATION_CHECK_TITLES,
  LIFF_VALIDATION_MODE,
  type LiffValidationCheckId,
  type LiffValidationCheckResult,
  type LiffValidationEnvironment,
} from "@/lib/liff-validation";

type HarnessProps = {
  businessName: string;
  liffId: string;
};

type LiffContext = NonNullable<LiffValidationEnvironment["context"]>;

type LiffEnvironmentState = LiffValidationEnvironment & {
  displayName: string | null;
};

type PersistedReportState = {
  reportId: string;
  createdAt: string;
  passed: boolean;
  failedChecks: LiffValidationCheckId[];
};

type RunStatus = "idle" | "running" | "completed";

type CheckExecutionResult = {
  check: LiffValidationCheckResult;
  aux: Record<string, unknown> | null;
};

type IntakePayload = {
  validationMode: "liff_validation_harness";
  liffIdToken: string;
  liffContextSnapshot: string;
  productType: string;
  width: number;
  height: number;
  unit: "cm";
  qty: number;
  dueDate: string;
  phone: string;
  note: string;
  referenceInfo: string;
  designBrief: string;
  requestedDocumentType: "tax_invoice";
  requestedDocumentTypes: ["quote", "tax_invoice"];
  billingEntityType: "company";
  billingBranchType: "head_office";
  billingName: string;
  taxId: string;
  billingAddress: string;
  fulfillmentMode: "pickup";
  intakeMode: "resume";
};

type RawLiffContext = {
  type?: string;
  liffId?: string;
  viewType?: string;
  endpointUrl?: string;
  scope?: string[];
  availability?: Record<string, unknown>;
  miniAppId?: string;
  miniDomainAllowed?: boolean;
  permanentLinkPattern?: string;
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function getBangkokDatePlusOne() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(Date.now() + 24 * 60 * 60 * 1000));
}

function createRunLabel() {
  const timestamp = new Date().toISOString().replace(/[.:]/g, "-");
  return `liff-validation-${timestamp}`;
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  try {
    return new Intl.DateTimeFormat("th-TH", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Bangkok",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function compactText(value: string | null | undefined, head = 18, tail = 8) {
  if (!value) {
    return "-";
  }

  if (value.length <= head + tail + 3) {
    return value;
  }

  return `${value.slice(0, head)}...${value.slice(-tail)}`;
}

function safeString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function safeContext(value: RawLiffContext | undefined): LiffContext | null {
  if (!value) {
    return null;
  }

  return {
    type: safeString(value.type),
    liffId: safeString(value.liffId),
    viewType: safeString(value.viewType),
    endpointUrl: safeString(value.endpointUrl),
    scope: Array.isArray(value.scope)
      ? value.scope.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
      : [],
    availability:
      value.availability && typeof value.availability === "object"
        ? (value.availability as LiffContext["availability"])
        : {},
    miniAppId: safeString(value.miniAppId),
    miniDomainAllowed:
      typeof value.miniDomainAllowed === "boolean" ? value.miniDomainAllowed : null,
    permanentLinkPattern: safeString(value.permanentLinkPattern),
  };
}

function buildInitialChecks(): LiffValidationCheckResult[] {
  return (["LIFF-VAL-006", "LIFF-VAL-007", "LIFF-VAL-008"] as const).map((id) => ({
    id,
    title: LIFF_VALIDATION_CHECK_TITLES[id],
    passed: false,
    summary: "Pending",
    detail: null,
    startedAt: null,
    completedAt: null,
    evidence: null,
  }));
}

async function readResponseBody(response: Response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  try {
    return await response.text();
  } catch {
    return null;
  }
}

function buildReportText(input: {
  businessName: string;
  environment: LiffEnvironmentState | null;
  checks: LiffValidationCheckResult[];
  persistedReport: PersistedReportState | null;
  notes: string | null;
}) {
  const { businessName, environment, checks, persistedReport, notes } = input;
  const passedCount = checks.filter((check) => check.passed).length;
  const status = passedCount === checks.length ? "PASS" : "FAIL";

  return [
    `${businessName} LIFF Validation Harness`,
    `Status: ${status} (${passedCount}/${checks.length})`,
    `Saved report: ${persistedReport ? persistedReport.reportId : "not saved"}`,
    `Saved at: ${persistedReport ? persistedReport.createdAt : "-"}`,
    `Collected at: ${environment?.collectedAt || "-"}`,
    `In LINE client: ${environment?.isInClient === null ? "-" : environment?.isInClient ? "yes" : "no"}`,
    `Logged in: ${environment?.isLoggedIn === null ? "-" : environment?.isLoggedIn ? "yes" : "no"}`,
    `OS: ${environment?.os || "-"}`,
    `LINE version: ${environment?.lineVersion || "-"}`,
    `LIFF SDK: ${environment?.liffSdkVersion || "-"}`,
    `Context: ${environment?.context?.type || "-"} / ${environment?.context?.viewType || "-"}`,
    `ID token present: ${environment?.hasIdToken ? "yes" : "no"}`,
    ...checks.map(
      (check) =>
        `${check.id} ${check.passed ? "PASS" : "FAIL"} | ${check.summary}${check.detail ? ` | ${check.detail}` : ""}`
    ),
    notes ? `Notes: ${notes}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function mergeCheck(
  checks: LiffValidationCheckResult[],
  nextCheck: LiffValidationCheckResult
) {
  return checks.map((check) => (check.id === nextCheck.id ? nextCheck : check));
}

export default function ValidationHarnessClient({ businessName, liffId }: HarnessProps) {
  const [ready, setReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [environment, setEnvironment] = useState<LiffEnvironmentState | null>(null);
  const [idToken, setIdToken] = useState("");
  const [checks, setChecks] = useState<LiffValidationCheckResult[]>(() => buildInitialChecks());
  const [runStatus, setRunStatus] = useState<RunStatus>("idle");
  const [runNotes, setRunNotes] = useState<string | null>(null);
  const [persistedReport, setPersistedReport] = useState<PersistedReportState | null>(null);
  const [persistError, setPersistError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    let cancelled = false;

    async function initializeHarness() {
      if (!liffId) {
        setInitError("LIFF validation harness requires LIFF ID configuration.");
        setReady(true);
        return;
      }

      try {
        for (let attempt = 0; attempt < 25; attempt += 1) {
          if (window.liff) {
            break;
          }
          await wait(200);
        }

        if (!window.liff) {
          throw new Error("LIFF SDK was not available within 5 seconds.");
        }

        await window.liff.init({ liffId });

        if (!window.liff.isLoggedIn()) {
          window.liff.login({ redirectUri: window.location.href });
          return;
        }

        const profile = await window.liff.getProfile();
        const nextIdToken = window.liff.getIDToken() || "";
        const nextEnvironment: LiffEnvironmentState = {
          collectedAt: new Date().toISOString(),
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
          appLanguage:
            window.liff.getAppLanguage?.() || window.liff.getLanguage?.() || null,
          liffSdkVersion: window.liff.getVersion?.() || null,
          lineVersion: window.liff.getLineVersion?.() || null,
          os: window.liff.getOS?.() || null,
          isInClient: window.liff.isInClient(),
          isLoggedIn: window.liff.isLoggedIn(),
          hasIdToken: Boolean(nextIdToken),
          context: safeContext(window.liff.getContext?.()),
          displayName: safeString(profile.displayName),
        };

        if (!cancelled) {
          setEnvironment(nextEnvironment);
          setIdToken(nextIdToken);
          setInitError(null);
          setReady(true);
        }
      } catch (error) {
        if (!cancelled) {
          setInitError(
            error instanceof Error ? error.message : "Unable to initialize LIFF validation harness."
          );
          setReady(true);
        }
      }
    }

    initializeHarness();

    return () => {
      cancelled = true;
    };
  }, [liffId]);

  const reportText = buildReportText({
    businessName,
    environment,
    checks,
    persistedReport,
    notes: runNotes,
  });

  async function runPrefillCheck(currentIdToken: string): Promise<CheckExecutionResult> {
    const startedAt = new Date().toISOString();
    const response = await fetch(
      `/api/customers/prefill?liffIdToken=${encodeURIComponent(currentIdToken)}`,
      {
        cache: "no-store",
        headers: {
          "x-liff-debug-fingerprint": "validation-harness",
        },
      }
    );
    const body = await readResponseBody(response);
    const redirectedToLogin = response.redirected || response.url.includes("/auth/login");
    const passed = !redirectedToLogin && response.ok;

    return {
      check: {
        id: "LIFF-VAL-006",
        title: LIFF_VALIDATION_CHECK_TITLES["LIFF-VAL-006"],
        passed,
        summary: passed
          ? "Prefill reached the handler without auth redirect"
          : redirectedToLogin
            ? "Prefill redirected to /auth/login"
            : `Prefill returned HTTP ${response.status}`,
        detail: redirectedToLogin
          ? response.url
          : response.ok
            ? "Route stayed on the LIFF API surface."
            : safeString(
                typeof body === "string"
                  ? body
                  : body && typeof body === "object" && "error" in body
                    ? (body as Record<string, unknown>).error
                    : null
              ),
        startedAt,
        completedAt: new Date().toISOString(),
        evidence: {
          status: response.status,
          redirected: response.redirected,
          url: response.url,
        },
      },
      aux:
        body && typeof body === "object" && !Array.isArray(body)
          ? (body as Record<string, unknown>)
          : null,
    };
  }

  async function runIntakeCheck(
    currentIdToken: string,
    currentEnvironment: LiffEnvironmentState,
    prefillBody: Record<string, unknown> | null,
    catalogProductValue: string
  ): Promise<CheckExecutionResult> {
    const startedAt = new Date().toISOString();
    const runLabel = createRunLabel();
    const payload: IntakePayload = {
      validationMode: LIFF_VALIDATION_MODE,
      liffIdToken: currentIdToken,
      liffContextSnapshot: JSON.stringify(currentEnvironment),
      productType: catalogProductValue,
      width: 120,
      height: 60,
      unit: "cm",
      qty: 1,
      dueDate: getBangkokDatePlusOne(),
      phone:
        safeString(prefillBody?.phone) ||
        "0990000000",
      note: buildLiffValidationTestNote(runLabel),
      referenceInfo: `${runLabel} / operator ${currentEnvironment.displayName || "LINE user"}`,
      designBrief: "One-button LIFF validation harness tax invoice submission.",
      requestedDocumentType: "tax_invoice",
      requestedDocumentTypes: ["quote", "tax_invoice"],
      billingEntityType: "company",
      billingBranchType: "head_office",
      billingName: "LIFF Validation Harness Co., Ltd.",
      taxId: "0105559999999",
      billingAddress: "99 Validation Road, Wang Thonglang, Bangkok 10310",
      fulfillmentMode: "pickup",
      intakeMode: "resume",
    };

    const response = await fetch("/api/intake", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-liff-debug-fingerprint": "validation-harness",
      },
      body: JSON.stringify(payload),
    });
    const body = await readResponseBody(response);
    const responseObject =
      body && typeof body === "object" && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : null;
    const passed = response.ok && Boolean(responseObject?.success);

    return {
      check: {
        id: "LIFF-VAL-007",
        title: LIFF_VALIDATION_CHECK_TITLES["LIFF-VAL-007"],
        passed,
        summary: passed
          ? "Tax invoice intake succeeded with verified LIFF identity"
          : `Tax invoice intake returned HTTP ${response.status}`,
        detail: passed
          ? `quoteToken ${safeString(responseObject?.quoteToken) || "-"}`
          : safeString(responseObject?.error) || "Unable to complete validation intake.",
        startedAt,
        completedAt: new Date().toISOString(),
        evidence: {
          status: response.status,
          leadId: responseObject?.leadId || null,
          quoteId: responseObject?.quoteId || null,
          quoteToken: safeString(responseObject?.quoteToken),
          validationMode: LIFF_VALIDATION_MODE,
        },
      },
      aux: responseObject,
    };
  }

  async function runCatalogCheck(): Promise<CheckExecutionResult> {
    const startedAt = new Date().toISOString();
    const response = await fetch("/api/intake/product-catalog", {
      cache: "no-store",
    });
    const body = await readResponseBody(response);
    const responseObject =
      body && typeof body === "object" && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : null;
    const products = Array.isArray(responseObject?.products)
      ? responseObject?.products
      : [];
    const source = safeString(responseObject?.source);
    const passed = response.ok && source === "database";

    return {
      check: {
        id: "LIFF-VAL-008",
        title: LIFF_VALIDATION_CHECK_TITLES["LIFF-VAL-008"],
        passed,
        summary: passed
          ? "Runtime catalog returned database-backed products"
          : `Catalog source is ${source || "unknown"}`,
        detail: passed
          ? `${products.length} active products returned`
          : "LIFF validation requires source=database before marking this check passed.",
        startedAt,
        completedAt: new Date().toISOString(),
        evidence: {
          status: response.status,
          source,
          productCount: products.length,
        },
      },
      aux: responseObject,
    };
  }

  async function persistReport(nextChecks: LiffValidationCheckResult[], notes: string | null) {
    if (!environment || !idToken) {
      setPersistError("Missing LIFF environment or ID token.");
      return;
    }

    const response = await fetch("/api/liff/validation-report", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        idToken,
        environment,
        checks: nextChecks,
        notes,
      }),
    });
    const body = await readResponseBody(response);
    const responseObject =
      body && typeof body === "object" && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : null;

    if (!response.ok || !responseObject?.ok) {
      setPersistError(
        safeString(responseObject?.error) || "Failed to save validation report."
      );
      setPersistedReport(null);
      return;
    }

    setPersistError(null);
    setPersistedReport({
      reportId: safeString(responseObject.reportId) || "-",
      createdAt: safeString(responseObject.createdAt) || new Date().toISOString(),
      passed: Boolean(responseObject.passed),
      failedChecks: Array.isArray(responseObject.failedChecks)
        ? responseObject.failedChecks.filter(
            (entry): entry is LiffValidationCheckId =>
              entry === "LIFF-VAL-006" || entry === "LIFF-VAL-007" || entry === "LIFF-VAL-008"
          )
        : [],
    });
  }

  async function handleRunValidation() {
    if (!environment || !idToken || runStatus === "running") {
      return;
    }

    setRunStatus("running");
    setPersistError(null);
    setPersistedReport(null);
    setCopyState("idle");
    let nextChecks = buildInitialChecks();
    setChecks(nextChecks);

    try {
      const prefillResult = await runPrefillCheck(idToken);
      nextChecks = mergeCheck(nextChecks, prefillResult.check);
      setChecks(nextChecks);

      const catalogResult = await runCatalogCheck();
      nextChecks = mergeCheck(nextChecks, catalogResult.check);
      setChecks(nextChecks);

      const products = Array.isArray(catalogResult.aux?.products)
        ? (catalogResult.aux?.products as Array<Record<string, unknown>>)
        : [];
      const catalogProductValue =
        safeString(products[0]?.value) ||
        "vinyl_banner";

      const intakeResult = await runIntakeCheck(
        idToken,
        environment,
        prefillResult.aux,
        catalogProductValue
      );
      nextChecks = mergeCheck(nextChecks, intakeResult.check);
      setChecks(nextChecks);

      const notes = [
        intakeResult.check.passed
          ? `Test intake quoteToken ${safeString(intakeResult.aux?.quoteToken) || "-"}`
          : null,
        catalogResult.check.passed ? "Catalog is using runtime database rows." : null,
        prefillResult.check.passed ? "Prefill stayed public to LIFF." : null,
      ]
        .filter(Boolean)
        .join(" ") || null;
      setRunNotes(notes);
      await persistReport(nextChecks, notes);
    } catch (error) {
      setPersistError(
        error instanceof Error ? error.message : "Validation harness run failed unexpectedly."
      );
    } finally {
      setRunStatus("completed");
    }
  }

  async function handleCopyReport() {
    try {
      await navigator.clipboard.writeText(reportText);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  const passedCount = checks.filter((check) => check.passed).length;
  const overallPassed = checks.length > 0 && passedCount === checks.length;
  const runButtonDisabled = !ready || !environment?.hasIdToken || runStatus === "running";

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(14,116,144,0.18),transparent_45%),linear-gradient(180deg,#f8fafc_0%,#ecfeff_42%,#f8fafc_100%)] px-4 py-6 text-slate-900">
      <div className="mx-auto max-w-4xl space-y-5">
        <section className="overflow-hidden rounded-[28px] border border-cyan-100/70 bg-white/90 shadow-[0_18px_60px_rgba(14,116,144,0.16)] backdrop-blur">
          <div className="border-b border-cyan-100/80 bg-[linear-gradient(135deg,rgba(6,182,212,0.12),rgba(14,116,144,0.04))] px-5 py-5 sm:px-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700">
                  LIFF Validation Harness
                </p>
                <h1 className="mt-2 text-2xl font-bold text-slate-950">
                  {businessName} LINE device validation
                </h1>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  เปิดจาก LINE จริงเพียงครั้งเดียว แล้วกดปุ่มเดียวเพื่อรัน 006, 007, 008 พร้อมบันทึกผลแบบไม่เก็บ token ดิบ.
                </p>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-900 shadow-sm">
                <div className="flex items-center gap-2 font-semibold">
                  <ShieldCheck className="h-4 w-4" />
                  Non-dangerous validation mode
                </div>
                <p className="mt-1 max-w-xs text-xs leading-5 text-amber-800">
                  Harness จะสร้างเฉพาะ lead/quote ที่ติด tag test data จาก server และไม่เก็บ LINE token ดิบใน UI หรือฐานข้อมูล.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 px-5 py-5 sm:grid-cols-[minmax(0,1.5fr)_280px] sm:px-7">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/85 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Smartphone className="h-4 w-4 text-cyan-700" />
                LIFF environment snapshot
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-white px-3 py-3 shadow-sm ring-1 ring-slate-100">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">In LINE client</p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">
                    {environment?.isInClient === null ? "-" : environment?.isInClient ? "YES" : "NO"}
                  </p>
                </div>
                <div className="rounded-xl bg-white px-3 py-3 shadow-sm ring-1 ring-slate-100">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Logged in</p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">
                    {environment?.isLoggedIn === null ? "-" : environment?.isLoggedIn ? "YES" : "NO"}
                  </p>
                </div>
                <div className="rounded-xl bg-white px-3 py-3 shadow-sm ring-1 ring-slate-100">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">OS / LINE</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950">
                    {[environment?.os || "-", environment?.lineVersion || "-"].join(" / ")}
                  </p>
                </div>
                <div className="rounded-xl bg-white px-3 py-3 shadow-sm ring-1 ring-slate-100">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Context</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950">
                    {[environment?.context?.type || "-", environment?.context?.viewType || "-"].join(" / ")}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
                <p>LIFF SDK: <span className="font-medium text-slate-700">{environment?.liffSdkVersion || "-"}</span></p>
                <p>ID token present: <span className="font-medium text-slate-700">{environment?.hasIdToken ? "yes" : "no"}</span></p>
                <p>Collected at: <span className="font-medium text-slate-700">{formatTimestamp(environment?.collectedAt)}</span></p>
                <p>Display name: <span className="font-medium text-slate-700">{environment?.displayName || "-"}</span></p>
              </div>
            </div>

            <div className={`rounded-2xl border px-4 py-4 shadow-sm ${overallPassed ? "border-emerald-200 bg-emerald-50/85" : "border-slate-200 bg-white/88"}`}>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Screenshot Summary
              </p>
              <p className={`mt-3 text-3xl font-bold ${overallPassed ? "text-emerald-700" : "text-slate-950"}`}>
                {overallPassed ? "PASS" : runStatus === "idle" ? "READY" : "CHECK"}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                {passedCount}/{checks.length} checks passed
              </p>
              <div className="mt-4 space-y-2 text-sm text-slate-600">
                <p>Report: {persistedReport ? compactText(persistedReport.reportId) : "not saved yet"}</p>
                <p>Saved at: {formatTimestamp(persistedReport?.createdAt)}</p>
                <p>Failed: {persistedReport?.failedChecks.join(", ") || checks.filter((check) => !check.passed).map((check) => check.id).join(", ") || "-"}</p>
              </div>

              <button
                type="button"
                onClick={handleRunValidation}
                disabled={runButtonDisabled}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {runStatus === "running" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                {runStatus === "running" ? "Running validation" : "Run validation"}
              </button>
              <button
                type="button"
                onClick={handleCopyReport}
                disabled={checks.every((check) => check.summary === "Pending")}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
              >
                <Copy className="h-4 w-4" />
                {copyState === "copied" ? "Copied report" : copyState === "failed" ? "Copy failed" : "Copy report"}
              </button>
            </div>
          </div>
        </section>

        {initError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50/90 px-4 py-3 text-sm text-rose-800 shadow-sm">
            <div className="flex items-center gap-2 font-semibold">
              <AlertCircle className="h-4 w-4" />
              LIFF initialization problem
            </div>
            <p className="mt-1 leading-6">{initError}</p>
          </div>
        ) : null}

        {persistError ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-900 shadow-sm">
            <div className="flex items-center gap-2 font-semibold">
              <AlertCircle className="h-4 w-4" />
              Report persistence warning
            </div>
            <p className="mt-1 leading-6">{persistError}</p>
          </div>
        ) : null}

        <section className="rounded-[28px] border border-slate-200 bg-white/92 p-5 shadow-[0_16px_50px_rgba(15,23,42,0.08)] sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Validation Checks
              </p>
              <h2 className="mt-2 text-xl font-bold text-slate-950">One tap, three proofs</h2>
            </div>
            <p className="text-sm text-slate-500">
              Route 006 confirms public access, 007 creates tagged tax-invoice test data, 008 proves runtime catalog source.
            </p>
          </div>

          <div className="mt-5 space-y-3">
            {checks.map((check) => {
              const pending = check.summary === "Pending";
              const statusTone = pending
                ? "border-slate-200 bg-slate-50"
                : check.passed
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-rose-200 bg-rose-50";

              return (
                <div key={check.id} className={`rounded-2xl border px-4 py-4 ${statusTone}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        {pending ? (
                          <LoaderCircle className="h-4 w-4 text-slate-400" />
                        ) : check.passed ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-rose-600" />
                        )}
                        <p className="text-sm font-semibold text-slate-950">{check.id}</p>
                      </div>
                      <p className="mt-2 text-base font-semibold text-slate-950">{check.title}</p>
                      <p className="mt-1 text-sm text-slate-700">{check.summary}</p>
                      {check.detail ? <p className="mt-2 text-xs leading-5 text-slate-500">{check.detail}</p> : null}
                    </div>

                    <div className="text-right text-xs text-slate-500">
                      <p>{check.passed ? "PASS" : pending ? "PENDING" : "FAIL"}</p>
                      <p className="mt-1">{formatTimestamp(check.completedAt || check.startedAt)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white/92 p-5 shadow-[0_16px_50px_rgba(15,23,42,0.08)] sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">What this run does</p>
          <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/85 p-4">
              <p className="font-semibold text-slate-900">006</p>
              <p className="mt-2 leading-6">Calls `/api/customers/prefill` with the real LIFF ID token and fails if middleware pushes the request to `/auth/login`.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/85 p-4">
              <p className="font-semibold text-slate-900">007</p>
              <p className="mt-2 leading-6">Submits a tagged tax-invoice test intake with the verified LIFF identity path so the operator can prove the real WebView submit flow.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/85 p-4">
              <p className="font-semibold text-slate-900">008</p>
              <p className="mt-2 leading-6">Checks `/api/intake/product-catalog` and only passes if the response says `source=database`, never fallback.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}