import { NextRequest, NextResponse } from "next/server";

import {
  hashLineUserId,
  normalizeLiffValidationReportPayload,
} from "@/lib/liff-validation-report";
import { verifyLiffIdToken } from "@/lib/line";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_REPORT_BODY_BYTES = 65_536;

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json({ error: "Unsupported content type" }, { status: 415 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_REPORT_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid validation payload" }, { status: 400 });
  }

  let payload;
  try {
    payload = normalizeLiffValidationReportPayload(body);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid validation payload" },
      { status: 400 }
    );
  }

  let identity;
  try {
    identity = await verifyLiffIdToken(payload.idToken);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `Unable to verify LINE identity: ${error.message}`
            : "Unable to verify LINE identity",
      },
      { status: 401 }
    );
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("liff_validation_runs")
    .insert({
      run_by_line_user_id_hash: hashLineUserId(identity.userId),
      environment: payload.record.environment,
      liff_is_in_client: payload.record.liffIsInClient,
      liff_logged_in: payload.record.liffLoggedIn,
      line_version: payload.record.lineVersion,
      checks_json: payload.record.checks,
      passed: payload.record.passed,
      failed_checks: payload.record.failedChecks,
      notes: payload.record.notes,
    })
    .select("id, created_at, passed, failed_checks")
    .single();

  if (error || !data) {
    return NextResponse.json(
      {
        error: error?.message || "Failed to store LIFF validation report",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    reportId: data.id,
    createdAt: data.created_at,
    passed: data.passed,
    failedChecks: data.failed_checks || [],
  });
}