import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyLiffIdToken } from "@/lib/line";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const liffIdToken = searchParams.get("liffIdToken")?.trim() || "";
  const devLineUserId = searchParams.get("lineUserId")?.trim() || "";

  let lineUserId: string;

  if (liffIdToken) {
    try {
      const identity = await verifyLiffIdToken(liffIdToken);
      lineUserId = identity.userId;
    } catch {
      return NextResponse.json(
        { error: "Invalid LIFF token" },
        { status: 401 }
      );
    }
  } else if (process.env.NODE_ENV !== "production" && devLineUserId) {
    lineUserId = devLineUserId;
  } else {
    return NextResponse.json(
      { error: "LINE identity required" },
      { status: 401 }
    );
  }

  const supabase = createAdminClient();

  const { data: customer } = await supabase
    .from("customers")
    .select("id, phone, display_name")
    .eq("line_user_id", lineUserId)
    .maybeSingle();

  if (!customer) {
    return NextResponse.json({
      phone: null,
      recentProductTypes: [],
      lastValues: null,
    });
  }

  // Fetch the 10 most recent leads for this customer to infer defaults
  const { data: leads } = await supabase
    .from("leads")
    .select("product_type, width_mm, height_mm, qty")
    .eq("customer_id", customer.id)
    .order("created_at", { ascending: false })
    .limit(10);

  // Deduplicate product types by frequency (most used first)
  const typeCounts: Record<string, number> = {};
  for (const lead of leads ?? []) {
    if (lead.product_type) {
      typeCounts[lead.product_type] = (typeCounts[lead.product_type] ?? 0) + 1;
    }
  }
  const recentProductTypes = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([type]) => type);

  // Last values from the most recent lead
  const lastLead = leads?.[0] ?? null;
  const lastValues = lastLead
    ? {
        widthMm: lastLead.width_mm ?? null,
        heightMm: lastLead.height_mm ?? null,
        qty: lastLead.qty ?? null,
      }
    : null;

  return NextResponse.json({
    phone: customer.phone ?? null,
    recentProductTypes,
    lastValues,
  });
}
