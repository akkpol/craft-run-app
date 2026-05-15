import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  mockCreateAdminClient,
  mockCreateClient,
  mockGetRuntimeAppConfig,
  mockLogHumanAction,
  mockResolveAdminAccess,
  mockResolvePaymentProfileFromConfig,
} = vi.hoisted(() => ({
  mockCreateAdminClient: vi.fn(),
  mockCreateClient: vi.fn(),
  mockGetRuntimeAppConfig: vi.fn(),
  mockLogHumanAction: vi.fn(),
  mockResolveAdminAccess: vi.fn(),
  mockResolvePaymentProfileFromConfig: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mockCreateAdminClient,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mockCreateClient,
}));

vi.mock("@/lib/admin-auth", () => ({
  resolveAdminAccess: mockResolveAdminAccess,
}));

vi.mock("@/lib/app-settings", () => ({
  getRuntimeAppConfig: mockGetRuntimeAppConfig,
}));

vi.mock("@/lib/payment-routing", () => ({
  resolvePaymentProfileFromConfig: mockResolvePaymentProfileFromConfig,
}));

vi.mock("@/lib/action-log", () => ({
  logHumanAction: mockLogHumanAction,
}));

type QuoteItemsClientOptions = {
  deletedItem?: Record<string, unknown> | null;
  existingItems?: Array<{ id: string }>;
  insertedItem?: Record<string, unknown>;
  lineTotals?: number[];
  quote?: Record<string, unknown>;
  remainingCount?: number;
};

function createAllowedAuthMocks() {
  mockCreateClient.mockResolvedValue({
    auth: {
      getClaims: vi.fn().mockResolvedValue({
        data: { claims: { email: "admin@example.com" } },
      }),
    },
  });
  mockResolveAdminAccess.mockReturnValue({
    authenticated: true,
    allowed: true,
    email: "admin@example.com",
  });
}

function createQuoteItemsClient(options: QuoteItemsClientOptions = {}) {
  const quoteUpdates: Array<Record<string, unknown>> = [];
  const insertedRows: Array<Record<string, unknown>> = [];
  const deleteEqCalls: Array<[string, unknown]> = [];
  let deleteCalls = 0;

  const quote = {
    id: "quote-1",
    status: "sent",
    discount: 0,
    payment_terms: "deposit",
    payment_status: "unpaid",
    leads: { billing_entity_type: "company" },
    ...options.quote,
  };
  const insertedItem = options.insertedItem ?? {
    id: "item-new",
    label: "Inkjet sign",
    qty: 1,
    unit_price: 800,
    line_total: 800,
  };
  const deletedItem = options.deletedItem ?? {
    id: "item-1",
    label: "Old item",
    qty: 2,
    unit_price: 250,
  };
  const existingItems = options.existingItems ?? [
    { id: "item-1" },
    { id: "item-2" },
  ];
  const lineTotals = (options.lineTotals ?? [800]).map((line_total) => ({
    line_total,
  }));

  const client = {
    from: vi.fn((table: string) => {
      if (table === "quotes") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: quote,
                error: null,
              }),
            })),
          })),
          update: vi.fn((payload: Record<string, unknown>) => {
            quoteUpdates.push(payload);
            return {
              eq: vi.fn().mockResolvedValue({ error: null }),
            };
          }),
        };
      }

      if (table === "quote_items") {
        return {
          insert: vi.fn((payload: Record<string, unknown>) => {
            insertedRows.push(payload);
            return {
              select: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: insertedItem,
                  error: null,
                }),
              })),
            };
          }),
          select: vi.fn(
            (_columns: string, selectOptions?: { count?: string; head?: boolean }) => {
              if (selectOptions?.head) {
                return {
                  eq: vi.fn().mockResolvedValue({
                    count: options.remainingCount ?? existingItems.length,
                    error: null,
                  }),
                };
              }

              return {
                eq: vi.fn().mockResolvedValue({
                  data: _columns === "id" ? existingItems : lineTotals,
                  error: null,
                }),
                order: vi.fn().mockResolvedValue({
                  data: existingItems,
                  error: null,
                }),
              };
            }
          ),
          delete: vi.fn(() => {
            deleteCalls += 1;
            const chain = {
              eq: vi.fn((column: string, value: unknown) => {
                deleteEqCalls.push([column, value]);
                return chain;
              }),
              select: vi.fn(() => chain),
              maybeSingle: vi.fn().mockResolvedValue({
                data: deletedItem,
                error: null,
              }),
            };
            return chain;
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };

  return {
    client,
    deleteEqCalls,
    get deleteCalls() {
      return deleteCalls;
    },
    insertedRows,
    quoteUpdates,
  };
}

async function callAddItemRoute(body: Record<string, unknown>) {
  const { POST } = await import(
    "../src/app/api/admin/quotes/[id]/items/route.ts"
  );
  return POST(
    new NextRequest("http://localhost/api/admin/quotes/quote-1/items", {
      method: "POST",
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: "quote-1" }) }
  );
}

async function callDeleteItemRoute(itemId = "item-1") {
  const { DELETE } = await import(
    "../src/app/api/admin/quotes/[id]/items/[itemId]/route.ts"
  );
  return DELETE(
    new NextRequest(
      `http://localhost/api/admin/quotes/quote-1/items/${itemId}`,
      { method: "DELETE" }
    ),
    { params: Promise.resolve({ id: "quote-1", itemId }) }
  );
}

describe("admin quote item routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createAllowedAuthMocks();
    mockGetRuntimeAppConfig.mockResolvedValue({ paymentAccountName: "Primary" });
    mockResolvePaymentProfileFromConfig.mockReturnValue({
      sourceProfile: "secondary",
      reason: "secondary_total_threshold",
      profile: { accountName: "Secondary" },
    });
    mockLogHumanAction.mockResolvedValue(undefined);
  });

  it("refreshes the payment profile snapshot from the new total when adding an item", async () => {
    const supabase = createQuoteItemsClient({
      lineTotals: [800, 500],
    });
    mockCreateAdminClient.mockReturnValue(supabase.client);

    const response = await callAddItemRoute({
      label: "Inkjet sign",
      qty: 1,
      unitPrice: 800,
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.totals).toEqual({ subtotal: 1300, vat: 91, total: 1391 });
    expect(mockResolvePaymentProfileFromConfig).toHaveBeenCalledWith(
      { paymentAccountName: "Primary" },
      {
        total: 1391,
        billingEntityType: "company",
        paymentTerms: "deposit",
      }
    );
    expect(supabase.quoteUpdates[0]).toMatchObject({
      subtotal: 1300,
      vat: 91,
      total: 1391,
      payment_profile_snapshot: {
        sourceProfile: "secondary",
        reason: "secondary_total_threshold",
      },
    });
  });

  it("rejects deleting the last quote item before mutating quote_items", async () => {
    const supabase = createQuoteItemsClient({
      existingItems: [{ id: "item-1" }],
    });
    mockCreateAdminClient.mockReturnValue(supabase.client);

    const response = await callDeleteItemRoute();
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe("LAST_ITEM_PROTECTED");
    expect(supabase.deleteCalls).toBe(0);
    expect(supabase.insertedRows).toEqual([]);
    expect(supabase.quoteUpdates).toEqual([]);
  });

  it("refreshes the payment profile snapshot from the new total when deleting an item", async () => {
    const supabase = createQuoteItemsClient({
      lineTotals: [500],
      quote: { discount: 100, payment_terms: "prepaid" },
      remainingCount: 1,
    });
    mockCreateAdminClient.mockReturnValue(supabase.client);

    const response = await callDeleteItemRoute();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.totals).toEqual({ subtotal: 500, vat: 28, total: 428 });
    expect(supabase.deleteEqCalls).toEqual([
      ["id", "item-1"],
      ["quote_id", "quote-1"],
    ]);
    expect(mockResolvePaymentProfileFromConfig).toHaveBeenCalledWith(
      { paymentAccountName: "Primary" },
      {
        total: 428,
        billingEntityType: "company",
        paymentTerms: "prepaid",
      }
    );
    expect(supabase.quoteUpdates[0]).toMatchObject({
      subtotal: 500,
      vat: 28,
      total: 428,
      payment_profile_snapshot: {
        sourceProfile: "secondary",
        reason: "secondary_total_threshold",
      },
    });
  });
});
