import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type QuoteBalanceBreakdown = {
  total: number;
  paid: number;
  /** Sum of withheld tax (50ทวิ) across all CONFIRMED payments. */
  whtWithheld: number;
  /** Sum of cash actually received (paid - whtWithheld). */
  cashReceived: number;
  outstanding: number;
  paymentCount: number;
  /** WHT rate set on the quote (e.g. 0.03 for 3% service WHT). */
  whtRate: number;
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
    .select("id, total, payment_terms, wht_rate")
    .eq("id", quoteId)
    .maybeSingle();
  if (quoteError || !quote) {
    return null;
  }

  const total = Number(quote.total ?? 0);
  const whtRate = Number(quote.wht_rate ?? 0);

  if (quote.payment_terms === "credit") {
    return {
      total,
      paid: 0,
      whtWithheld: 0,
      cashReceived: 0,
      outstanding: 0,
      paymentCount: 0,
      whtRate,
    };
  }

  // Sum confirmed payments via commercial_orders.quote_id.
  // `paid` = amount (cash received) + wht_amount (withheld). The customer's
  // obligation is fully discharged once paid >= quote.total because the
  // 50ทวิ certificate substitutes for the withheld portion.
  const { data: paymentRows, error: paymentsError } = await supabase
    .from("payments")
    .select("amount, wht_amount, commercial_orders!inner(quote_id)")
    .eq("status", "CONFIRMED")
    .eq("commercial_orders.quote_id", quoteId);
  if (paymentsError) {
    return {
      total,
      paid: 0,
      whtWithheld: 0,
      cashReceived: 0,
      outstanding: total,
      paymentCount: 0,
      whtRate,
    };
  }

  const rows = (paymentRows ?? []) as Array<{
    amount: number | string | null;
    wht_amount: number | string | null;
  }>;
  const cashReceived = rows.reduce(
    (sum, row) => sum + Number(row.amount ?? 0),
    0
  );
  const whtWithheld = rows.reduce(
    (sum, row) => sum + Number(row.wht_amount ?? 0),
    0
  );
  const paid = cashReceived + whtWithheld;
  const outstanding = Math.max(0, total - paid);

  return {
    total,
    paid,
    whtWithheld,
    cashReceived,
    outstanding,
    paymentCount: rows.length,
    whtRate,
  };
}

/**
 * Cents-tolerance equality check for currency comparisons.
 */
export function approxEqualCurrency(a: number, b: number, tolerance = 0.01) {
  return Math.abs(a - b) <= tolerance;
}
