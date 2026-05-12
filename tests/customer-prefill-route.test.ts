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

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mockCreateAdminClient,
}));
vi.mock("@/lib/line", () => ({
  verifyLiffIdToken: mockVerifyLiffIdToken,
}));
vi.mock("@/lib/action-log", () => ({
  logSystemAction: mockLogSystemAction,
}));

function createAdminClientMock(options: {
  customer: { id: string; phone: string | null; display_name: string | null } | null;
  leads: Array<Record<string, unknown>>;
}) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: options.customer });
  const limit = vi.fn().mockResolvedValue({ data: options.leads });
  const order = vi.fn(() => ({ limit }));
  const eqLeads = vi.fn(() => ({ order }));
  const eqCustomers = vi.fn(() => ({ maybeSingle }));
  const selectLeads = vi.fn(() => ({ eq: eqLeads }));
  const selectCustomers = vi.fn(() => ({ eq: eqCustomers }));

  return {
    from: vi.fn((table: string) => {
      if (table === "customers") {
        return { select: selectCustomers };
      }

      if (table === "leads") {
        return { select: selectLeads };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

describe("customer prefill route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyLiffIdToken.mockResolvedValue({ userId: "U-test" });
    mockLogSystemAction.mockResolvedValue(undefined);
  });

  it("falls back to the legacy primary document type when the array is only the migration default", async () => {
    mockCreateAdminClient.mockReturnValue(
      createAdminClientMock({
        customer: {
          id: "customer-1",
          phone: "0812345678",
          display_name: "Customer One",
        },
        leads: [
          {
            product_type: "signage",
            width_mm: 1200,
            height_mm: 600,
            qty: 2,
            requested_document_type: "tax_invoice",
            requested_document_types: ["quote"],
            billing_entity_type: null,
            billing_branch_type: null,
            billing_branch_code: null,
            billing_name: null,
            tax_id: null,
            billing_address: null,
            fulfillment_mode: "pickup",
            fulfillment_address_line1: null,
            fulfillment_address_line2: null,
            fulfillment_subdistrict: null,
            fulfillment_district: null,
            fulfillment_province: null,
            fulfillment_postal_code: null,
            fulfillment_latitude: null,
            fulfillment_longitude: null,
          },
        ],
      })
    );

    const { GET } = await import("../src/app/api/customers/prefill/route.ts");
    const response = await GET(
      new NextRequest(
        "http://localhost/api/customers/prefill?lineUserId=U-test"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.lastValues.requestedDocumentType).toBe("tax_invoice");
    expect(body.lastValues.requestedDocumentTypes).toEqual(["tax_invoice"]);
  });

  it("preserves real multi-select requested_document_types values", async () => {
    mockCreateAdminClient.mockReturnValue(
      createAdminClientMock({
        customer: {
          id: "customer-1",
          phone: "0812345678",
          display_name: "Customer One",
        },
        leads: [
          {
            product_type: "signage",
            width_mm: 1200,
            height_mm: 600,
            qty: 2,
            requested_document_type: "tax_invoice",
            requested_document_types: ["quote", "tax_invoice"],
            billing_entity_type: null,
            billing_branch_type: null,
            billing_branch_code: null,
            billing_name: null,
            tax_id: null,
            billing_address: null,
            fulfillment_mode: "pickup",
            fulfillment_address_line1: null,
            fulfillment_address_line2: null,
            fulfillment_subdistrict: null,
            fulfillment_district: null,
            fulfillment_province: null,
            fulfillment_postal_code: null,
            fulfillment_latitude: null,
            fulfillment_longitude: null,
          },
        ],
      })
    );

    const { GET } = await import("../src/app/api/customers/prefill/route.ts");
    const response = await GET(
      new NextRequest(
        "http://localhost/api/customers/prefill?lineUserId=U-test"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.lastValues.requestedDocumentTypes).toEqual([
      "quote",
      "tax_invoice",
    ]);
  });
});