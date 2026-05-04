import test from "node:test";
import assert from "node:assert/strict";

import { normalizeLiffIncidentPayload } from "../src/lib/liff-observability.ts";

test("normalizeLiffIncidentPayload keeps only a compact LINE user hint", () => {
  const incident = normalizeLiffIncidentPayload({
    stage: "init_failed",
    message: "sdk missing",
    lineUserId: "U1234567890ABCDEFGHIJKL",
    liffContextSnapshot: JSON.stringify({
      collectedAt: "2026-05-03T00:00:00.000Z",
      grantedScopes: ["profile", "openid"],
      context: { type: "utou" },
    }),
  });

  assert.ok(incident);
  assert.equal(incident?.lineUserId, null);
  assert.equal(incident?.lineUserHint, "U12345...IJKL");
});

test("normalizeLiffIncidentPayload preserves explicit lineUserHint from client", () => {
  const incident = normalizeLiffIncidentPayload({
    stage: "prefill_http_error",
    lineUserHint: "U12345...ABCD",
  });

  assert.ok(incident);
  assert.equal(incident?.lineUserId, null);
  assert.equal(incident?.lineUserHint, "U12345...ABCD");
});

test("normalizeLiffIncidentPayload ignores malformed liffContextSnapshot", () => {
  const incident = normalizeLiffIncidentPayload({
    stage: "context_parse_failed",
    liffContextSnapshot: "{not-json}",
  });

  assert.ok(incident);
  assert.equal(incident?.lineUserId, null);
  assert.equal(incident?.context, null);
});