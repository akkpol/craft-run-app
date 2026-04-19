import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDesignStatus } from "@/lib/types";
import { logHumanAction } from "@/lib/action-log";

function appendNote(existing: string | null | undefined, note: string) {
  return existing?.trim() ? `${existing.trim()}\n${note}` : note;
}

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;

  let body: { designStatus?: string; note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.designStatus || !isDesignStatus(body.designStatus)) {
    return NextResponse.json({ error: "Invalid design status" }, { status: 400 });
  }

  const manuallySettable = ["preview_sent", "approved", "revision_requested", "drafting", "not_started"];
  if (!manuallySettable.includes(body.designStatus)) {
    return NextResponse.json(
      { error: "Only preview_sent, approved, revision_requested, drafting, or not_started can be set manually" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const note = body.note?.trim();

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("id, conversation_id, design_status, hold_reason, note_from_chat")
    .eq("id", id)
    .single();

  if (leadError || !lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const { data: job } = await supabase
    .from("jobs")
    .select("id, status")
    .eq("lead_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (body.designStatus === "preview_sent") {
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
        note: note || "แอดมิน mark ว่าส่งแบบให้ลูกค้าตรวจแล้ว",
      });
    }

    if (lead.conversation_id) {
      await supabase
        .from("conversations")
        .update({ state: "ON_HOLD_CUSTOMER_INPUT" })
        .eq("id", lead.conversation_id);
    }

    await logHumanAction(supabase, {
      entityType: "lead",
      entityId: id,
      actionType: "lead.design_status_changed",
      actorLabel: "Admin",
      note: note || "แอดมิน mark ว่าส่งแบบให้ลูกค้าตรวจแล้ว",
      payload: { design_status: "preview_sent", job_id: job?.id ?? null },
    });

    return NextResponse.json({ success: true, designStatus: "preview_sent" });
  }

  if (body.designStatus === "revision_requested") {
    await supabase
      .from("leads")
      .update({
        design_status: "revision_requested",
        hold_reason: note || "ลูกค้าขอแก้แบบ",
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
        note: note || "ลูกค้าขอแก้แบบ",
      });
    }

    if (lead.conversation_id) {
      await supabase
        .from("conversations")
        .update({ state: "ON_HOLD_CUSTOMER_INPUT" })
        .eq("id", lead.conversation_id);
    }

    await logHumanAction(supabase, {
      entityType: "lead",
      entityId: id,
      actionType: "lead.design_status_changed",
      actorLabel: "Admin",
      note: note || "ลูกค้าขอแก้แบบ",
      payload: { design_status: "revision_requested", job_id: job?.id ?? null },
    });

    return NextResponse.json({ success: true, designStatus: "revision_requested" });
  }

  if (body.designStatus === "drafting" || body.designStatus === "not_started") {
    await supabase
      .from("leads")
      .update({
        design_status: body.designStatus,
        hold_reason: null,
        note_from_chat: note ? appendNote(lead.note_from_chat, note) : lead.note_from_chat,
      })
      .eq("id", id);

    if (job?.id) {
      await supabase
        .from("jobs")
        .update({ status: "IN_DESIGN", production_status: "queued" })
        .eq("id", job.id);

      await supabase.from("job_timeline").insert({
        job_id: job.id,
        status: "IN_DESIGN",
        note: note || (body.designStatus === "not_started" ? "รีเซ็ตกลับ not_started" : "รีเซ็ตกลับ drafting"),
      });
    }

    if (lead.conversation_id) {
      await supabase
        .from("conversations")
        .update({ state: "IN_DESIGN" })
        .eq("id", lead.conversation_id);
    }

    return NextResponse.json({ success: true, designStatus: body.designStatus });
  }

  await supabase
    .from("leads")
    .update({
      design_status: "approved",
      hold_reason: null,
      note_from_chat: note ? appendNote(lead.note_from_chat, note) : lead.note_from_chat,
    })
    .eq("id", id);

  if (job?.id && job.status === "ON_HOLD_CUSTOMER_INPUT") {
    await supabase
      .from("jobs")
      .update({ status: "IN_DESIGN", production_status: "queued" })
      .eq("id", job.id);

    await supabase.from("job_timeline").insert({
      job_id: job.id,
      status: "IN_DESIGN",
      note: note || "แอดมิน mark ว่าลูกค้าอนุมัติแบบแล้ว",
    });
  }

  if (lead.conversation_id && job?.status === "ON_HOLD_CUSTOMER_INPUT") {
    await supabase
      .from("conversations")
      .update({ state: "IN_DESIGN" })
      .eq("id", lead.conversation_id);
  }

  await logHumanAction(supabase, {
    entityType: "lead",
    entityId: id,
    actionType: "lead.design_status_changed",
    actorLabel: "Admin",
    note,
    payload: { design_status: body.designStatus ?? "approved", job_id: job?.id ?? null },
  });

  return NextResponse.json({ success: true, designStatus: "approved" });
}