import { NextRequest, NextResponse } from "next/server";

import { resolveAdminAccess } from "@/lib/admin-auth";
import { getQuoteOutstandingBalance } from "@/lib/quote-balance";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  if (!id) {
    return NextResponse.json({ error: "Missing quote id" }, { status: 400 });
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
  const breakdown = await getQuoteOutstandingBalance(supabase, id);
  if (!breakdown) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  return NextResponse.json({
    quoteId: id,
    total: breakdown.total,
    paid: breakdown.paid,
    cashReceived: breakdown.cashReceived,
    whtWithheld: breakdown.whtWithheld,
    outstanding: breakdown.outstanding,
    paymentCount: breakdown.paymentCount,
    whtRate: breakdown.whtRate,
  });
}
