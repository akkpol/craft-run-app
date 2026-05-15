import { NextRequest, NextResponse } from "next/server";

import { logHumanAction, logSystemAction } from "@/lib/action-log";
import { resolveAdminAccess } from "@/lib/admin-auth";
import {
  deletePickupProofFile,
  isAllowedPickupProofMime,
  PICKUP_PROOF_MAX_BYTES,
  uploadPickupProofFile,
} from "@/lib/pickup-proof-storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type PickupProofRpcRow = {
  id?: string | null;
  fulfillment_mode?: string | null;
  fulfillment_status?: string | null;
  picked_up_at?: string | null;
  photo_count?: number | string | null;
  recipient_name?: string | null;
  auto_transition?: boolean | null;
};

function getPickupRpcRow(data: unknown): PickupProofRpcRow | null {
  if (Array.isArray(data)) {
    return (data[0] as PickupProofRpcRow | undefined) || null;
  }
  if (data && typeof data === "object") {
    return data as PickupProofRpcRow;
  }
  return null;
}

const PG_ERROR_CODE_TO_API: Record<string, { status: number; error: string; detail: string }> = {
  P0001: { status: 404, error: "JOB_NOT_FOUND", detail: "Job not found." },
  P0002: {
    status: 409,
    error: "NOT_PICKUP_MODE",
    detail: "This job is not flagged as pickup. Use the install or delivery endpoint instead.",
  },
  P0003: {
    status: 409,
    error: "FULFILLMENT_ALREADY_CLOSED",
    detail: "Fulfillment is already marked picked_up or delivered; no further uploads accepted.",
  },
  P0004: {
    status: 422,
    error: "RECIPIENT_NAME_REQUIRED",
    detail: "Mark-done requires the recipient name for legal proof of handoff.",
  },
  P0005: {
    status: 409,
    error: "JOB_NOT_READY_FOR_PICKUP",
    detail: "Production is not finished. Mark the job ready_for_fulfillment before closing pickup.",
  },
};

/**
 * Admin records a pickup handoff.
 *
 * Pickup happens at the shop counter so no public token — admin is logged
 * in and uploads photo(s) of the customer collecting the goods + types the
 * recipient name. The RPC appends the photo atomically and, when
 * `markDone=true`, flips jobs.fulfillment_status='picked_up' in the same
 * transaction. The auto-transition is logged via logSystemAction so audit
 * filters that separate human vs system actions classify it correctly
 * (L23 from docs/CLAUDE_LESSONS.md).
 */
export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const { id: jobId } = await props.params;
  if (!jobId) {
    return NextResponse.json({ error: "Invalid job id" }, { status: 400 });
  }

  const authClient = await createClient();
  const { data: authData } = await authClient.auth.getClaims();
  const access = resolveAdminAccess(authData?.claims);
  if (!access.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!access.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  const markDoneRaw = formData.get("markDone");
  const markDone =
    markDoneRaw === "1" || markDoneRaw === "true" || markDoneRaw === "yes";
  const recipientNameRaw = formData.get("recipientName");
  const recipientName =
    typeof recipientNameRaw === "string" && recipientNameRaw.trim().length > 0
      ? recipientNameRaw.trim().slice(0, 200)
      : null;
  const recipientPhoneRaw = formData.get("recipientPhone");
  const recipientPhone =
    typeof recipientPhoneRaw === "string" && recipientPhoneRaw.trim().length > 0
      ? recipientPhoneRaw.trim().slice(0, 50)
      : null;
  const noteRaw = formData.get("note");
  const note =
    typeof noteRaw === "string" && noteRaw.trim().length > 0
      ? noteRaw.trim().slice(0, 500)
      : null;

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }
  if (file.size <= 0 || file.size > PICKUP_PROOF_MAX_BYTES) {
    return NextResponse.json(
      { error: "File size out of range" },
      { status: 400 }
    );
  }
  if (!isAllowedPickupProofMime(file.type || "")) {
    return NextResponse.json(
      { error: "Unsupported file type" },
      { status: 400 }
    );
  }

  // Pre-flight guards before storage upload — saves an orphan when the
  // caller posts to the wrong endpoint or to a job in the wrong mode.
  const supabase = createAdminClient();
  const { data: jobRow, error: jobErr } = await supabase
    .from("jobs")
    .select("id, lead_id, fulfillment_status, leads(fulfillment_mode)")
    .eq("id", jobId)
    .maybeSingle();
  if (jobErr) {
    return NextResponse.json(
      { error: jobErr.message || "Failed to read job" },
      { status: 500 }
    );
  }
  if (!jobRow) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  const lead = Array.isArray(jobRow.leads) ? jobRow.leads[0] : jobRow.leads;
  if (lead?.fulfillment_mode !== "pickup") {
    return NextResponse.json(
      {
        error: "NOT_PICKUP_MODE",
        detail: "This job is not flagged as pickup; use the matching endpoint for its mode.",
      },
      { status: 409 }
    );
  }
  if (
    jobRow.fulfillment_status === "picked_up" ||
    jobRow.fulfillment_status === "delivered"
  ) {
    return NextResponse.json(
      {
        error: "FULFILLMENT_ALREADY_CLOSED",
        detail: `Fulfillment is already ${jobRow.fulfillment_status}; no further uploads accepted.`,
      },
      { status: 409 }
    );
  }

  // Upload first, then DB write. Same pattern as install-proof: if the DB
  // write fails the orphan is deleted (L17 cleanup-on-fail).
  let uploadResult;
  try {
    uploadResult = await uploadPickupProofFile(jobId, file);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }

  const { data: rpcData, error: rpcErr } = await supabase.rpc(
    "record_pickup_proof",
    {
      p_job_id: jobId,
      p_storage_path: uploadResult.storagePath,
      p_recipient_name: recipientName,
      p_recipient_phone: recipientPhone,
      p_mark_done: markDone,
      p_picked_up_at: new Date().toISOString(),
    }
  );

  if (rpcErr) {
    await deletePickupProofFile(uploadResult.storagePath).catch(() => null);
    const mapped = rpcErr.code ? PG_ERROR_CODE_TO_API[rpcErr.code] : null;
    if (mapped) {
      return NextResponse.json(
        { error: mapped.error, detail: mapped.detail },
        { status: mapped.status }
      );
    }
    return NextResponse.json({ error: rpcErr.message }, { status: 500 });
  }

  const updated = getPickupRpcRow(rpcData);
  if (!updated) {
    await deletePickupProofFile(uploadResult.storagePath).catch(() => null);
    return NextResponse.json(
      {
        error: "FULFILLMENT_ALREADY_CLOSED",
        detail: "Pickup status changed mid-upload",
      },
      { status: 409 }
    );
  }

  // Human action — admin clicked. Captures who, what photo, and (if any)
  // the recipient name typed at handoff.
  await logHumanAction(supabase, {
    entityType: "job",
    entityId: jobId,
    actionType: markDone ? "pickup.completed" : "pickup.proof_uploaded",
    actorId: access.email ?? undefined,
    actorLabel: access.email ?? "Admin",
    note: note ?? undefined,
    payload: {
      storage_path: uploadResult.storagePath,
      mark_done: markDone,
      photo_count: Number(updated.photo_count ?? 0),
      recipient_name: updated.recipient_name ?? null,
      fulfillment_status: updated.fulfillment_status ?? null,
    },
  }).catch(() => null);

  // System action — the RPC auto-flipped fulfillment_status to picked_up
  // as a side-effect. Logged separately with actor_type=system so audit
  // dashboards don't misclassify the transition as a human action
  // (L23 from docs/CLAUDE_LESSONS.md).
  if (updated.auto_transition && updated.fulfillment_status === "picked_up") {
    await logSystemAction(supabase, {
      serviceName: "fulfillment-auto-transition",
      entityType: "job",
      entityId: jobId,
      actionType: "job.fulfillment_auto_picked_up",
      payload: {
        trigger: "pickup.completed",
        recipient_name: updated.recipient_name ?? null,
      },
    }).catch(() => null);
  }

  return NextResponse.json({
    success: true,
    fulfillmentStatus: updated.fulfillment_status ?? null,
    pickedUpAt: updated.picked_up_at ?? null,
    photoCount: Number(updated.photo_count ?? 0),
    recipientName: updated.recipient_name ?? null,
    autoTransition: Boolean(updated.auto_transition),
  });
}
