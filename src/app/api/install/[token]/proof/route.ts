import { NextRequest, NextResponse } from "next/server";

import { logHumanAction } from "@/lib/action-log";
import {
  INSTALL_PROOF_MAX_BYTES,
  isAllowedInstallProofMime,
  uploadInstallProofFile,
} from "@/lib/install-proof-storage";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * On-site install team posts a photo here. Public token auth — no login.
 * Append-only: each call adds to photo_proof_paths and may mark the row
 * status='done' if body.markDone === true.
 *
 * Server-side state gate (L10): refuses uploads when status is already
 * 'done' or 'cancelled' so a stale shared link can't pollute completed
 * installations.
 */
export async function POST(
  request: NextRequest,
  props: { params: Promise<{ token: string }> }
) {
  const { token } = await props.params;
  if (!token || token.length < 8) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
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
  const noteRaw = formData.get("note");
  const note =
    typeof noteRaw === "string" && noteRaw.trim().length > 0
      ? noteRaw.trim().slice(0, 500)
      : null;

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }
  if (file.size <= 0 || file.size > INSTALL_PROOF_MAX_BYTES) {
    return NextResponse.json(
      { error: "File size out of range" },
      { status: 400 }
    );
  }
  if (!isAllowedInstallProofMime(file.type || "")) {
    return NextResponse.json(
      { error: "Unsupported file type" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { data: install, error: installError } = await supabase
    .from("installations")
    .select("id, public_token, status, photo_proof_paths, job_id, quote_id")
    .eq("public_token", token)
    .maybeSingle();
  if (installError) {
    return NextResponse.json(
      { error: installError.message || "Failed to read installation" },
      { status: 500 }
    );
  }
  if (!install) {
    return NextResponse.json({ error: "Installation not found" }, { status: 404 });
  }
  if (install.status === "done" || install.status === "cancelled") {
    return NextResponse.json(
      {
        error: "INSTALLATION_NOT_OPEN",
        detail: `Installation is already ${install.status}; no further uploads accepted.`,
      },
      { status: 409 }
    );
  }

  let uploadResult;
  try {
    uploadResult = await uploadInstallProofFile(install.id, file);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }

  // Race-safe append: filter by current photo_proof_paths length is not
  // possible; rely on the fact that array_append is associative. Use the
  // status filter for the markDone branch (L9).
  const nextPaths = [...(install.photo_proof_paths ?? []), uploadResult.storagePath];

  const updatePayload: Record<string, unknown> = {
    photo_proof_paths: nextPaths,
    updated_at: new Date().toISOString(),
  };
  if (markDone) {
    updatePayload.status = "done";
    updatePayload.completed_at = new Date().toISOString();
  }

  const updateQuery = supabase
    .from("installations")
    .update(updatePayload)
    .eq("id", install.id);

  // L9: when transitioning status, scope the update to the expected
  // current value so two concurrent submissions don't overwrite each other.
  const { data: updated, error: updateError } = markDone
    ? await updateQuery
        .in("status", ["scheduled", "in_progress"])
        .select("id, status")
        .maybeSingle()
    : await updateQuery.select("id, status").maybeSingle();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }
  if (!updated) {
    return NextResponse.json(
      { error: "INSTALLATION_NOT_OPEN", detail: "Installation status changed mid-upload" },
      { status: 409 }
    );
  }

  await logHumanAction(supabase, {
    entityType: "job",
    entityId: install.job_id,
    actionType: markDone ? "installation.completed" : "installation.proof_uploaded",
    actorLabel: "InstallTeam",
    note: note ?? undefined,
    payload: {
      installation_id: install.id,
      storage_path: uploadResult.storagePath,
      mark_done: markDone,
      photo_count: nextPaths.length,
    },
  }).catch(() => null);

  return NextResponse.json({
    success: true,
    status: updated.status,
    photoCount: nextPaths.length,
  });
}
