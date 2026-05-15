import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  mockCreateAdminClient,
  mockCreateClient,
  mockLogHumanAction,
  mockResolveAdminAccess,
} = vi.hoisted(() => ({
  mockCreateAdminClient: vi.fn(),
  mockCreateClient: vi.fn(),
  mockLogHumanAction: vi.fn(),
  mockResolveAdminAccess: vi.fn(),
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

vi.mock("@/lib/action-log", () => ({
  logHumanAction: mockLogHumanAction,
}));

type CloneRouteError = { message: string };

type CloneRouteMockOptions = {
  itemInsertError?: CloneRouteError | null;
  sourceItemsError?: CloneRouteError | null;
  sourceQuote?: Record<string, unknown>;
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

function buildSourceQuote(overrides: Record<string, unknown> = {}) {
  return {
    id: "quote-source",
    status: "sent",
    subtotal: 1000,
    discount: 0,
    vat: 70,
    total: 1070,
    payment_terms: "deposit",
    wht_rate: 0,
    lead_id: "lead-source",
    leads: {
      id: "lead-source",
      customer_id: "customer-1",
      conversation_id: "conversation-source",
      product_type: "sticker",
      width_mm: 100,
      height_mm: 100,
      qty: 10,
      note_from_form: "same design",
    },
    ...overrides,
  };
}

function createCloneRouteClient(options: CloneRouteMockOptions = {}) {
  const deletes: Array<[string, unknown]> = [];
  const inserts: Array<[string, Record<string, unknown> | Record<string, unknown>[]]> = [];
  const sourceQuote = buildSourceQuote(options.sourceQuote);

  const client = {
    from: vi.fn((table: string) => {
      if (table === "quotes") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: sourceQuote,
                error: null,
              }),
            })),
          })),
          insert: vi.fn((payload: Record<string, unknown>) => {
            inserts.push(["quotes", payload]);
            return {
              select: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: { id: "quote-new", public_token: "token-new" },
                  error: null,
                }),
              })),
            };
          }),
          delete: vi.fn(() => ({
            eq: vi.fn((_column: string, value: unknown) => {
              deletes.push(["quotes", value]);
              return Promise.resolve({ error: null });
            }),
          })),
        };
      }

      if (table === "conversations") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { line_user_id: "line-user-1" },
                error: null,
              }),
            })),
          })),
          insert: vi.fn((payload: Record<string, unknown>) => {
            inserts.push(["conversations", payload]);
            return {
              select: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: { id: "conversation-new" },
                  error: null,
                }),
              })),
            };
          }),
          delete: vi.fn(() => ({
            eq: vi.fn((_column: string, value: unknown) => {
              deletes.push(["conversations", value]);
              return Promise.resolve({ error: null });
            }),
          })),
        };
      }

      if (table === "customers") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { line_user_id: "line-user-1" },
                error: null,
              }),
            })),
          })),
        };
      }

      if (table === "leads") {
        return {
          insert: vi.fn((payload: Record<string, unknown>) => {
            inserts.push(["leads", payload]);
            return {
              select: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: { id: "lead-new" },
                  error: null,
                }),
              })),
            };
          }),
          delete: vi.fn(() => ({
            eq: vi.fn((_column: string, value: unknown) => {
              deletes.push(["leads", value]);
              return Promise.resolve({ error: null });
            }),
          })),
        };
      }

      if (table === "quote_items") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({
              data: [{ label: "Sticker", qty: 10, unit_price: 100 }],
              error: options.sourceItemsError ?? null,
            }),
          })),
          insert: vi.fn((payload: Record<string, unknown>[]) => {
            inserts.push(["quote_items", payload]);
            return Promise.resolve({
              error: options.itemInsertError ?? null,
            });
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };

  return { client, deletes, inserts };
}

async function callCloneRoute() {
  const { POST } = await import("../src/app/api/admin/quotes/[id]/clone/route.ts");
  return POST(
    new NextRequest("http://localhost/api/admin/quotes/quote-source/clone", {
      method: "POST",
    }),
    { params: Promise.resolve({ id: "quote-source" }) }
  );
}

describe("admin quote clone route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createAllowedAuthMocks();
    mockLogHumanAction.mockResolvedValue(undefined);
  });

  it("rejects draft quotes before creating a clone", async () => {
    const supabase = createCloneRouteClient({
      sourceQuote: { status: "draft" },
    });
    mockCreateAdminClient.mockReturnValue(supabase.client);

    const response = await callCloneRoute();
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe("QUOTE_CLONE_NOT_ALLOWED");
    expect(supabase.inserts).toEqual([]);
    expect(supabase.deletes).toEqual([]);
  });

  it("cleans up conversation lead and quote rows when item copy fails", async () => {
    const supabase = createCloneRouteClient({
      itemInsertError: { message: "copy failed" },
    });
    mockCreateAdminClient.mockReturnValue(supabase.client);

    const response = await callCloneRoute();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("copy failed");
    expect(supabase.deletes).toEqual([
      ["quotes", "quote-new"],
      ["leads", "lead-new"],
      ["conversations", "conversation-new"],
    ]);
    expect(mockLogHumanAction).not.toHaveBeenCalled();
  });
});
