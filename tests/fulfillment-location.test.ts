import { expect, test } from "vitest";

import { getLeadOperationalDefaults } from "../src/lib/quote-workflow.ts";
import { FULFILLMENT_MODE_LABELS, isFulfillmentMode } from "../src/lib/types.ts";

test("isFulfillmentMode accepts install and rejects unknown values", () => {
  expect(isFulfillmentMode("pickup")).toBe(true);
  expect(isFulfillmentMode("delivery")).toBe(true);
  expect(isFulfillmentMode("install")).toBe(true);
  expect(isFulfillmentMode("courier")).toBe(false);
});

test("install fulfillment keeps the selected operational default", () => {
  expect(FULFILLMENT_MODE_LABELS.install).toBe("ให้ไปติดตั้ง");

  expect(getLeadOperationalDefaults("install")).toEqual({
    fulfillment_mode: "install",
    design_assignment_mode: "manual",
    design_executor: "unassigned",
    design_status: "not_started",
  });
});