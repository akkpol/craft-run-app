import { NextRequest, NextResponse } from "next/server";

import {
  logLiffIncident,
  normalizeLiffIncidentPayload,
} from "@/lib/liff-observability";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
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

  const supabase = createAdminClient();
  await logLiffIncident(supabase, incident);

  return NextResponse.json({ ok: true });
}