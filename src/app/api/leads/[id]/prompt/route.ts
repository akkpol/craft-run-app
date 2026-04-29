import { NextRequest, NextResponse } from "next/server";

import { logHumanAction } from "@/lib/action-log";
import { prepareLeadAiPrompt } from "@/lib/lead-ai-prompt";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  const payload = await request.json().catch(() => null);

  if (!payload || typeof payload.prompt !== "string") {
    return NextResponse.json({ error: "Prompt payload is required" }, { status: 400 });
  }

  const explicitPrompt = payload.prompt.trim() || null;
  const supabase = createAdminClient();

  const { data: lead, error } = await supabase
    .from("leads")
    .select(
      "id, product_type, width_mm, height_mm, qty, note_from_form, reference_info, design_brief, ai_image_prompt, ai_prompt_snapshot"
    )
    .eq("id", id)
    .single();

  if (error || !lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const preparedPrompt = prepareLeadAiPrompt({
    ...lead,
    ai_image_prompt: explicitPrompt,
    ai_prompt_snapshot: null,
  });

  const { error: updateError } = await supabase
    .from("leads")
    .update({
      ai_image_prompt: explicitPrompt,
      ai_prompt_snapshot: preparedPrompt?.prompt || null,
      ai_image_error: null,
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  await logHumanAction(supabase, {
    entityType: "lead",
    entityId: id,
    actionType: "lead.prompt_updated",
    actorId: "admin-dashboard",
    actorLabel: "Admin dashboard",
    note: explicitPrompt
      ? "Updated AI prompt override"
      : "Cleared AI prompt override and reverted to automatic prompt",
    payload: {
      explicit_override: Boolean(explicitPrompt),
      prompt_seed: preparedPrompt?.seed || null,
      prompt_length: preparedPrompt?.prompt.length || 0,
    },
  });

  return NextResponse.json({
    success: true,
    aiImagePrompt: explicitPrompt,
    prompt: preparedPrompt?.prompt || "",
    seed: preparedPrompt?.seed || null,
  });
}