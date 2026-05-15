import { NextRequest, NextResponse } from "next/server";

import { resolveAdminAccess } from "@/lib/admin-auth";
import { createPaymentSlipSignedUrl } from "@/lib/payment-slip-storage";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type SlipStatus = "pending" | "matched" | "rejected";

const ALLOWED_STATUSES: SlipStatus[] = ["pending", "matched", "rejected"];

export async function GET(request: NextRequest) {
  const authClient = await createClient();
  const { data: authData } = await authClient.auth.getClaims();
  const access = resolveAdminAccess(authData?.claims);
  if (!access.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!access.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const statusParam = (url.searchParams.get("status") || "pending").toLowerCase();
  const status = ALLOWED_STATUSES.includes(statusParam as SlipStatus)
    ? (statusParam as SlipStatus)
    : "pending";

  const supabase = createAdminClient();
  const { data: rows, error } = await supabase
    .from("payment_slips")
    .select(
      "id, quote_id, payment_id, storage_path, original_file_name, mime_type, file_size_bytes, uploader, status, note, matched_at, matched_by_email, rejected_at, rejected_reason, created_at"
    )
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const quoteIds = Array.from(new Set((rows ?? []).map((r) => r.quote_id)));
  let quoteIndex: Record<
    string,
    { total: number; payment_terms: string; payment_status: string; customer: string | null }
  > = {};
  if (quoteIds.length > 0) {
    const { data: quoteRows } = await supabase
      .from("quotes")
      .select("id, total, payment_terms, payment_status, leads(customers(display_name))")
      .in("id", quoteIds);
    type QuoteRow = {
      id: string;
      total: number | null;
      payment_terms: string;
      payment_status: string;
      leads:
        | { customers: { display_name: string | null } | { display_name: string | null }[] | null }
        | { customers: { display_name: string | null } | { display_name: string | null }[] | null }[]
        | null;
    };
    function firstCustomerName(row: QuoteRow): string | null {
      const leads = Array.isArray(row.leads) ? row.leads[0] : row.leads;
      const customers = leads?.customers;
      const customer = Array.isArray(customers) ? customers[0] : customers;
      return customer?.display_name ?? null;
    }
    quoteIndex = Object.fromEntries(
      ((quoteRows ?? []) as unknown as QuoteRow[]).map((q) => [
        q.id,
        {
          total: Number(q.total ?? 0),
          payment_terms: q.payment_terms,
          payment_status: q.payment_status,
          customer: firstCustomerName(q),
        },
      ])
    );
  }

  const items = await Promise.all(
    (rows ?? []).map(async (row) => ({
      id: row.id,
      quoteId: row.quote_id,
      paymentId: row.payment_id,
      uploader: row.uploader,
      status: row.status,
      mimeType: row.mime_type,
      sizeBytes: row.file_size_bytes,
      note: row.note,
      createdAt: row.created_at,
      matchedAt: row.matched_at,
      matchedByEmail: row.matched_by_email,
      rejectedAt: row.rejected_at,
      rejectedReason: row.rejected_reason,
      signedUrl: await createPaymentSlipSignedUrl(row.storage_path),
      quote: quoteIndex[row.quote_id] ?? null,
    }))
  );

  return NextResponse.json({ items });
}
