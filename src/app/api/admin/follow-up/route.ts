import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { pushFollowUpMessage } from "@/lib/line";
import { logHumanAction } from "@/lib/action-log";

// Conversations idle for this many hours are eligible for follow-up
const IDLE_HOURS = 24;

const ELIGIBLE_STATES = ["WAITING_QUOTE_APPROVAL", "ON_HOLD_CUSTOMER_INPUT"];

type FollowUpQueueKey = "quote-decision" | "customer-waiting";

type FollowUpConversation = {
  id: string;
  state: string;
  lineUserId: string;
  lastMessageAt: string;
  queueKey: FollowUpQueueKey;
  queueLabel: string;
};

type FollowUpPreview = {
  idleHours: number;
  totalCount: number;
  queueCounts: Record<FollowUpQueueKey, number>;
  conversations: FollowUpConversation[];
};

function getFollowUpQueueKey(state: string): FollowUpQueueKey {
  return state === "WAITING_QUOTE_APPROVAL" ? "quote-decision" : "customer-waiting";
}

function getFollowUpQueueLabel(state: string): string {
  return state === "WAITING_QUOTE_APPROVAL"
    ? "Quote Decision"
    : "Customer Waiting";
}

async function loadFollowUpPreview(
  supabase: ReturnType<typeof createAdminClient>
): Promise<FollowUpPreview> {
  const cutoff = new Date(Date.now() - IDLE_HOURS * 60 * 60 * 1000).toISOString();

  const { data: conversations, error } = await supabase
    .from("conversations")
    .select("id, state, line_user_id, last_message_at")
    .in("state", ELIGIBLE_STATES)
    .lt("last_message_at", cutoff)
    .order("last_message_at", { ascending: true })
    .limit(100);

  if (error) {
    throw error;
  }

  const rows = (conversations || [])
    .filter((conversation) => conversation.line_user_id)
    .map((conversation) => {
      const queueKey = getFollowUpQueueKey(conversation.state);
      return {
        id: conversation.id,
        state: conversation.state,
        lineUserId: conversation.line_user_id,
        lastMessageAt: conversation.last_message_at,
        queueKey,
        queueLabel: getFollowUpQueueLabel(conversation.state),
      };
    });

  const queueCounts: Record<FollowUpQueueKey, number> = {
    "quote-decision": 0,
    "customer-waiting": 0,
  };

  for (const row of rows) {
    queueCounts[row.queueKey] += 1;
  }

  return {
    idleHours: IDLE_HOURS,
    totalCount: rows.length,
    queueCounts,
    conversations: rows,
  };
}

export async function POST(request: NextRequest) {
  // Allow Vercel Cron or admin manual trigger via CRON_SECRET
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (cronSecret && authHeader && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  let preview: FollowUpPreview;
  try {
    preview = await loadFollowUpPreview(supabase);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to query conversations",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }

  if (preview.totalCount === 0) {
    return NextResponse.json({ sent: 0, skipped: 0, errors: 0, conversations: [] });
  }

  // Fetch display names for the affected LINE user IDs
  const lineUserIds = [...new Set(preview.conversations.map((c) => c.lineUserId))];
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

  for (const conv of preview.conversations) {
    if (!conv.lineUserId) {
      skipped++;
      results.push({ id: conv.id, state: conv.state, lineUserId: conv.lineUserId, result: "skipped:no_line_id" });
      continue;
    }

    try {
      const displayName = nameMap.get(conv.lineUserId) ?? null;
      await pushFollowUpMessage(conv.lineUserId, conv.state, displayName);

      await logHumanAction(supabase, {
        entityType: "conversation",
        entityId: conv.id,
        actionType: "follow_up_sent",
        actorLabel: "system:cron",
        payload: { state: conv.state, lineUserId: conv.lineUserId },
      });

      sent++;
      results.push({ id: conv.id, state: conv.state, lineUserId: conv.lineUserId, result: "sent" });
    } catch (err) {
      errors++;
      results.push({
        id: conv.id,
        state: conv.state,
        lineUserId: conv.lineUserId,
        result: `error:${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  return NextResponse.json({ sent, skipped, errors, conversations: results });
}

export async function GET() {
  const supabase = createAdminClient();

  try {
    const preview = await loadFollowUpPreview(supabase);
    return NextResponse.json(preview);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to query conversations", detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
