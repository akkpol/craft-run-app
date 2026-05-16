import { notFound, redirect } from "next/navigation";

import WhtCertificatePrintPage from "@/components/wht-certificate-print-page";
import { resolveAdminAccess } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { buildWhtCertificatePrintModel } from "@/lib/wht-certificate-print";

import WhtCertificateToolbar from "./wht-cert-toolbar";

export const dynamic = "force-dynamic";

/**
 * Withholding-tax certificate (50 ทวิ) printable page.
 *
 * Authoritative source of truth: payments.wht_amount > 0. If the payment
 * has no WHT withheld this page 404s. The certificate fields are derived
 * (not stored) — see buildWhtCertificatePrintModel for the mapping. Admin
 * prints the page; the customer signs/stamps and returns it.
 */
export default async function AdminWhtCertificatePage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id: paymentId } = await props.params;

  const authClient = await createClient();
  const { data: authData } = await authClient.auth.getClaims();
  const access = resolveAdminAccess(authData?.claims);
  if (!access.authenticated) {
    redirect(`/auth/login?next=/admin/payments/${paymentId}/wht-cert`);
  }
  if (!access.allowed) {
    redirect("/admin?error=forbidden");
  }

  const supabase = createAdminClient();
  const { data: payment, error: paymentErr } = await supabase
    .from("payments")
    .select(
      "id, amount, wht_amount, paid_at, currency, order_id, receiver_entity_id"
    )
    .eq("id", paymentId)
    .maybeSingle();

  if (paymentErr) {
    throw new Error(paymentErr.message);
  }
  if (!payment) {
    notFound();
  }

  // Guard: no WHT means no certificate.
  const whtAmount = Number(payment.wht_amount ?? 0);
  if (!Number.isFinite(whtAmount) || whtAmount <= 0) {
    return (
      <div className="mx-auto max-w-2xl space-y-3 p-6">
        <h1 className="text-lg font-semibold text-slate-950">
          payment นี้ไม่ได้หักภาษี ณ ที่จ่าย
        </h1>
        <p className="text-sm text-slate-600">
          ออก 50 ทวิ ได้เฉพาะ payment ที่มี <code>wht_amount &gt; 0</code> เท่านั้น
        </p>
        <a href="/admin" className="text-sm font-semibold text-sky-700 underline">
          กลับหน้าหลัก
        </a>
      </div>
    );
  }

  // Resolve order + downstream entities. We split the queries because
  // commercial_orders carries quote_id + lead_id + customer_id needed by
  // the print model, while leads carries the billing snapshot (withholder
  // identity fallback) and commercial_entities carries the payee (shop)
  // identity. If the order has a locked customer_tax_profile_id, that
  // profile is the source of truth for withholder identity (L30) — same
  // as what tax_invoice_receipt prints.
  const { data: order } = await supabase
    .from("commercial_orders")
    .select("id, quote_id, lead_id, customer_id, customer_tax_profile_id")
    .eq("id", payment.order_id)
    .maybeSingle();

  if (!order) {
    notFound();
  }

  const [{ data: quote }, { data: lead }, { data: customer }, { data: entity }, { data: taxProfile }] =
    await Promise.all([
      supabase
        .from("quotes")
        .select("id, wht_rate")
        .eq("id", order.quote_id)
        .maybeSingle(),
      supabase
        .from("leads")
        .select("id, billing_name, tax_id, billing_address, billing_entity_type")
        .eq("id", order.lead_id)
        .maybeSingle(),
      supabase
        .from("customers")
        .select("id, display_name")
        .eq("id", order.customer_id)
        .maybeSingle(),
      supabase
        .from("commercial_entities")
        .select(
          "id, legal_name, type, tax_id, address, branch_type, branch_code, branch_name"
        )
        .eq("id", payment.receiver_entity_id)
        .maybeSingle(),
      order.customer_tax_profile_id
        ? supabase
            .from("customer_tax_profiles")
            .select(
              "id, legal_name, tax_id, branch_type, branch_code, branch_name, address"
            )
            .eq("id", order.customer_tax_profile_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  if (!quote || !entity) {
    notFound();
  }

  // Withholder identity precedence: locked tax profile > lead snapshot.
  // customer_tax_profiles doesn't carry billing_entity_type so that field
  // still comes from the lead — it controls UI defaults only; the actual
  // PND form code now derives from receiver_entity.type (L29), not this.
  const withholderName =
    (taxProfile?.legal_name ?? null) ||
    (lead?.billing_name ?? null) ||
    (customer?.display_name ?? null);
  const withholderTaxId =
    (taxProfile?.tax_id ?? null) || (lead?.tax_id ?? null);
  const withholderAddress =
    (taxProfile?.address ?? null) || (lead?.billing_address ?? null);

  const printModel = buildWhtCertificatePrintModel({
    payment: {
      id: payment.id,
      amount: Number(payment.amount ?? 0),
      wht_amount: whtAmount,
      paid_at: payment.paid_at ?? null,
      currency: payment.currency ?? null,
    },
    receiver_entity: {
      legal_name: entity.legal_name ?? "",
      type: entity.type ?? null,
      tax_id: entity.tax_id ?? null,
      address: entity.address ?? null,
      branch_type: entity.branch_type ?? null,
      branch_code: entity.branch_code ?? null,
      branch_name: entity.branch_name ?? null,
    },
    withholder: {
      billing_name: withholderName,
      tax_id: withholderTaxId,
      billing_address: withholderAddress,
      billing_entity_type: lead?.billing_entity_type ?? null,
      customer_display_name: customer?.display_name ?? null,
    },
    quote: {
      id: quote.id,
      wht_rate: quote.wht_rate ?? null,
    },
  });

  if (!printModel) {
    notFound();
  }

  return (
    <WhtCertificatePrintPage
      printModel={printModel}
      toolbar={<WhtCertificateToolbar />}
    />
  );
}
