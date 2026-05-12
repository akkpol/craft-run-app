import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  mockCreateAdminClient,
  mockVerifyLiffIdToken,
  mockLogSystemAction,
} = vi.hoisted(() => ({
  mockCreateAdminClient: vi.fn(),
  mockVerifyLiffIdToken: vi.fn(),
  mockLogSystemAction: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/product-catalog-store", () => ({
  getProductCatalog: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mockCreateAdminClient,
}));
vi.mock("@/lib/line", () => ({
  verifyLiffIdToken: mockVerifyLiffIdToken,
  getVerifiedLiffAccessProfile: vi.fn(),
  pushQuoteLink: vi.fn(),
}));
vi.mock("@/lib/action-log", () => ({
  logSystemAction: mockLogSystemAction,
}));

describe("intake route validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLogSystemAction.mockResolvedValue(undefined);
  });

  it("returns 400 when requestedDocumentTypes is not an array", async () => {
    const { POST } = await import("../src/app/api/intake/route.ts");

    const response = await POST(
      new NextRequest("http://localhost/api/intake", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          productType: "signage",
          width: 1200,
          height: 600,
          unit: "mm",
          qty: 2,
          phone: "0812345678",
          fulfillmentMode: "pickup",
          dueDate: "2099-01-01",
          requestedDocumentTypes: "quote",
        }),
      })
    );

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("requestedDocumentTypes must be an array");
  });

  it("returns 400 when multipart requestedDocumentTypes contains an invalid value", async () => {
    const { POST } = await import("../src/app/api/intake/route.ts");
    const formData = new FormData();

    formData.set("productType", "signage");
    formData.set("width", "1200");
    formData.set("height", "600");
    formData.set("unit", "mm");
    formData.set("qty", "2");
    formData.set("phone", "0812345678");
    formData.set("fulfillmentMode", "pickup");
    formData.set("dueDate", "2099-01-01");
    formData.append("requestedDocumentTypes", "bad_value");

    const response = await POST(
      new NextRequest("http://localhost/api/intake", {
        method: "POST",
        body: formData,
      })
    );

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("requestedDocumentTypes is invalid");
  });
});