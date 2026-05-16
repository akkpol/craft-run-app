import { NextRequest, NextResponse } from "next/server";

import { resolveAdminAccess } from "@/lib/admin-auth";
import { getAccountingMonthRange } from "@/lib/quote-payment-records";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  buildTaxLedgerCsv,
  type TaxLedgerRowSource,
} from "@/lib/tax-ledger-export";

type CommercialDocumentRow = {
  id: string;
  document_number: string;
  document_type: string;
  status: string | null;
  issued_at: string | null;
  locked_at: string | null;
  subtotal: number | null;
  discount_amount: number | null;
  vat_rate: number | null;
  vat_amount: number | null;
  grand_total: number | null;
  issuer_entity_id: string | null;
  customer_id: string | null;
  quote_id: string | null;
  payment_id: string | null;
  order_id: string | null;
};

/**
 * GET /api/admin/accounting/tax-ledger?month=YYYY-MM
 *
 * Tax-filing ledger CSV — one row per issued commercial document in the
 * given month, joined with its payment (cash + WHT) and the withholder
 * snapshot used at issue time. Designed for ภ.พ.30 / ภ.ง.ด.53 prep.
 *
 * Complements /api/admin/accounting/monthly (quote-centric) — keep both
 * because accountants want each view for different reconciliations.
 */
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

  const { data: docsData, error: docsErr } = await supabase
    .from("commercial_documents")
    .select(
      "id, document_number, document_type, status, issued_at, locked_at, subtotal, discount_amount, vat_rate, vat_amount, grand_total, issuer_entity_id, customer_id, quote_id, payment_id, order_id"
    )
    .eq("status", "ISSUED")
    .gte("issued_at", monthRange.startIso)
    .lt("issued_at", monthRange.endIso)
    .order("issued_at", { ascending: true });

  if (docsErr) {
    return NextResponse.json({ error: docsErr.message }, { status: 500 });
  }

  const docs = (docsData ?? []) as CommercialDocumentRow[];

  // Bulk-fetch downstream rows. Each map keys by id so the CSV builder
  // can join in O(1). Empty arrays short-circuit so we never query .in([]).
  const issuerIds = [
    ...new Set(docs.map((d) => d.issuer_entity_id).filter((v): v is string => !!v)),
  ];
  const customerIds = [
    ...new Set(docs.map((d) => d.customer_id).filter((v): v is string => !!v)),
  ];
  const quoteIds = [
    ...new Set(docs.map((d) => d.quote_id).filter((v): v is string => !!v)),
  ];
  const paymentIds = [
    ...new Set(docs.map((d) => d.payment_id).filter((v): v is string => !!v)),
  ];
  const orderIds = [
    ...new Set(docs.map((d) => d.order_id).filter((v): v is string => !!v)),
  ];

  const emptyResult = { data: [], error: null } as const;
  const [
    issuersRes,
    customersRes,
    quotesRes,
    paymentsRes,
    ordersRes,
  ] = await Promise.all([
    issuerIds.length
      ? supabase
          .from("commercial_entities")
          .select(
            "id, legal_name, tax_id, branch_type, branch_code, branch_name, type"
          )
          .in("id", issuerIds)
      : Promise.resolve(emptyResult),
    customerIds.length
      ? supabase
          .from("customers")
          .select("id, display_name")
          .in("id", customerIds)
      : Promise.resolve(emptyResult),
    quoteIds.length
      ? supabase
          .from("quotes")
          .select("id, public_token, payment_terms, lead_id")
          .in("id", quoteIds)
      : Promise.resolve(emptyResult),
    paymentIds.length
      ? supabase
          .from("payments")
          .select("id, amount, wht_amount, paid_at")
          .in("id", paymentIds)
      : Promise.resolve(emptyResult),
    orderIds.length
      ? supabase
          .from("commercial_orders")
          .select("id, customer_tax_profile_id, lead_id")
          .in("id", orderIds)
      : Promise.resolve(emptyResult),
  ]);

  // Fail loudly if any bulk lookup errored — accountants would rather see
  // a 500 than receive a CSV with silently missing columns.
  const bulkErrors = [
    issuersRes.error,
    customersRes.error,
    quotesRes.error,
    paymentsRes.error,
    ordersRes.error,
  ].filter((e): e is NonNullable<typeof e> => !!e);
  if (bulkErrors.length > 0) {
    return NextResponse.json(
      {
        error: "BULK_LOOKUP_FAILED",
        detail: bulkErrors.map((e) => e.message).join("; "),
      },
      { status: 500 }
    );
  }

  const issuerMap = new Map(
    ((issuersRes.data ?? []) as Array<{
      id: string;
      legal_name: string | null;
      tax_id: string | null;
      branch_type: string | null;
      branch_code: string | null;
      branch_name: string | null;
      type: string | null;
    }>).map((row) => [row.id, row])
  );
  const customerMap = new Map(
    ((customersRes.data ?? []) as Array<{ id: string; display_name: string | null }>).map(
      (row) => [row.id, row]
    )
  );
  const quoteMap = new Map(
    ((quotesRes.data ?? []) as Array<{
      id: string;
      public_token: string | null;
      payment_terms: string | null;
      lead_id: string | null;
    }>).map((row) => [row.id, row])
  );
  const paymentMap = new Map(
    ((paymentsRes.data ?? []) as Array<{
      id: string;
      amount: number | string | null;
      wht_amount: number | string | null;
      paid_at: string | null;
    }>).map((row) => [row.id, row])
  );
  const orderMap = new Map(
    ((ordersRes.data ?? []) as Array<{
      id: string;
      customer_tax_profile_id: string | null;
      lead_id: string | null;
    }>).map((row) => [row.id, row])
  );

  // Now resolve withholder identity per row using the locked tax profile
  // when present (L30). Batch-fetch the profiles and leads we still need.
  const taxProfileIds = [
    ...new Set(
      docs
        .map((d) => orderMap.get(d.order_id ?? "")?.customer_tax_profile_id)
        .filter((v): v is string => !!v)
    ),
  ];
  const leadIdsForWithholder = [
    ...new Set(
      docs
        .map((d) => {
          const order = orderMap.get(d.order_id ?? "");
          const quote = quoteMap.get(d.quote_id ?? "");
          return order?.lead_id ?? quote?.lead_id ?? null;
        })
        .filter((v): v is string => !!v)
    ),
  ];
  const [taxProfilesRes, leadsRes] = await Promise.all([
    taxProfileIds.length
      ? supabase
          .from("customer_tax_profiles")
          .select(
            "id, legal_name, tax_id, branch_type, branch_code, branch_name, address"
          )
          .in("id", taxProfileIds)
      : Promise.resolve(emptyResult),
    leadIdsForWithholder.length
      ? supabase
          .from("leads")
          .select(
            "id, billing_name, tax_id, billing_address, billing_entity_type, billing_branch_type, billing_branch_code"
          )
          .in("id", leadIdsForWithholder)
      : Promise.resolve(emptyResult),
  ]);
  if (taxProfilesRes.error || leadsRes.error) {
    return NextResponse.json(
      {
        error: "BULK_LOOKUP_FAILED",
        detail:
          taxProfilesRes.error?.message ??
          leadsRes.error?.message ??
          "withholder lookup failed",
      },
      { status: 500 }
    );
  }
  const taxProfileMap = new Map(
    ((taxProfilesRes.data ?? []) as Array<{
      id: string;
      legal_name: string | null;
      tax_id: string | null;
      branch_type: string | null;
      branch_code: string | null;
      branch_name: string | null;
      address: string | null;
    }>).map((row) => [row.id, row])
  );
  const leadMap = new Map(
    ((leadsRes.data ?? []) as Array<{
      id: string;
      billing_name: string | null;
      tax_id: string | null;
      billing_address: string | null;
      billing_entity_type: string | null;
      billing_branch_type: string | null;
      billing_branch_code: string | null;
    }>).map((row) => [row.id, row])
  );

  const rows: TaxLedgerRowSource[] = docs.map((doc) => {
    const order = orderMap.get(doc.order_id ?? "");
    const quote = quoteMap.get(doc.quote_id ?? "");
    const issuer = doc.issuer_entity_id
      ? issuerMap.get(doc.issuer_entity_id) ?? null
      : null;
    const customer = doc.customer_id
      ? customerMap.get(doc.customer_id) ?? null
      : null;
    const payment = doc.payment_id ? paymentMap.get(doc.payment_id) : null;
    const lead = order?.lead_id
      ? leadMap.get(order.lead_id) ?? null
      : quote?.lead_id
        ? leadMap.get(quote.lead_id) ?? null
        : null;
    const taxProfile = order?.customer_tax_profile_id
      ? taxProfileMap.get(order.customer_tax_profile_id) ?? null
      : null;

    // L30: when a locked tax profile exists, use it exclusively for the
    // withholder identity — do NOT fall back to lead fields for nulls,
    // otherwise the CSV row mixes profile + lead values for the same
    // document and won't reconcile with the issued tax_invoice_receipt
    // or the 50 ทวิ certificate.
    const useTaxProfile = taxProfile != null;
    const withholderName = useTaxProfile
      ? taxProfile.legal_name ?? null
      : lead?.billing_name ?? customer?.display_name ?? null;
    const withholderTaxId = useTaxProfile
      ? taxProfile.tax_id ?? null
      : lead?.tax_id ?? null;
    const withholderAddress = useTaxProfile
      ? taxProfile.address ?? null
      : lead?.billing_address ?? null;
    const withholderBranchType = useTaxProfile
      ? taxProfile.branch_type ?? null
      : lead?.billing_branch_type ?? null;
    const withholderBranchCode = useTaxProfile
      ? taxProfile.branch_code ?? null
      : lead?.billing_branch_code ?? null;
    const withholderBranchName = useTaxProfile
      ? taxProfile.branch_name ?? null
      : null; // leads has no billing_branch_name column

    return {
      documentId: doc.id,
      documentNumber: doc.document_number,
      documentType: doc.document_type,
      status: doc.status ?? "",
      issuedAt: doc.issued_at ?? null,
      lockedAt: doc.locked_at ?? null,
      subtotal: Number(doc.subtotal ?? 0),
      discountAmount: Number(doc.discount_amount ?? 0),
      vatRate: doc.vat_rate !== null && doc.vat_rate !== undefined ? Number(doc.vat_rate) : null,
      vatAmount: Number(doc.vat_amount ?? 0),
      grandTotal: Number(doc.grand_total ?? 0),
      issuer: issuer
        ? {
            legalName: issuer.legal_name ?? "",
            taxId: issuer.tax_id ?? null,
            branchType: issuer.branch_type ?? null,
            branchCode: issuer.branch_code ?? null,
            branchName: issuer.branch_name ?? null,
            type: issuer.type ?? null,
          }
        : null,
      customer: customer ? { displayName: customer.display_name ?? null } : null,
      withholder: {
        name: withholderName,
        taxId: withholderTaxId,
        branchType: withholderBranchType,
        branchCode: withholderBranchCode,
        branchName: withholderBranchName,
        address: withholderAddress,
        entityType: lead?.billing_entity_type ?? null,
      },
      payment: payment
        ? {
            id: payment.id,
            amount: Number(payment.amount ?? 0),
            whtAmount: Number(payment.wht_amount ?? 0),
            paidAt: payment.paid_at ?? null,
          }
        : null,
      quote: {
        id: doc.quote_id ?? "",
        publicToken: quote?.public_token ?? null,
        paymentTerms: quote?.payment_terms ?? null,
      },
    };
  });

  const csv = buildTaxLedgerCsv(rows);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="fogus-tax-ledger-${monthRange.month}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
