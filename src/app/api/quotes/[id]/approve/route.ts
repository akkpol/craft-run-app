import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { pushStatusUpdate } from "@/lib/line";

// Next.js 16: async params
export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  const supabase = createAdminClient();

  // 1. Find quote
  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .select("*, leads(*)")
    .eq("id", id)
    .single();

  if (quoteError || !quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  if (quote.status === "approved") {
    return NextResponse.json(
      { error: "Quote already approved" },
      { status: 400 }
    );
  }

  // 2. Update quote status
  await supabase
    .from("quotes")
    .update({ status: "approved" })
    .eq("id", id);

  // 3. Update lead status
  await supabase
    .from("leads")
    .update({ status: "approved" })
    .eq("id", quote.lead_id);

  // 4. Create job
  const { data: job } = await supabase
    .from("jobs")
    .insert({
      quote_id: quote.id,
      lead_id: quote.lead_id,
      status: "JOB_CREATED",
    })
    .select("id")
    .single();

  if (!job) {
    return NextResponse.json(
      { error: "Failed to create job" },
      { status: 500 }
    );
  }

  // 5. Create timeline event
  await supabase.from("job_timeline").insert({
    job_id: job.id,
    status: "JOB_CREATED",
    note: "Job created from approved quote",
  });

  // 6. Update conversation state
  if (quote.leads?.conversation_id) {
    await supabase
      .from("conversations")
      .update({ state: "JOB_CREATED" })
      .eq("id", quote.leads.conversation_id);
  }

  // 7. Notify customer via LINE
  try {
    if (quote.leads?.conversation_id) {
      const { data: conv } = await supabase
        .from("conversations")
        .select("line_user_id")
        .eq("id", quote.leads.conversation_id)
        .single();

      if (conv) {
        await pushStatusUpdate(
          conv.line_user_id,
          "JOB_CREATED",
          quote.public_token
        );
      }
    }
  } catch (error) {
    console.error("Failed to notify customer:", error);
  }

  return NextResponse.json({
    success: true,
    jobId: job.id,
    message: "Quote approved, job created",
  });
}
