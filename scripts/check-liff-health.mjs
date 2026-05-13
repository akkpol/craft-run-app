function normalizeBaseUrl(value) {
  return (value || "").trim().replace(/\/$/, "");
}

function resolveHealthUrl() {
  const explicit = normalizeBaseUrl(process.argv[2] || process.env.LIFF_HEALTH_BASE_URL);
  const baseUrl = explicit || normalizeBaseUrl(process.env.NEXT_PUBLIC_BASE_URL);

  if (!baseUrl) {
    throw new Error(
      "Missing LIFF health base URL. Provide NEXT_PUBLIC_BASE_URL, LIFF_HEALTH_BASE_URL, or pass a URL argument."
    );
  }

  return `${baseUrl}/api/liff/health`;
}

function summarizeFailingChecks(checks) {
  return checks
    .filter((check) => !check.ok)
    .map((check) => `- ${check.title}: ${check.detail}`)
    .join("\n");
}

async function main() {
  const healthUrl = resolveHealthUrl();
  const response = await fetch(healthUrl, {
    headers: {
      accept: "application/json",
      "user-agent": "craft-run-app-liff-health-check/1.0",
    },
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload || payload.ok !== true) {
    const checks = Array.isArray(payload?.checks) ? payload.checks : [];
    const details = checks.length > 0 ? `\n${summarizeFailingChecks(checks)}` : "";
    throw new Error(
      `LIFF health check failed (${response.status}) for ${healthUrl}.${details}`
    );
  }

  const latestValidationRun = payload.observability?.latestValidationRun;
  const validationStatus = latestValidationRun
    ? latestValidationRun.passed
      ? "PASS"
      : "FAIL"
    : "NO_DATA";

  console.log(
    `[liff-health] ok ${healthUrl} recentIncidents=${payload.observability?.recentIncidentCount ?? 0} latestValidation=${validationStatus}`
  );
}

main().catch((error) => {
  console.error(
    `[liff-health] ${error instanceof Error ? error.message : "Unknown LIFF health check failure"}`
  );
  process.exit(1);
});