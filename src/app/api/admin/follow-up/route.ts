import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { pushFollowUpMessage } from "@/lib/line";
import { logHumanAction } from "@/lib/action-log";

// Conversations idle for this many hours are eligible for follow-up
const IDLE_HOURS = 24;

const ELIGIBLE_STATES = ["WAITING_QUOTE_APPROVAL", "ON_HOLD_CUSTOMER_INPUT"];

export async function POST(request: NextRequest) {
  // Allow Vercel Cron or admin manual trigger via CRON_SECRET
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = createAdminClient();
  const cutoff = new Date(Date.now() - IDLE_HOURS * 60 * 60 * 1000).toISOString();

  const { data: conversations, error } = await supabase
    .from("conversations")
    .select("id, state, line_user_id, last_message_at")
    .in("state", ELIGIBLE_STATES)
    .lt("last_message_at", cutoff)
    .limit(100);

  if (error) {
    return NextResponse.json(
      { error: "Failed to query conversations", detail: error.message },
      { status: 500 }
    );
  }

  if (!conversations || conversations.length === 0) {
    return NextResponse.json({ sent: 0, skipped: 0, errors: 0, conversations: [] });
  }

  // Fetch display names for the affected LINE user IDs
  const lineUserIds = [...new Set(conversations.map((c) => c.line_user_id))];
  const { data: customers } = await supabase
    .from("customers")
    .select("line_user_id, display_name")
    .in("line_user_id", lineUserIds);

  const nameMap = new Map(
    (customers ?? []).map((c) => [c.line_user_id, c.display_name])
  );

  let sent = 0;
  let skipped = 0;
  let errors = 0;
  const results: Array<{ id: string; state: string; lineUserId: string; result: string }> = [];

  for (const conv of conversations) {
    if (!conv.line_user_id) {
      skipped++;
      results.push({ id: conv.id, state: conv.state, lineUserId: conv.line_user_id, result: "skipped:no_line_id" });
      continue;
    }

    try {
      const displayName = nameMap.get(conv.line_user_id) ?? null;
      await pushFollowUpMessage(conv.line_user_id, conv.state, displayName);

      await logHumanAction(supabase, {
        entityType: "conversation",
        entityId: conv.id,
        actionType: "follow_up_sent",
        actorLabel: "system:cron",
        payload: { state: conv.state, lineUserId: conv.line_user_id },
      });

      sent++;
      results.push({ id: conv.id, state: conv.state, lineUserId: conv.line_user_id, result: "sent" });
    } catch (err) {
      errors++;
      results.push({
        id: conv.id,
        state: conv.state,
        lineUserId: conv.line_user_id,
        result: `error:${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  return NextResponse.json({ sent, skipped, errors, conversations: results });
}
