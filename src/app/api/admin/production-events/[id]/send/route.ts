import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { applyProductionReviewAction } from "@/lib/production-media";
import { logHumanAction } from "@/lib/action-log";

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;

  let body: { reviewNote?: string } = {};
  try {
    body = await request.json();
  } catch {
    // noop
  }

  try {
    const supabase = createAdminClient();
    const result = await applyProductionReviewAction({
      supabase,
      eventId: id,
      action: "send",
      reviewNote: body.reviewNote,
      reviewedBy: "admin",
    });

    await logHumanAction(supabase, {
      entityType: "job",
      entityId: id,
      actionType: "job.production_event",
      actorLabel: "Admin",
      note: body.reviewNote,
      payload: { action: "send", event_id: id },
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to send production event";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
