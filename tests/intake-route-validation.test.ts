import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/product-catalog-store", () => ({
  getProductCatalog: vi.fn(),
}));

describe("intake route validation", () => {
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
});