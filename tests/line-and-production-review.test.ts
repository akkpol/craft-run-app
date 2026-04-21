import test from "node:test";
import assert from "node:assert/strict";

import { getLineLoginChannelIdFromLiffId } from "../src/lib/line-liff-identity.ts";
import { getProductionReviewDecision } from "../src/lib/production-review.ts";

test("getLineLoginChannelIdFromLiffId extracts the LINE Login channel ID", () => {
  assert.equal(
    getLineLoginChannelIdFromLiffId("2009686374-ovPbzgXx"),
    "2009686374"
  );
});

test("getLineLoginChannelIdFromLiffId rejects malformed LIFF IDs", () => {
  assert.equal(getLineLoginChannelIdFromLiffId("invalid-liff-id"), null);
  assert.equal(getLineLoginChannelIdFromLiffId(""), null);
});

test("getProductionReviewDecision keeps approve without auto-send at approved", () => {
  assert.deepEqual(
    getProductionReviewDecision({
      action: "approve",
      customerAutoSendEnabled: false,
    }),
    {
      reviewStatusAfterReview: "approved",
      shouldSendToCustomer: false,
    }
  );
});

test("getProductionReviewDecision promotes approve with auto-send and manual send to notification flow", () => {
  assert.deepEqual(
    getProductionReviewDecision({
      action: "approve",
      customerAutoSendEnabled: true,
    }),
    {
      reviewStatusAfterReview: "approved",
      shouldSendToCustomer: true,
    }
  );

  assert.deepEqual(
    getProductionReviewDecision({
      action: "send",
      customerAutoSendEnabled: false,
    }),
    {
      reviewStatusAfterReview: "approved",
      shouldSendToCustomer: true,
    }
  );

  assert.deepEqual(
    getProductionReviewDecision({
      action: "reject",
      customerAutoSendEnabled: true,
    }),
    {
      reviewStatusAfterReview: "rejected",
      shouldSendToCustomer: false,
    }
  );
});