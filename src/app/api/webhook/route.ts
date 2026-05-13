import { NextRequest, NextResponse } from "next/server";
import {
  verifySignature,
  getLineClient,
} from "@/lib/line";
import { createAdminClient } from "@/lib/supabase/admin";
import type { WebhookEvent } from "@line/bot-sdk";
import { processWebhookEvent } from "@/lib/webhook-event-processor";

export async function POST(request: NextRequest) {
  // 1. Read raw body for signature verification
  const rawBody = await request.text();
  const signature = request.headers.get("x-line-signature");

  if (!signature || !(await verifySignature(rawBody, signature))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // 2. Parse events
  let body: { events: WebhookEvent[] };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body.events)) {
    return NextResponse.json({ error: "Invalid events payload" }, { status: 400 });
  }

  if (body.events.length === 0) {
    return NextResponse.json({ status: "ok" });
  }

  const supabase = createAdminClient();
  const lineClient = await getLineClient();

  // 3. Process each event — keep it lean and fast
  for (const event of body.events) {
    try {
      await processWebhookEvent(event, { supabase, lineClient });
    } catch (error) {
      // Log but don't fail — other events should still process
      console.error("Webhook event error:", error);
    }
  }

  // Always return 200 quickly to LINE
  return NextResponse.json({ status: "ok" });
}
