import { NextRequest, NextResponse } from "next/server";

import {
  logLiffIncident,
  normalizeLiffIncidentPayload,
} from "@/lib/liff-observability";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_INCIDENT_BODY_BYTES = 32_768;

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json({ error: "Unsupported content type" }, { status: 415 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_INCIDENT_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid LIFF incident payload" }, { status: 400 });
  }

  let incident;
  try {
    incident = normalizeLiffIncidentPayload(body);
  } catch {
    return NextResponse.json({ error: "Invalid LIFF incident payload" }, { status: 400 });
  }

  if (!incident) {
    return NextResponse.json({ error: "Invalid LIFF incident payload" }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    await logLiffIncident(supabase, incident);
  } catch (error) {
    console.error("Failed to persist LIFF incident", error);
    return NextResponse.json({ ok: false }, { status: 202 });
  }

  return NextResponse.json({ ok: true });
}