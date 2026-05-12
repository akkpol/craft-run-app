import { describe, expect, it } from "vitest";

import { getStudioTokenMeta } from "../src/lib/studio-view.ts";

describe("studio token meta", () => {
  it("resolves the customer quote surface", () => {
    const meta = getStudioTokenMeta({
      state: "WAITING_QUOTE_APPROVAL",
      designStatus: null,
      job: null,
      paymentSummary: null,
      note: null,
      quote: {
        public_token: "quote-token",
        payment_status: "unpaid",
      },
      escalation: null,
    } as never);

    expect(meta.primarySurfaceHref).toBe("/quote/quote-token");
    expect(meta.stopReasonLabel).toBe(meta.workflowSummary);
  });

  it("resolves the customer status surface", () => {
    const meta = getStudioTokenMeta({
      state: "COMPLETED",
      designStatus: null,
      job: null,
      paymentSummary: null,
      note: null,
      quote: {
        public_token: "status-token",
        payment_status: "paid",
      },
      escalation: null,
    } as never);

    expect(meta.primarySurfaceHref).toBe("/status/status-token");
  });
});