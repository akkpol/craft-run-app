import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCreateAdminClient, mockNotFound } = vi.hoisted(() => ({
  mockCreateAdminClient: vi.fn(),
  mockNotFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mockCreateAdminClient,
}));

vi.mock("next/navigation", () => ({
  notFound: mockNotFound,
}));

describe("commercial document download page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the locked commercial snapshot instead of live mutable data", async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: "doc-1",
                status: "ISSUED",
                snapshot_json: {
                  document_type: "TAX_INVOICE_RECEIPT",
                  document_number: "TAXRE-2026-00009",
                  issued_at: "2026-05-02T15:20:00.000Z",
                  locked_at: "2026-05-02T15:00:00.000Z",
                  issuer: {
                    legal_name: "Snapshot VAT Co., Ltd.",
                    display_name: "Live name must not win",
                    role: "MAIN_COMPANY",
                    tax_id: "0105555555001",
                    branch_type: "HEAD_OFFICE",
                    address: "Snapshot issuer address",
                  },
                  customer: {
                    billing_name: "Fallback customer",
                    billing_address: "Fallback address",
                    tax_id: "fallback-tax",
                    tax_profile: {
                      legal_name: "Snapshot Customer Co., Ltd.",
                      tax_id: "0105555555999",
                      branch_type: "BRANCH",
                      branch_code: "00002",
                      branch_name: "Silom",
                      address: "Snapshot customer address",
                    },
                  },
                  payment: {
                    id: "payment-1",
                    amount: 963,
                    currency: "THB",
                    paid_at: "2026-05-02T15:25:00.000Z",
                    receiver_entity_id: "entity-1",
                  },
                  totals: {
                    subtotal: 1000,
                    discount_amount: 100,
                    vat_mode: "EXCLUSIVE",
                    vat_rate: 0.07,
                    vat_amount: 63,
                    grand_total: 963,
                  },
                },
              },
              error: null,
            }),
          })),
        })),
      })),
    };

    mockCreateAdminClient.mockReturnValue(supabase);

    const { default: CommercialDocumentDownloadPage } = await import(
      "../src/app/commercial/documents/[id]/download/page.tsx"
    );
    const element = await CommercialDocumentDownloadPage({
      params: Promise.resolve({ id: "doc-1" }),
    });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("TAXRE-2026-00009");
    expect(html).toContain("ใบเสร็จรับเงิน/ใบกำกับภาษี");
    expect(html).toContain("Snapshot VAT Co., Ltd.");
    expect(html).toContain("Snapshot Customer Co., Ltd.");
  });

  it("falls back to notFound when the snapshot is missing or invalid", async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: "doc-2",
                status: "ISSUED",
                snapshot_json: null,
              },
              error: null,
            }),
          })),
        })),
      })),
    };

    mockCreateAdminClient.mockReturnValue(supabase);

    const { default: CommercialDocumentDownloadPage } = await import(
      "../src/app/commercial/documents/[id]/download/page.tsx"
    );

    await expect(
      CommercialDocumentDownloadPage({
        params: Promise.resolve({ id: "doc-2" }),
      })
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mockNotFound).toHaveBeenCalledTimes(1);
  });
});