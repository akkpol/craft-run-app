import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type QuoteBalanceBreakdown = {
  total: number;
  paid: number;
  outstanding: number;
  paymentCount: number;
};

/**
 * Compute the outstanding balance for a quote by summing all CONFIRMED
 * payment rows attached to the commercial order(s) of that quote.
 *
 * Used for:
 * - Admin "balance payment" panel — prefill amount = outstanding
 * - Customer-side display of remaining due
 * - Slip upload gate — allow uploads while outstanding > 0
 *
 * Returns 0 outstanding for credit terms regardless of payments table
 * because credit orders don't gate production on payment.
 */
export async function getQuoteOutstandingBalance(
  supabase: SupabaseClient,
  quoteId: string
): Promise<QuoteBalanceBreakdown | null> {
  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .select("id, total, payment_terms")
    .eq("id", quoteId)
    .maybeSingle();
  if (quoteError || !quote) {
    return null;
  }

  const total = Number(quote.total ?? 0);

  if (quote.payment_terms === "credit") {
    return { total, paid: 0, outstanding: 0, paymentCount: 0 };
  }

  // Sum confirmed payments via commercial_orders.quote_id
  const { data: paymentRows, error: paymentsError } = await supabase
    .from("payments")
    .select("amount, commercial_orders!inner(quote_id)")
    .eq("status", "CONFIRMED")
    .eq("commercial_orders.quote_id", quoteId);
  if (paymentsError) {
    return { total, paid: 0, outstanding: total, paymentCount: 0 };
  }

  const rows = (paymentRows ?? []) as Array<{ amount: number | string | null }>;
  const paid = rows.reduce(
    (sum, row) => sum + Number(row.amount ?? 0),
    0
  );
  const outstanding = Math.max(0, total - paid);

  return {
    total,
    paid,
    outstanding,
    paymentCount: rows.length,
  };
}

/**
 * Cents-tolerance equality check for currency comparisons.
 */
export function approxEqualCurrency(a: number, b: number, tolerance = 0.01) {
  return Math.abs(a - b) <= tolerance;
}
