import test from "node:test";
import assert from "node:assert/strict";

import { getPaymentDisplayState } from "../src/lib/payment-display.ts";
import { resolvePaymentProfile } from "../src/lib/payment-routing.ts";

test("payment display mode can force account details only", () => {
  const state = getPaymentDisplayState({
    paymentDisplayMode: "account_only",
    paymentAccountName: "FOGUS Co., Ltd.",
    paymentAccountNumber: "123-456-7890",
    paymentQrCodeUrl: "https://example.com/qr.png",
  });

  assert.equal(state.showDetails, true);
  assert.equal(state.showQr, false);
  assert.equal(state.paymentDetails.length, 2);
});

test("payment display mode can force qr only", () => {
  const state = getPaymentDisplayState({
    paymentDisplayMode: "qr_only",
    paymentAccountName: "FOGUS Co., Ltd.",
    paymentQrCodeUrl: "https://example.com/qr.png",
  });

  assert.equal(state.showDetails, false);
  assert.equal(state.showQr, true);
});

test("payment display mode falls back to account details when qr-only has no qr configured", () => {
  const state = getPaymentDisplayState({
    paymentDisplayMode: "qr_only",
    paymentAccountName: "FOGUS Co., Ltd.",
    paymentAccountNumber: "123-456-7890",
  });

  assert.equal(state.showDetails, true);
  assert.equal(state.showQr, false);
});

test("payment routing selects secondary profile when quote total is below threshold", () => {
  const result = resolvePaymentProfile(
    {
      primaryProfile: {
        accountName: "Main Co",
        accountNumber: "111",
      },
      secondaryProfile: {
        accountName: "Small Jobs Co",
        accountNumber: "222",
      },
      secondaryMaxQuoteTotal: 300,
      secondaryCustomerScope: "none",
      secondaryPaymentTermsScope: "none",
    },
    {
      total: 280,
      billingEntityType: null,
      paymentTerms: "prepaid",
    }
  );

  assert.equal(result.sourceProfile, "secondary");
  assert.equal(result.reason, "secondary_total_threshold");
  assert.equal(result.profile.accountNumber, "222");
});

test("payment routing falls back to primary when secondary rule exists but secondary profile is empty", () => {
  const result = resolvePaymentProfile(
    {
      primaryProfile: {
        accountName: "Main Co",
        accountNumber: "111",
      },
      secondaryProfile: {},
      secondaryMaxQuoteTotal: 300,
      secondaryCustomerScope: "company",
      secondaryPaymentTermsScope: "none",
    },
    {
      total: 250,
      billingEntityType: "company",
      paymentTerms: "prepaid",
    }
  );

  assert.equal(result.sourceProfile, "primary");
  assert.equal(result.reason, "default");
  assert.equal(result.profile.accountNumber, "111");
});

test("payment routing selects secondary profile when payment term matches requested scope", () => {
  const result = resolvePaymentProfile(
    {
      primaryProfile: {
        accountName: "Main Co",
        accountNumber: "111",
      },
      secondaryProfile: {
        accountName: "Credit Co",
        accountNumber: "333",
      },
      secondaryMaxQuoteTotal: null,
      secondaryCustomerScope: "none",
      secondaryPaymentTermsScope: "credit",
    },
    {
      total: 2000,
      billingEntityType: null,
      paymentTerms: "credit",
    }
  );

  assert.equal(result.sourceProfile, "secondary");
  assert.equal(result.reason, "secondary_payment_terms");
  assert.equal(result.profile.accountNumber, "333");
});

test("payment routing selects secondary profile when customer billing type matches scope", () => {
  const result = resolvePaymentProfile(
    {
      primaryProfile: {
        accountName: "Main Co",
        accountNumber: "111",
      },
      secondaryProfile: {
        accountName: "Company Co",
        accountNumber: "444",
      },
      secondaryMaxQuoteTotal: null,
      secondaryCustomerScope: "company",
      secondaryPaymentTermsScope: "none",
    },
    {
      total: 1200,
      billingEntityType: "company",
      paymentTerms: "deposit",
    }
  );

  assert.equal(result.sourceProfile, "secondary");
  assert.equal(result.reason, "secondary_customer_scope");
  assert.equal(result.profile.accountNumber, "444");
});