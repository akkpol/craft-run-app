import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const {
  mockCreateAdminClient,
  mockCreateJobForApprovedQuote,
  mockGetRuntimeAppConfig,
  mockLogHumanAction,
  mockPaymentUnlocksProduction,
  mockResolvePaymentProfileFromConfig,
  mockSyncQuotePaymentRecord,
} = vi.hoisted(() => ({
  mockCreateAdminClient: vi.fn(),
  mockCreateJobForApprovedQuote: vi.fn(),
  mockGetRuntimeAppConfig: vi.fn(),
  mockLogHumanAction: vi.fn(),
  mockPaymentUnlocksProduction: vi.fn(),
  mockResolvePaymentProfileFromConfig: vi.fn(),
  mockSyncQuotePaymentRecord: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mockCreateAdminClient,
}));

vi.mock("@/lib/app-settings", () => ({
  getRuntimeAppConfig: mockGetRuntimeAppConfig,
}));

vi.mock("@/lib/payment-routing", () => ({
  resolvePaymentProfileFromConfig: mockResolvePaymentProfileFromConfig,
}));

vi.mock("@/lib/quote-payment-records", () => ({
  syncQuotePaymentRecord: mockSyncQuotePaymentRecord,
}));

vi.mock("@/lib/quote-workflow", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/quote-workflow")>();
  return {
    ...actual,
    createJobForApprovedQuote: mockCreateJobForApprovedQuote,
    getQuoteApprovalState: vi.fn(() => "IN_DESIGN"),
    paymentUnlocksProduction: mockPaymentUnlocksProduction,
  };
});

vi.mock("@/lib/action-log", () => ({
  logHumanAction: mockLogHumanAction,
}));

type SupabaseMockOptions = {
  quote?: Record<string, unknown>;
  rpcData?: unknown;
  rpcError?: { message: string } | null;
  quoteUpdateError?: { message: string } | null;
};

function buildSupabaseMock(options: SupabaseMockOptions = {}) {
  const events: string[] = [];
  const quoteUpdates: Array<Record<string, unknown>> = [];
  const quote = {
    id: "quote-1",
    lead_id: "lead-1",
    public_token: "pub-1",
    total: 1000,
    status: "approved",
    payment_terms: "deposit",
    payment_status: "unpaid",
    leads: {
      conversation_id: "conversation-1",
      billing_entity_type: "person",
    },
    ...options.quote,
  };

  return {
    events,
    quoteUpdates,
    client: {
      rpc: vi.fn().mockImplementation(() => {
        events.push("rpc.confirm_commercial_payment");
        return Promise.resolve({
          data:
            options.rpcData ??
            [
              {
                payment_id: "payment-1",
                order_id: "order-1",
                receiver_entity_id: "entity-main",
                payment_receiver_locked_at: "2026-05-15T01:00:00.000Z",
                reused: false,
              },
            ],
          error: options.rpcError ?? null,
        });
      }),
      from: vi.fn((table: string) => {
        if (table === "quotes") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({ data: quote, error: null }),
              })),
            })),
            update: vi.fn((payload: Record<string, unknown>) => {
              events.push("quotes.update");
              quoteUpdates.push(payload);
              return {
                eq: vi.fn().mockResolvedValue({
                  error: options.quoteUpdateError ?? null,
                }),
              };
            }),
          };
        }

        if (table === "conversations") {
          return {
            update: vi.fn(() => {
              events.push("conversations.update");
              return {
                eq: vi.fn().mockResolvedValue({ error: null }),
              };
            }),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    },
  };
}

async function callCommercialRoute(body: Record<string, unknown>) {
  const { POST } = await import("../src/app/api/quotes/[id]/commercial/route.ts");
  return POST(
    new NextRequest("http://localhost/api/quotes/quote-1/commercial", {
      method: "POST",
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: "quote-1" }) }
  );
}

describe("quote commercial route payment ordering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRuntimeAppConfig.mockResolvedValue({});
    mockResolvePaymentProfileFromConfig.mockReturnValue({
      sourceProfile: "primary",
      reason: "default",
      profile: {},
    });
    mockSyncQuotePaymentRecord.mockResolvedValue({});
    mockPaymentUnlocksProduction.mockReturnValue(true);
    mockCreateJobForApprovedQuote.mockResolvedValue({
      created: true,
      jobId: "job-1",
    });
    mockLogHumanAction.mockResolvedValue(undefined);
  });

  it("rejects paid before receiver selection without updating quote workflow state", async () => {
    const supabase = buildSupabaseMock({
      rpcError: {
        message:
          "RECEIVER_REQUIRED_BEFORE_PAYMENT: select receiver before confirming payment for quote quote-1.",
      },
    });
    mockCreateAdminClient.mockReturnValue(supabase.client);

    const response = await callCommercialRoute({
      paymentStatus: "paid",
      paymentAmount: 1000,
      paymentIdempotencyKey: "key-paid-1",
    });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe("RECEIVER_REQUIRED_BEFORE_PAYMENT");
    expect(supabase.events).toEqual(["rpc.confirm_commercial_payment"]);
    expect(mockSyncQuotePaymentRecord).not.toHaveBeenCalled();
    expect(mockCreateJobForApprovedQuote).not.toHaveBeenCalled();
  });

  it("rejects partial payment without an explicit amount before touching payment or quote state", async () => {
    const supabase = buildSupabaseMock();
    mockCreateAdminClient.mockReturnValue(supabase.client);

    const response = await callCommercialRoute({
      paymentStatus: "partial",
      paymentIdempotencyKey: "key-partial-1",
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("PAYMENT_AMOUNT_REQUIRED");
    expect(supabase.client.rpc).not.toHaveBeenCalled();
    expect(supabase.events).toEqual([]);
  });

  it("confirms payment through RPC before updating quote state and creating a job", async () => {
    const supabase = buildSupabaseMock();
    mockCreateAdminClient.mockReturnValue(supabase.client);

    const response = await callCommercialRoute({
      paymentStatus: "paid",
      paymentIdempotencyKey: "key-paid-2",
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      paymentStatus: "paid",
      paymentConfirmedId: "payment-1",
      jobCreated: true,
      jobId: "job-1",
    });
    expect(supabase.events[0]).toBe("rpc.confirm_commercial_payment");
    expect(supabase.events).toContain("quotes.update");
    expect(supabase.events.indexOf("rpc.confirm_commercial_payment")).toBeLessThan(
      supabase.events.indexOf("quotes.update")
    );
    expect(supabase.quoteUpdates[0]).toMatchObject({
      payment_status: "paid",
    });
    expect(mockSyncQuotePaymentRecord).toHaveBeenCalledOnce();
    expect(mockCreateJobForApprovedQuote).toHaveBeenCalledOnce();
  });

  it("returns an existing payment on idempotent retry without creating a different quote state", async () => {
    const supabase = buildSupabaseMock({
      rpcData: [
        {
          payment_id: "payment-existing",
          order_id: "order-1",
          receiver_entity_id: "entity-main",
          payment_receiver_locked_at: "2026-05-15T01:00:00.000Z",
          reused: true,
        },
      ],
    });
    mockCreateAdminClient.mockReturnValue(supabase.client);

    const response = await callCommercialRoute({
      paymentStatus: "paid",
      paymentIdempotencyKey: "key-paid-retry",
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.paymentConfirmedId).toBe("payment-existing");
    expect(mockLogHumanAction).toHaveBeenCalledWith(
      supabase.client,
      expect.objectContaining({
        actionType: "commercial.payment_confirmed",
        payload: expect.objectContaining({ reused: true }),
      })
    );
  });

  it("rejects idempotency key conflicts before quote state changes", async () => {
    const supabase = buildSupabaseMock({
      rpcError: {
        message:
          "PAYMENT_IDEMPOTENCY_CONFLICT: payment idempotency key key-paid-1 was already used for a different confirmation.",
      },
    });
    mockCreateAdminClient.mockReturnValue(supabase.client);

    const response = await callCommercialRoute({
      paymentStatus: "paid",
      paymentIdempotencyKey: "key-paid-1",
    });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe("PAYMENT_IDEMPOTENCY_CONFLICT");
    expect(supabase.events).toEqual(["rpc.confirm_commercial_payment"]);
    expect(mockSyncQuotePaymentRecord).not.toHaveBeenCalled();
  });
});
