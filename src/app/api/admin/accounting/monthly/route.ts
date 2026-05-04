import { NextRequest, NextResponse } from "next/server";

import {
  buildMonthlyAccountingCsv,
  getAccountingMonthRange,
} from "@/lib/quote-payment-records";
import { resolveAdminAccess } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { firstRow } from "@/lib/utils";

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

  const monthRange = getAccountingMonthRange(
    request.nextUrl.searchParams.get("month")
  );
  const supabase = createAdminClient();

  const { data: quotes, error } = await supabase
    .from("quotes")
    .select(
      "id, public_token, created_at, status, subtotal, discount, vat, total, payment_terms, payment_status, payment_profile_snapshot, leads(requested_document_type, billing_entity_type, billing_branch_type, billing_branch_code, billing_name, tax_id, billing_address, customers(display_name, phone)), quote_payment_records(amount_due, payment_status, opened_at, last_status_changed_at, partially_paid_at, paid_at, closed_at, proof_reference, proof_received_at, note, payment_profile_snapshot)"
    )
    .gte("created_at", monthRange.startIso)
    .lt("created_at", monthRange.endIso)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const csv = buildMonthlyAccountingCsv(
    (quotes || []).map((quote) => {
      const lead = firstRow(quote.leads);
      const customer = firstRow(lead?.customers);
      const paymentRecord = firstRow(quote.quote_payment_records);

      return {
        quote: {
          id: quote.id,
          publicToken: quote.public_token,
          createdAt: quote.created_at,
          status: quote.status,
          subtotal: Number(quote.subtotal || 0),
          discount: Number(quote.discount || 0),
          vat: Number(quote.vat || 0),
          total: Number(quote.total || 0),
          paymentTerms: quote.payment_terms,
          paymentStatus: quote.payment_status,
          paymentProfileSnapshot: quote.payment_profile_snapshot,
        },
        lead: {
          requestedDocumentType: lead?.requested_document_type ?? null,
          billingEntityType: lead?.billing_entity_type ?? null,
          billingBranchType: lead?.billing_branch_type ?? null,
          billingBranchCode: lead?.billing_branch_code ?? null,
          billingName: lead?.billing_name ?? null,
          taxId: lead?.tax_id ?? null,
          billingAddress: lead?.billing_address ?? null,
        },
        customer: {
          displayName: customer?.display_name ?? null,
          phone: customer?.phone ?? null,
        },
        paymentRecord: paymentRecord
          ? {
              paymentStatus: paymentRecord.payment_status ?? null,
              amountDue:
                typeof paymentRecord.amount_due === "number"
                  ? paymentRecord.amount_due
                  : Number(paymentRecord.amount_due || 0),
              openedAt: paymentRecord.opened_at ?? null,
              lastStatusChangedAt: paymentRecord.last_status_changed_at ?? null,
              partiallyPaidAt: paymentRecord.partially_paid_at ?? null,
              paidAt: paymentRecord.paid_at ?? null,
              closedAt: paymentRecord.closed_at ?? null,
              proofReference: paymentRecord.proof_reference ?? null,
              proofReceivedAt: paymentRecord.proof_received_at ?? null,
              note: paymentRecord.note ?? null,
              paymentProfileSnapshot:
                paymentRecord.payment_profile_snapshot ?? null,
            }
          : null,
      };
    })
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="fogus-accounting-${monthRange.month}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
