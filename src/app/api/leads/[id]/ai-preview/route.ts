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
        // "drafting" = image generated, admin reviews before sending to customer.
        // Job/conversation state changes happen only when admin explicitly sends
        // the preview via POST /api/leads/[id]/send-preview.
        design_status: "drafting",
      })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    const { data: relatedQuote } = await supabase
      .from("quotes")
      .select("id, jobs(id, status)")
      .eq("lead_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const relatedJob = Array.isArray(relatedQuote?.jobs)
      ? relatedQuote.jobs[0]
      : relatedQuote?.jobs;

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