-- Withholding tax (หัก ณ ที่จ่าย) v1 — minimum viable B2B support.
--
-- Thai tax law: B2B customers withhold 3% on service work (รับจ้างทำของ)
-- from each payment and issue a 50ทวิ certificate. Without this column
-- pair, the system can't distinguish "customer paid 970 because they
-- withheld 30" from "customer underpaid by 30" — leading to
-- PAYMENT_AMOUNT_EXCEEDS_OUTSTANDING failures and incorrect receipts.
--
-- This migration adds the data plumbing only:
--   - quotes.wht_rate      — flat % WHT applied at issue time (typically 0.03)
--   - payments.wht_amount  — actual baht withheld on this specific payment
--
-- The accompanying app code:
--   1. exposes wht_rate in admin quote actions and customer quote page,
--   2. lets admin enter wht_amount when confirming partial / paid / balance,
--   3. RPC confirm_commercial_payment accepts p_wht_amount and includes it
--      in the cumulative outstanding check.
--
-- Out of scope (v2 follow-up packet):
--   - 50ทวิ certificate PDF generation
--   - WHT line snapshot inside commercial_documents.snapshot_json
--   - Automatic VAT-aware wht_rate suggestion based on receiver entity

alter table public.quotes
  add column if not exists wht_rate numeric(5,4) not null default 0
    check (wht_rate >= 0 and wht_rate <= 0.20);

alter table public.payments
  add column if not exists wht_amount numeric(12,2) not null default 0
    check (wht_amount >= 0);

comment on column public.quotes.wht_rate is
  'Flat withholding tax rate applied to subtotal (e.g. 0.0300 = 3% on service work).';
comment on column public.payments.wht_amount is
  'Thai withholding tax withheld on this specific payment in baht. Counts toward outstanding balance alongside payments.amount.';
