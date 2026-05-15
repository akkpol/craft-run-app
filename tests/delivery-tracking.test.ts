import { describe, expect, it } from "vitest";

import { hasDeliveryTrackingDetails } from "@/lib/delivery-tracking";

describe("delivery tracking visibility", () => {
  it("stays hidden when no delivery tracking fields are present", () => {
    expect(hasDeliveryTrackingDetails({})).toBe(false);
  });

  it("is visible for any stored delivery field, including dispatch time or notes only", () => {
    expect(
      hasDeliveryTrackingDetails({ delivery_dispatched_at: "2026-05-16T01:00:00.000Z" })
    ).toBe(true);
    expect(hasDeliveryTrackingDetails({ delivery_notes: "ฝาก รปภ." })).toBe(true);
    expect(hasDeliveryTrackingDetails({ delivery_tracking_url: "https://example.test/track" })).toBe(true);
  });
});
