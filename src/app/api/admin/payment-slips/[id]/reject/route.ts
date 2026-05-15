import { NextRequest, NextResponse } from "next/server";

import { logHumanAction } from "@/lib/action-log";
import { resolveAdminAccess } from "@/lib/admin-auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type RejectBody = {
  reason?: string;
};

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;

  let body: RejectBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const reason = (body.reason || "").trim();
  if (!reason) {
    return NextResponse.json(
      { error: "reason is required" },
      { status: 400 }
    );
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

  const supabase = createAdminClient();
  const { data: slip, error: slipError } = await supabase
    .from("payment_slips")
    .select("id, quote_id, status")
    .eq("id", id)
    .maybeSingle();

  if (slipError) {
    return NextResponse.json({ error: slipError.message }, { status: 500 });
  }
  if (!slip) {
    return NextResponse.json({ error: "Slip not found" }, { status: 404 });
  }
  if (slip.status !== "pending") {
    return NextResponse.json(
      { error: `Cannot reject a ${slip.status} slip` },
      { status: 409 }
    );
  }

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("payment_slips")
    .update({
      status: "rejected",
      rejected_at: now,
      rejected_reason: reason.slice(0, 500),
      updated_at: now,
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  await logHumanAction(supabase, {
    entityType: "quote",
    entityId: slip.quote_id,
    actionType: "payment.slip_rejected",
    actorId: access.email ?? undefined,
    actorLabel: access.email ?? "Admin",
    payload: {
      slip_id: id,
      reason,
    },
  }).catch(() => null);

  return NextResponse.json({ success: true });
}
