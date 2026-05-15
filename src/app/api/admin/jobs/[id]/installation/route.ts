import { NextRequest, NextResponse } from "next/server";

import { logHumanAction } from "@/lib/action-log";
import { resolveAdminAccess } from "@/lib/admin-auth";
import { createInstallProofSignedUrl } from "@/lib/install-proof-storage";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type ScheduleBody = {
  scheduledAt?: string | null;
  installTeam?: string | null;
  onSiteAddress?: string | null;
  onSiteContactName?: string | null;
  onSiteContactPhone?: string | null;
  notes?: string | null;
};

function sanitizeText(value: unknown, max = 500): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

/**
 * Upsert an installation row for a job. Idempotent — calling multiple times
 * with new fields overwrites the schedule but preserves photo_proof_paths
 * and completion state (those are managed via the public token route).
 */
export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const { id: jobId } = await props.params;

  let body: ScheduleBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
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

  let scheduledAtIso: string | null = null;
  if (body.scheduledAt !== undefined && body.scheduledAt !== null && body.scheduledAt !== "") {
    const parsed = new Date(body.scheduledAt);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json(
        { error: "INVALID_SCHEDULED_AT", detail: "scheduledAt must be a valid ISO date" },
        { status: 400 }
      );
    }
    scheduledAtIso = parsed.toISOString();
  }

  const supabase = createAdminClient();

  // Verify job exists + is an install-mode job.
  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("id, quote_id, leads!inner(fulfillment_mode)")
    .eq("id", jobId)
    .maybeSingle();
  if (jobError) {
    return NextResponse.json({ error: jobError.message }, { status: 500 });
  }
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  const lead = Array.isArray(job.leads) ? job.leads[0] : job.leads;
  if (lead?.fulfillment_mode !== "install") {
    return NextResponse.json(
      {
        error: "JOB_NOT_INSTALL_MODE",
        detail: "Only jobs with fulfillment_mode=install can have an installation row.",
      },
      { status: 409 }
    );
  }
  if (!job.quote_id) {
    return NextResponse.json(
      { error: "Job has no quote_id; cannot create installation." },
      { status: 422 }
    );
  }

  // Upsert.
  const upsertPayload = {
    job_id: jobId,
    quote_id: job.quote_id,
    scheduled_at: scheduledAtIso,
    install_team: sanitizeText(body.installTeam, 200),
    on_site_address: sanitizeText(body.onSiteAddress, 1000),
    on_site_contact_name: sanitizeText(body.onSiteContactName, 200),
    on_site_contact_phone: sanitizeText(body.onSiteContactPhone, 50),
    notes: sanitizeText(body.notes, 1000),
    updated_at: new Date().toISOString(),
  };

  const { data: upserted, error: upsertError } = await supabase
    .from("installations")
    .upsert(upsertPayload, { onConflict: "job_id" })
    .select(
      "id, public_token, scheduled_at, install_team, on_site_address, on_site_contact_name, on_site_contact_phone, notes, status, photo_proof_paths, completed_at, completed_by_email"
    )
    .single();

  if (upsertError || !upserted) {
    return NextResponse.json(
      { error: upsertError?.message || "Failed to upsert installation" },
      { status: 500 }
    );
  }

  await logHumanAction(supabase, {
    entityType: "job",
    entityId: jobId,
    actionType: "installation.scheduled",
    actorId: access.email ?? undefined,
    actorLabel: access.email ?? "Admin",
    payload: {
      installation_id: upserted.id,
      scheduled_at: upserted.scheduled_at,
      install_team: upserted.install_team,
    },
  }).catch(() => null);

  return NextResponse.json({ success: true, installation: upserted });
}

export async function GET(
  _request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const { id: jobId } = await props.params;

  const authClient = await createClient();
  const { data: authData } = await authClient.auth.getClaims();
  const access = resolveAdminAccess(authData?.claims);
  if (!access.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!access.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createAdminClient();
  const { data: row, error } = await supabase
    .from("installations")
    .select(
      "id, job_id, quote_id, public_token, scheduled_at, install_team, on_site_address, on_site_contact_name, on_site_contact_phone, notes, status, photo_proof_paths, completed_at, completed_by_email, created_at, updated_at"
    )
    .eq("job_id", jobId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ installation: null });
  }

  const photoUrls = await Promise.all(
    ((row.photo_proof_paths ?? []) as string[]).map((path: string) =>
      createInstallProofSignedUrl(path)
    )
  );

  return NextResponse.json({
    installation: { ...row, photoSignedUrls: photoUrls },
  });
}
