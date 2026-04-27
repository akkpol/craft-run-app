import { NextRequest, NextResponse } from "next/server";
import { generateLeadAiPreview } from "@/lib/ai-images";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAiAction } from "@/lib/action-log";
import { prepareLeadAiPrompt } from "@/lib/lead-ai-prompt";

export async function POST(
  _request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  const supabase = createAdminClient();

  const { data: lead, error } = await supabase
    .from("leads")
    .select("id, product_type, width_mm, height_mm, qty, note_from_form, reference_info, design_brief, ai_image_prompt, ai_prompt_snapshot")
    .eq("id", id)
    .single();

  if (error || !lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const preparedPrompt = prepareLeadAiPrompt(lead);
  if (!preparedPrompt) {
    return NextResponse.json(
      { error: "Lead does not have an AI prompt or design brief" },
      { status: 400 }
    );
  }

  await supabase
    .from("leads")
    .update({
      ai_image_status: "pending",
      ai_image_error: null,
      ai_prompt_snapshot: preparedPrompt.prompt,
      design_status: "drafting",
    })
    .eq("id", id);

  try {
    const imageUrls = await generateLeadAiPreview({
      leadId: id,
      prompt: preparedPrompt.prompt,
    });

    const { error: updateError } = await supabase
      .from("leads")
      .update({
        ai_image_status: "generated",
        ai_generated_images: imageUrls,
        ai_image_error: null,
        ai_prompt_snapshot: preparedPrompt.prompt,
        design_status: "preview_sent",
      })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    const { data: relatedQuote } = await supabase
      .from("quotes")
      .select("id, leads(conversation_id), jobs(id, status)")
      .eq("lead_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const relatedLead = Array.isArray(relatedQuote?.leads)
      ? relatedQuote.leads[0]
      : relatedQuote?.leads;
    const relatedJob = Array.isArray(relatedQuote?.jobs)
      ? relatedQuote.jobs[0]
      : relatedQuote?.jobs;
    const timelineNote = "ส่งแบบให้ลูกค้าตรวจแล้ว";

    await Promise.all([
      relatedJob?.id && relatedJob.status !== "ON_HOLD_CUSTOMER_INPUT"
        ? supabase
            .from("jobs")
            .update({ status: "ON_HOLD_CUSTOMER_INPUT", production_status: "queued" })
            .eq("id", relatedJob.id)
        : Promise.resolve(),
      relatedJob?.id && relatedJob.status !== "ON_HOLD_CUSTOMER_INPUT"
        ? supabase.from("job_timeline").insert({
            job_id: relatedJob.id,
            status: "ON_HOLD_CUSTOMER_INPUT",
            note: timelineNote,
          })
        : Promise.resolve(),
      relatedLead?.conversation_id
        ? supabase
            .from("conversations")
            .update({ state: "ON_HOLD_CUSTOMER_INPUT" })
            .eq("id", relatedLead.conversation_id)
        : Promise.resolve(),
    ]);

    await logAiAction(supabase, {
      entityType: "lead",
      entityId: id,
      actionType: "lead.ai_preview_generated",
      payload: {
        success: true,
        image_count: imageUrls.length,
        job_id: relatedJob?.id ?? null,
        prompt_seed: preparedPrompt.seed,
        prompt_length: preparedPrompt.prompt.length,
      },
    });

    return NextResponse.json({ success: true, imageUrls });
  } catch (generationError) {
    const message = generationError instanceof Error ? generationError.message : "AI image generation failed";

    await supabase
      .from("leads")
      .update({ ai_image_status: "failed", ai_image_error: message })
      .eq("id", id);

    await logAiAction(supabase, {
      entityType: "lead",
      entityId: id,
      actionType: "lead.ai_preview_generated",
      note: `AI image generation failed: ${message}`,
      payload: {
        success: false,
        error: message,
        prompt_seed: preparedPrompt.seed,
        prompt_length: preparedPrompt.prompt.length,
      },
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}