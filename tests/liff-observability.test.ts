import { describe, expect, it } from "vitest";

import {
  normalizeLiffIncidentPayload,
} from "../src/lib/liff-observability";

describe("normalizeLiffIncidentPayload", () => {
  it("keeps the incident payload usable when liffContextSnapshot JSON is malformed", () => {
    expect(() =>
      normalizeLiffIncidentPayload({
        stage: "sdk_load_timeout",
        liffContextSnapshot: '{"broken"',
      })
    ).not.toThrow();

    expect(
      normalizeLiffIncidentPayload({
        stage: "sdk_load_timeout",
        liffContextSnapshot: '{"broken"',
      })
    ).toMatchObject({
      stage: "sdk_load_timeout",
      context: null,
    });
  });

  it("normalizes valid payload fields and nested LIFF context", () => {
    const payload = normalizeLiffIncidentPayload({
      fingerprint: "  trace-1234567890  ",
      stage: "prefill_verify_token_failed",
      message: "  token invalid  ",
      pathname: " /liff/intake ",
      searchParamKeys: "?liffIdToken=abc&foo=bar",
      intakeMode: " fresh ",
      userAgent: "  Mozilla/5.0 (Linux)  ",
      sdkPresent: true,
      liffIdConfigured: false,
      lineUserId: "USER-1234567890-ABCD",
      liffContextSnapshot: JSON.stringify({
        collectedAt: "2026-04-30T00:00:00.000Z",
        os: "  iOS  ",
        appLanguage: "th",
        lineVersion: "15.0.0",
        liffSdkVersion: "2.28.0",
        isInClient: true,
        isLoggedIn: false,
        grantedScopes: [" profile ", "", "openid", null],
        context: {
          type: "  full  ",
          userId: " U123 ",
          liffId: " 2009686374-ovPbzgXx ",
          viewType: " compact ",
          endpointUrl: " https://example.com/liff ",
          scope: [" profile ", "openid", 42],
          availability: {
            shareTargetPicker: {
              permission: true,
              minVer: " 2.1.0 ",
              maxVer: " ",
              unsupportedFromVer: " 3.0.0 ",
              minOsVer: " 16.0 ",
              unsupportedFromOsVer: "",
            },
            ignoredFeature: "nope",
          },
          miniAppId: " mini-app ",
          miniDomainAllowed: true,
          permanentLinkPattern: " /foo/{id} ",
        },
      }),
    });

    expect(payload).toMatchObject({
      fingerprint: "trace-1234567890",
      stage: "prefill_verify_token_failed",
      message: "token invalid",
      pathname: "/liff/intake",
      searchParamKeys: ["liffIdToken", "foo"],
      intakeMode: "fresh",
      userAgent: "Mozilla/5.0 (Linux)",
      sdkPresent: true,
      liffIdConfigured: false,
      lineUserId: "USER-1234567890-ABCD",
      lineUserHint: "USER-1...ABCD",
      context: {
        collectedAt: "2026-04-30T00:00:00.000Z",
        os: "iOS",
        appLanguage: "th",
        lineVersion: "15.0.0",
        liffSdkVersion: "2.28.0",
        isInClient: true,
        isLoggedIn: false,
        grantedScopes: ["profile", "openid"],
        context: {
          type: "full",
          userId: "U123",
          liffId: "2009686374-ovPbzgXx",
          viewType: "compact",
          endpointUrl: "https://example.com/liff",
          scope: ["profile", "openid"],
          availability: {
            shareTargetPicker: {
              permission: true,
              minVer: "2.1.0",
              maxVer: null,
              unsupportedFromVer: "3.0.0",
              minOsVer: "16.0",
              maxOsVer: null,
              unsupportedFromOsVer: null,
            },
          },
          miniAppId: "mini-app",
          miniDomainAllowed: true,
          permanentLinkPattern: "/foo/{id}",
        },
      },
    });
  });
});
