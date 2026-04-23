import { NextRequest, NextResponse } from "next/server";
import { approveQuote } from "@/lib/quote-workflow";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  designStatusNeedsCustomerResponse,
  isDesignStatus,
} from "@/lib/types";
import { logHumanAction } from "@/lib/action-log";

type PublicQuoteAction =
  | "approve_quote"
  | "reject_quote"
  | "rescope_quote"
  | "resolve_hold"
  | "approve_design"
  | "request_design_revision";

function appendCustomerNote(existing: string | null | undefined, note: string) {
  return existing?.trim() ? `${existing.trim()}\n${note}` : note;
}

function getSupabaseHost() {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "").host || "unknown";
  } catch {
    return "invalid";
  }
}

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ token: string }> }
) {
  const { token } = await props.params;

  let body: { action?: PublicQuoteAction; note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.action) {
    return NextResponse.json({ error: "Action is required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: quote, error } = await supabase
    .from("quotes")
    .select(
      "id, lead_id, status, public_token, payment_terms, payment_status, leads(id, conversation_id, design_status, hold_reason, human_review_reason, note_from_chat, ai_generated_images), jobs(id, status)"
    )
    .eq("public_token", token)
    .single();

  if (error || !quote) {
    console.error("Public quote action lookup failed:", {
      path: request.nextUrl.pathname,
      origin: request.nextUrl.origin,
      host: request.headers.get("host"),
      supabaseHost: getSupabaseHost(),
      tokenPrefix: token.slice(0, 8),
      action: body.action,
      quoteError: error
        ? {
            code: error.code,
            message: error.message,
            details: error.details,
          }
        : null,
    });
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  const lead = Array.isArray(quote.leads) ? quote.leads[0] : quote.leads;
  const job = Array.isArray(quote.jobs) ? quote.jobs[0] : quote.jobs;
  const note = body.note?.trim();

  if (!lead) {
    console.error("Public quote action missing lead relation:", {
      path: request.nextUrl.pathname,
      origin: request.nextUrl.origin,
      host: request.headers.get("host"),
      supabaseHost: getSupabaseHost(),
      tokenPrefix: token.slice(0, 8),
      action: body.action,
      quoteId: quote.id,
      quoteLeadId: quote.lead_id,
      hasJobs: Boolean(job?.id),
    });
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  switch (body.action) {
    case "approve_quote": {
      if (quote.status !== "sent" && quote.status !== "approved") {
        return NextResponse.json(
          { error: "Quote is not available for approval" },
          { status: 400 }
        );
      }

      try {
        const result = await approveQuote(supabase, {
          ...quote,
          leads: { conversation_id: lead.conversation_id },
          jobs: Array.isArray(quote.jobs) ? quote.jobs : quote.jobs ? [quote.jobs] : [],
        });
        return NextResponse.json(result);
      } catch {
        return NextResponse.json(
          { error: "Failed to approve quote" },
          { status: 500 }
        );
      }
    }

    case "reject_quote": {
      if (quote.status !== "sent") {
        return NextResponse.json(
          { error: "Quote is not available for rejection" },
          { status: 400 }
        );
      }

      if (job?.id) {
        return NextResponse.json(
          { error: "Cannot reject a quote after production has started" },
          { status: 400 }
        );
      }

      await supabase
        .from("quotes")
        .update({ status: "rejected" })
        .eq("id", quote.id);

      await supabase
        .from("leads")
        .update({
          status: "cancelled",
          hold_reason: null,
          human_review_reason: null,
        })
        .eq("id", lead.id);

      if (lead.conversation_id) {
        await supabase
          .from("conversations")
          .update({ state: "CANCELLED" })
          .eq("id", lead.conversation_id);
      }

      await logHumanAction(supabase, {
        entityType: "quote",
        entityId: quote.id,
        actionType: "quote.rejected",
        actorLabel: "Customer",
        note: note || "ปฏิเสธใบเสนอราคา",
        payload: { lead_id: lead.id, to_state: "CANCELLED" },
      });

      return NextResponse.json({
        success: true,
        message: note || "ปฏิเสธใบเสนอราคาเรียบร้อยแล้ว",
      });
    }

    case "rescope_quote": {
      if (quote.status !== "sent" && quote.status !== "approved") {
        return NextResponse.json(
          { error: "Quote is not available for re-scope" },
          { status: 400 }
        );
      }

      if (job?.id) {
        return NextResponse.json(
          { error: "Cannot re-scope after the job has been created" },
          { status: 400 }
        );
      }

      const rescopeNote = note || "ลูกค้าขอปรับรายละเอียดก่อนออกใบเสนอราคาใหม่";

      await supabase
        .from("quotes")
        .update({ status: "rejected" })
        .eq("id", quote.id);

      await supabase
        .from("leads")
        .update({
          status: "new",
          hold_reason: rescopeNote,
          human_review_reason: null,
          design_status: "not_started",
          note_from_chat: appendCustomerNote(lead.note_from_chat, rescopeNote),
        })
        .eq("id", lead.id);

      if (lead.conversation_id) {
        await supabase
          .from("conversations")
          .update({ state: "REQUIREMENTS_REVIEW" })
          .eq("id", lead.conversation_id);
      }

      await logHumanAction(supabase, {
        entityType: "quote",
        entityId: quote.id,
        actionType: "quote.rejected",
        actorLabel: "Customer",
        note: rescopeNote,
        payload: { lead_id: lead.id, reason: "rescope", to_state: "REQUIREMENTS_REVIEW" },
      });

      return NextResponse.json({
        success: true,
        message: "รับคำขอปรับรายละเอียดแล้ว ทีมงานจะออกใบเสนอราคาใหม่ให้",
      });
    }

    case "resolve_hold": {
      const resolutionNote = note || "ลูกค้าแจ้งว่าส่งข้อมูลเพิ่มเติมแล้ว";

      await supabase
        .from("leads")
        .update({
          hold_reason: null,
          note_from_chat: appendCustomerNote(lead.note_from_chat, resolutionNote),
        })
        .eq("id", lead.id);

      if (job?.id) {
        await supabase
          .from("jobs")
          .update({ status: "IN_DESIGN", production_status: "queued" })
          .eq("id", job.id);

        await supabase.from("job_timeline").insert({
          job_id: job.id,
          status: "IN_DESIGN",
          note: resolutionNote,
        });
      }

      if (lead.conversation_id) {
        await supabase
          .from("conversations")
          .update({ state: job?.id ? "IN_DESIGN" : "REQUIREMENTS_REVIEW" })
          .eq("id", lead.conversation_id);
      }

      return NextResponse.json({
        success: true,
        message: "ทีมงานได้รับข้อมูลเพิ่มแล้วและจะดำเนินงานต่อ",
      });
    }

    case "approve_design": {
      if (!isDesignStatus(lead.design_status || "")) {
        return NextResponse.json(
          { error: "Design status is not available" },
          { status: 400 }
        );
      }

      if (!designStatusNeedsCustomerResponse(lead.design_status)) {
        return NextResponse.json(
          { error: "Design is not waiting for customer approval" },
          { status: 400 }
        );
      }

      await supabase
        .from("leads")
        .update({
          design_status: "approved",
          hold_reason: null,
          note_from_chat: note
            ? appendCustomerNote(lead.note_from_chat, `อนุมัติแบบ: ${note}`)
            : lead.note_from_chat,
        })
        .eq("id", lead.id);

      if (job?.id && job.status === "ON_HOLD_CUSTOMER_INPUT") {
        await supabase
          .from("jobs")
          .update({ status: "IN_DESIGN", production_status: "queued" })
          .eq("id", job.id);

        await supabase.from("job_timeline").insert({
          job_id: job.id,
          status: "IN_DESIGN",
          note: note || "ลูกค้าอนุมัติแบบแล้ว",
        });
      }

      if (lead.conversation_id) {
        // Per policy preJobDesignApprovalFallbackState: if no active job, resume
        // to REQUIREMENTS_REVIEW. If job is ON_HOLD_CUSTOMER_INPUT, advance to IN_DESIGN.
        const nextConvState =
          job?.id && job.status === "ON_HOLD_CUSTOMER_INPUT"
            ? "IN_DESIGN"
            : "REQUIREMENTS_REVIEW";
        await supabase
          .from("conversations")
          .update({ state: nextConvState })
          .eq("id", lead.conversation_id);
      }

      await logHumanAction(supabase, {
        entityType: "lead",
        entityId: lead.id,
        actionType: "lead.design_status_changed",
        actorLabel: "Customer",
        note: note || "ลูกค้าอนุมัติแบบแล้ว",
        payload: { design_status: "approved", job_id: job?.id ?? null },
      });

      return NextResponse.json({
        success: true,
        message: "รับการอนุมัติแบบเรียบร้อยแล้ว",
      });
    }

    case "request_design_revision": {
      if (!isDesignStatus(lead.design_status || "")) {
        return NextResponse.json(
          { error: "Design status is not available" },
          { status: 400 }
        );
      }

      if (!designStatusNeedsCustomerResponse(lead.design_status)) {
        return NextResponse.json(
          { error: "Design is not waiting for customer feedback" },
          { status: 400 }
        );
      }

      const revisionNote = note || "ลูกค้าขอแก้แบบเพิ่มเติม";

      await supabase
        .from("leads")
        .update({
          design_status: "revision_requested",
          hold_reason: revisionNote,
          note_from_chat: appendCustomerNote(lead.note_from_chat, revisionNote),
        })
        .eq("id", lead.id);

      if (job?.id && job.status !== "ON_HOLD_CUSTOMER_INPUT") {
        await supabase
          .from("jobs")
          .update({ status: "ON_HOLD_CUSTOMER_INPUT", production_status: "queued" })
          .eq("id", job.id);

        await supabase.from("job_timeline").insert({
          job_id: job.id,
          status: "ON_HOLD_CUSTOMER_INPUT",
          note: revisionNote,
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
        entityId: lead.id,
        actionType: "lead.design_status_changed",
        actorLabel: "Customer",
        note: revisionNote,
        payload: { design_status: "revision_requested", job_id: job?.id ?? null },
      });

      return NextResponse.json({
        success: true,
        message: "รับคำขอแก้แบบแล้ว ทีมงานจะกลับมาพร้อมแบบรอบถัดไป",
      });
    }

    default:
      return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  }
}