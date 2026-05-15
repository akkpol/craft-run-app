import { NextRequest, NextResponse } from "next/server";

import { logHumanAction } from "@/lib/action-log";
import { resolveAdminAccess } from "@/lib/admin-auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ALLOWED_PROVIDERS = [
  "lalamove",
  "grab",
  "kerry",
  "flash",
  "thaipost",
  "inhouse",
  "other",
] as const;

type DeliveryProvider = (typeof ALLOWED_PROVIDERS)[number];

type DeliveryBody = {
  provider?: string | null;
  trackingUrl?: string | null;
  trackingNumber?: string | null;
  dispatchedAt?: string | null;
  notes?: string | null;
};

function sanitizeText(value: unknown, max = 500): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function sanitizeUrl(value: unknown): string | null {
  const text = sanitizeText(value, 2000);
  if (!text) return null;
  try {
    const parsed = new URL(text);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const { id: jobId } = await props.params;

  let body: DeliveryBody;
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

  let provider: DeliveryProvider | null = null;
  if (body.provider !== undefined && body.provider !== null && body.provider !== "") {
    if (!ALLOWED_PROVIDERS.includes(body.provider as DeliveryProvider)) {
      return NextResponse.json(
        {
          error: "DELIVERY_PROVIDER_INVALID",
          detail: `provider must be one of: ${ALLOWED_PROVIDERS.join(", ")}`,
        },
        { status: 400 }
      );
    }
    provider = body.provider as DeliveryProvider;
  }

  let trackingUrl: string | null = null;
  if (body.trackingUrl !== undefined && body.trackingUrl !== null && body.trackingUrl !== "") {
    trackingUrl = sanitizeUrl(body.trackingUrl);
    if (!trackingUrl) {
      return NextResponse.json(
        {
          error: "DELIVERY_TRACKING_URL_INVALID",
          detail: "trackingUrl must be an http(s) URL.",
        },
        { status: 400 }
      );
    }
  }

  let dispatchedAtIso: string | null = null;
  if (
    body.dispatchedAt !== undefined &&
    body.dispatchedAt !== null &&
    body.dispatchedAt !== ""
  ) {
    const parsed = new Date(body.dispatchedAt);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json(
        { error: "DELIVERY_DISPATCHED_AT_INVALID" },
        { status: 400 }
      );
    }
    dispatchedAtIso = parsed.toISOString();
  }

  const supabase = createAdminClient();
  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("id, leads!inner(fulfillment_mode)")
    .eq("id", jobId)
    .maybeSingle();
  if (jobError) {
    return NextResponse.json({ error: jobError.message }, { status: 500 });
  }
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  const lead = Array.isArray(job.leads) ? job.leads[0] : job.leads;
  if (lead?.fulfillment_mode !== "delivery") {
    return NextResponse.json(
      {
        error: "JOB_NOT_DELIVERY_MODE",
        detail: "Only jobs with fulfillment_mode=delivery can record delivery tracking.",
      },
      { status: 409 }
    );
  }

  const { error: updateError } = await supabase
    .from("jobs")
    .update({
      delivery_provider: provider,
      delivery_tracking_url: trackingUrl,
      delivery_tracking_number: sanitizeText(body.trackingNumber, 200),
      delivery_dispatched_at: dispatchedAtIso,
      delivery_notes: sanitizeText(body.notes, 1000),
    })
    .eq("id", jobId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  await logHumanAction(supabase, {
    entityType: "job",
    entityId: jobId,
    actionType: "delivery.tracking_updated",
    actorId: access.email ?? undefined,
    actorLabel: access.email ?? "Admin",
    payload: {
      provider,
      tracking_url: trackingUrl,
      tracking_number: sanitizeText(body.trackingNumber, 200),
      dispatched_at: dispatchedAtIso,
    },
  }).catch(() => null);

  return NextResponse.json({ success: true });
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
  const { data, error } = await supabase
    .from("jobs")
    .select(
      "id, delivery_provider, delivery_tracking_url, delivery_tracking_number, delivery_dispatched_at, delivery_notes"
    )
    .eq("id", jobId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  return NextResponse.json({ delivery: data });
}
