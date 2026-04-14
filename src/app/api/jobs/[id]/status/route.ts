import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { pushStatusUpdate } from "@/lib/line";
import { JOB_STATUSES } from "@/lib/types";

// Next.js 16: async params
export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;

  let body: { status: string; note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.status || !JOB_STATUSES.includes(body.status as any)) {
    return NextResponse.json(
      { error: `Invalid status. Must be one of: ${JOB_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // 1. Update job status
  const { data: job, error } = await supabase
    .from("jobs")
    .update({ status: body.status })
    .eq("id", id)
    .select("*, quotes(public_token, leads(conversation_id))")
    .single();

  if (error || !job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // 2. Add timeline entry
  await supabase.from("job_timeline").insert({
    job_id: id,
    status: body.status,
    note: body.note || null,
  });

  // 3. Update conversation state
  const conversationId = job.quotes?.leads?.conversation_id;
  if (conversationId) {
    const convState =
      body.status === "COMPLETED"
        ? "COMPLETED"
        : body.status === "IN_PROGRESS"
          ? "IN_PROGRESS"
          : "JOB_CREATED";

    await supabase
      .from("conversations")
      .update({ state: convState })
      .eq("id", conversationId);
  }

  // 4. Update lead status
  if (job.lead_id) {
    const leadStatus =
      body.status === "COMPLETED"
        ? "completed"
        : body.status === "IN_PROGRESS"
          ? "in_progress"
          : "approved";

    await supabase
      .from("leads")
      .update({ status: leadStatus })
      .eq("id", job.lead_id);
  }

  // 5. Notify customer
  try {
    if (conversationId && job.quotes?.public_token) {
      const { data: conv } = await supabase
        .from("conversations")
        .select("line_user_id")
        .eq("id", conversationId)
        .single();

      if (conv) {
        await pushStatusUpdate(
          conv.line_user_id,
          body.status,
          job.quotes.public_token
        );
      }
    }
  } catch (error) {
    console.error("Failed to notify customer:", error);
  }

  return NextResponse.json({ success: true, status: body.status });
}
