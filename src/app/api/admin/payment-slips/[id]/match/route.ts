import { NextRequest, NextResponse } from "next/server";

import { logHumanAction } from "@/lib/action-log";
import { resolveAdminAccess } from "@/lib/admin-auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type MatchBody = {
  paymentId?: string;
  note?: string | null;
};

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;

  let body: MatchBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const paymentId = (body.paymentId || "").trim();
  if (!paymentId) {
    return NextResponse.json(
      { error: "paymentId is required" },
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
    .select("id, quote_id, status, payment_id")
    .eq("id", id)
    .maybeSingle();

  if (slipError) {
    return NextResponse.json({ error: slipError.message }, { status: 500 });
  }
  if (!slip) {
    return NextResponse.json({ error: "Slip not found" }, { status: 404 });
  }
  if (slip.status === "matched") {
    return NextResponse.json(
      { error: "Slip already matched", paymentId: slip.payment_id },
      { status: 409 }
    );
  }
  if (slip.status === "rejected") {
    return NextResponse.json(
      { error: "Cannot match a rejected slip" },
      { status: 409 }
    );
  }

  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .select("id, order_id, status, commercial_orders!inner(quote_id)")
    .eq("id", paymentId)
    .maybeSingle();

  if (paymentError) {
    return NextResponse.json({ error: paymentError.message }, { status: 500 });
  }
  if (!payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  const linkedQuoteId =
    Array.isArray(payment.commercial_orders)
      ? (payment.commercial_orders as Array<{ quote_id: string }>)[0]?.quote_id
      : (payment.commercial_orders as { quote_id: string } | null)?.quote_id;

  if (linkedQuoteId !== slip.quote_id) {
    return NextResponse.json(
      {
        error: "PAYMENT_QUOTE_MISMATCH",
        detail: "The selected payment belongs to a different quote than this slip.",
      },
      { status: 422 }
    );
  }

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("payment_slips")
    .update({
      payment_id: paymentId,
      status: "matched",
      matched_at: now,
      matched_by_email: access.email ?? null,
      updated_at: now,
      note: body.note?.toString().trim().slice(0, 500) ?? undefined,
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  await logHumanAction(supabase, {
    entityType: "quote",
    entityId: slip.quote_id,
    actionType: "payment.slip_matched",
    actorId: access.email ?? undefined,
    actorLabel: access.email ?? "Admin",
    payload: {
      slip_id: id,
      payment_id: paymentId,
    },
  }).catch(() => null);

  return NextResponse.json({ success: true });
}
