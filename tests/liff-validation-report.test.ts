import test from "node:test";
import assert from "node:assert/strict";

import {
  hashLineUserId,
  normalizeLiffValidationReportPayload,
} from "../src/lib/liff-validation-report.ts";

test("normalizeLiffValidationReportPayload derives pass state and failed checks", () => {
  const payload = normalizeLiffValidationReportPayload({
    idToken: "header.payload.signature",
    environment: {
      collectedAt: "2026-05-09T00:00:00.000Z",
      isInClient: true,
      isLoggedIn: true,
      lineVersion: "16.2.0",
      hasIdToken: true,
      context: {
        type: "utou",
        liffId: "123456-abcd",
        scope: ["profile", "openid"],
      },
    },
    checks: [
      {
        id: "LIFF-VAL-006",
        title: "Prefill route is public to LIFF",
        passed: true,
        summary: "Reached handler without auth redirect",
      },
      {
        id: "LIFF-VAL-008",
        title: "Runtime catalog is active",
        passed: false,
        summary: "Catalog endpoint still returned fallback",
      },
    ],
    notes: "  Operator run from LINE  ",
  });

  assert.equal(payload.record.passed, false);
  assert.deepEqual(payload.record.failedChecks, ["LIFF-VAL-008"]);
  assert.equal(payload.record.liffIsInClient, true);
  assert.equal(payload.record.notes, "Operator run from LINE");
  assert.equal(payload.record.environment.context?.type, "utou");
});

test("hashLineUserId returns a stable digest without exposing raw user IDs", () => {
  const rawLineUserId = "U1234567890ABCDEFGHIJKLMN";

  const digest = hashLineUserId(rawLineUserId);

  assert.notEqual(digest, rawLineUserId);
  assert.equal(digest.length, 64);
  assert.match(digest, /^[0-9a-f]+$/);
  assert.equal(digest, hashLineUserId(rawLineUserId));
});