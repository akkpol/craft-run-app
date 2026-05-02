import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeLiffContextSnapshot,
  parseLiffContextSnapshot,
} from "../src/lib/liff-capture.ts";

test("normalizeLiffContextSnapshot keeps useful LIFF environment data", () => {
  const snapshot = normalizeLiffContextSnapshot({
    collectedAt: "2026-04-27T04:00:00.000Z",
    os: "ios",
    appLanguage: "th",
    lineVersion: "15.4.0",
    liffSdkVersion: "2.27.2",
    isInClient: true,
    isLoggedIn: true,
    grantedScopes: ["profile", "openid", "email", 123],
    context: {
      type: "utou",
      userId: "U123",
      liffId: "2000000000-xxxxxxx",
      viewType: "full",
      endpointUrl: "https://example.com/liff",
      scope: ["profile", "openid", "email"],
      availability: {
        scanCodeV2: {
          permission: true,
          minVer: "14.3.0",
        },
        invalidFeature: "ignored",
      },
      miniAppId: "craft-run",
      miniDomainAllowed: true,
      permanentLinkPattern: "concat",
      ignored: "value",
    },
  });

  assert.deepEqual(snapshot, {
    collectedAt: "2026-04-27T04:00:00.000Z",
    os: "ios",
    appLanguage: "th",
    lineVersion: "15.4.0",
    liffSdkVersion: "2.27.2",
    isInClient: true,
    isLoggedIn: true,
    grantedScopes: ["profile", "openid", "email"],
    context: {
      type: "utou",
      userId: "U123",
      liffId: "2000000000-xxxxxxx",
      viewType: "full",
      endpointUrl: "https://example.com/liff",
      scope: ["profile", "openid", "email"],
      availability: {
        scanCodeV2: {
          permission: true,
          minVer: "14.3.0",
          maxVer: null,
          unsupportedFromVer: null,
          minOsVer: null,
          maxOsVer: null,
          unsupportedFromOsVer: null,
        },
      },
      miniAppId: "craft-run",
      miniDomainAllowed: true,
      permanentLinkPattern: "concat",
    },
  });
});

test("parseLiffContextSnapshot returns null for invalid JSON payloads", () => {
  assert.equal(parseLiffContextSnapshot("{not-json}"), null);
  assert.equal(parseLiffContextSnapshot(""), null);
});