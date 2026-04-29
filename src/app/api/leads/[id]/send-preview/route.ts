import { NextRequest, NextResponse } from "next/server";

import { logHumanAction } from "@/lib/action-log";
import { pushLeadDesignPreviewUpdate } from "@/lib/line";
import { createAdminClient } from "@/lib/supabase/admin";

function appendNote(existing: string | null | undefined, note: string) {
  return existing?.trim() ? `${existing.trim()}\n${note}` : note;
}

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  const body = await request.json().catch(() => ({} as { note?: string }));
  const note = body.note?.trim() || null;
  const supabase = createAdminClient();

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("id, conversation_id, design_status, hold_reason, note_from_chat, ai_generated_images")
    .eq("id", id)
    .single();

  if (leadError || !lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const previewUrls = Array.isArray(lead.ai_generated_images)
    ? lead.ai_generated_images.filter((value): value is string => typeof value === "string" && value.length > 0)
    : [];

  if (previewUrls.length === 0) {
    return NextResponse.json(
      { error: "Lead does not have any generated preview images to send" },
      { status: 400 }
    );
  }

  const { data: quote } = await supabase
    .from("quotes")
    .select("id, public_token")
    .eq("lead_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!quote?.public_token || !lead.conversation_id) {
    return NextResponse.json(
      { error: "No customer status link is available for this lead" },
      { status: 400 }
    );
  }

  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, line_user_id")
    .eq("id", lead.conversation_id)
    .single();

  if (!conversation?.line_user_id) {
    return NextResponse.json(
      { error: "No LINE user is available for this lead" },
      { status: 400 }
    );
  }

  const { data: job } = await supabase
    .from("jobs")
    .select("id, status")
    .eq("lead_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  await pushLeadDesignPreviewUpdate({
    userId: conversation.line_user_id,
    statusToken: quote.public_token,
    note,
    assetUrls: previewUrls,
  });

  await supabase
    .from("leads")
    .update({
      design_status: "preview_sent",
      hold_reason: null,
      note_from_chat: note ? appendNote(lead.note_from_chat, note) : lead.note_from_chat,
    })
    .eq("id", id);

  if (job?.id && job.status !== "ON_HOLD_CUSTOMER_INPUT") {
    await supabase
      .from("jobs")
      .update({ status: "ON_HOLD_CUSTOMER_INPUT", production_status: "queued" })
      .eq("id", job.id);

    await supabase.from("job_timeline").insert({
      job_id: job.id,
      status: "ON_HOLD_CUSTOMER_INPUT",
      note: note || `ส่งแบบให้ลูกค้าตรวจแล้ว (${previewUrls.length} ภาพ)`,
    });
  }

  await supabase
    .from("conversations")
    .update({ state: "ON_HOLD_CUSTOMER_INPUT" })
    .eq("id", lead.conversation_id);

  await logHumanAction(supabase, {
    entityType: "lead",
    entityId: id,
    actionType: "lead.design_preview_sent",
    actorId: "admin-dashboard",
    actorLabel: "Admin dashboard",
    note: note || "ส่งแบบให้ลูกค้าตรวจผ่าน LINE แล้ว",
    payload: {
      preview_count: previewUrls.length,
      quote_id: quote.id,
      quote_token: quote.public_token,
      job_id: job?.id ?? null,
    },
  });

  return NextResponse.json({
    success: true,
    designStatus: "preview_sent",
    sentCount: previewUrls.length,
  });
}