import { NextRequest, NextResponse } from "next/server";
import { logSystemAction } from "@/lib/action-log";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyLiffIdToken } from "@/lib/line";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const liffIdToken = searchParams.get("liffIdToken")?.trim() || "";
  const devLineUserId = searchParams.get("lineUserId")?.trim() || "";
  const liffDebugFingerprint =
    request.headers.get("x-liff-debug-fingerprint")?.trim() || null;

  let lineUserId: string;

  if (liffIdToken) {
    try {
      const identity = await verifyLiffIdToken(liffIdToken);
      lineUserId = identity.userId;
    } catch (error) {
      const supabase = createAdminClient();
      await logSystemAction(supabase, {
        entityType: "system",
        actionType: "liff.prefill_issue",
        serviceName: "customer-prefill",
        note: "LIFF prefill token verification failed",
        payload: {
          fingerprint: liffDebugFingerprint,
          stage: "prefill_verify_token_failed",
          message: error instanceof Error ? error.message : String(error),
          hasLiffToken: true,
          searchParamKeys: ["liffIdToken"],
          userAgent: request.headers.get("user-agent"),
        },
      });
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
    .select(
      "product_type, width_mm, height_mm, qty, requested_document_type, requested_document_types, billing_entity_type, billing_branch_type, billing_branch_code, billing_name, tax_id, billing_address, fulfillment_mode, fulfillment_address_line1, fulfillment_address_line2, fulfillment_subdistrict, fulfillment_district, fulfillment_province, fulfillment_postal_code, fulfillment_latitude, fulfillment_longitude"
    )
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
        requestedDocumentType: lastLead.requested_document_type ?? null,
        requestedDocumentTypes:
          lastLead.requested_document_types ??
          (lastLead.requested_document_type
            ? [lastLead.requested_document_type]
            : null),
        billingEntityType: lastLead.billing_entity_type ?? null,
        billingBranchType: lastLead.billing_branch_type ?? null,
        billingBranchCode: lastLead.billing_branch_code ?? null,
        billingName: lastLead.billing_name ?? null,
        taxId: lastLead.tax_id ?? null,
        billingAddress: lastLead.billing_address ?? null,
        fulfillmentMode: lastLead.fulfillment_mode ?? null,
        fulfillmentAddressLine1: lastLead.fulfillment_address_line1 ?? null,
        fulfillmentAddressLine2: lastLead.fulfillment_address_line2 ?? null,
        fulfillmentSubdistrict: lastLead.fulfillment_subdistrict ?? null,
        fulfillmentDistrict: lastLead.fulfillment_district ?? null,
        fulfillmentProvince: lastLead.fulfillment_province ?? null,
        fulfillmentPostalCode: lastLead.fulfillment_postal_code ?? null,
        fulfillmentLatitude: lastLead.fulfillment_latitude ?? null,
        fulfillmentLongitude: lastLead.fulfillment_longitude ?? null,
      }
    : null;

  return NextResponse.json({
    phone: customer.phone ?? null,
    recentProductTypes,
    lastValues,
  });
}
