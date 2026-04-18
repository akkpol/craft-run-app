import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isWorkflowState,
  type WorkflowState,
} from "@/lib/types";
import {
  canTransitionConversationState,
  isTerminalConversationState,
} from "@/lib/workflow-transitions";

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;

  let body: { state: string; note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.state || !isWorkflowState(body.state)) {
    return NextResponse.json({ error: "Invalid state" }, { status: 400 });
  }

  const nextState = body.state as WorkflowState;
  const supabase = createAdminClient();

  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select("id, state")
    .eq("id", id)
    .single();

  if (conversationError || !conversation || !isWorkflowState(conversation.state)) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const currentState = conversation.state;

  if (currentState === nextState) {
    return NextResponse.json({ success: true, state: nextState, unchanged: true });
  }

  if (isTerminalConversationState(currentState)) {
    return NextResponse.json(
      { error: `Cannot transition terminal state ${currentState}` },
      { status: 400 }
    );
  }

  if (!canTransitionConversationState(currentState, nextState)) {
    return NextResponse.json(
      { error: `Invalid transition from ${currentState} to ${nextState}` },
      { status: 400 }
    );
  }

  await supabase.from("conversations").update({ state: nextState }).eq("id", id);

  const { data: latestLead } = await supabase
    .from("leads")
    .select("id, hold_reason, human_review_reason")
    .eq("conversation_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (latestLead) {
    const leadUpdate: {
      hold_reason?: string | null;
      human_review_reason?: string | null;
    } = {};

    if (nextState === "ON_HOLD_CUSTOMER_INPUT") {
      leadUpdate.hold_reason = body.note?.trim() || latestLead.hold_reason || "รอข้อมูลเพิ่มเติมจากลูกค้า";
    } else if (currentState === "ON_HOLD_CUSTOMER_INPUT") {
      leadUpdate.hold_reason = null;
    }

    if (nextState === "HUMAN_REVIEW_REQUIRED") {
      leadUpdate.human_review_reason =
        body.note?.trim() || latestLead.human_review_reason || "ต้องการให้ทีมงานตรวจสอบ";
    } else if (currentState === "HUMAN_REVIEW_REQUIRED") {
      leadUpdate.human_review_reason = null;
    }

    if (Object.keys(leadUpdate).length > 0) {
      await supabase.from("leads").update(leadUpdate).eq("id", latestLead.id);
    }
  }

  if (currentState === "HUMAN_REVIEW_REQUIRED" && nextState !== "HUMAN_REVIEW_REQUIRED") {
    await supabase
      .from("escalations")
      .update({ status: "resolved" })
      .eq("conversation_id", id)
      .in("status", ["open", "reviewing"]);
  }

  return NextResponse.json({ success: true, state: nextState });
}