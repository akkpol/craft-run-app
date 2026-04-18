import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { applyProductionReviewAction } from "@/lib/production-media";

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
    const result = await applyProductionReviewAction({
      supabase: createAdminClient(),
      eventId: id,
      action: "approve",
      reviewNote: body.reviewNote,
      reviewedBy: "admin",
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to approve production event";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
