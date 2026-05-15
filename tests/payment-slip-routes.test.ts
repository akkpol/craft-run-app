import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  mockCreateAdminClient,
  mockCreateClient,
  mockIsAllowedPaymentSlipMime,
  mockLogHumanAction,
  mockResolveAdminAccess,
  mockUploadPaymentSlipFile,
} = vi.hoisted(() => ({
  mockCreateAdminClient: vi.fn(),
  mockCreateClient: vi.fn(),
  mockIsAllowedPaymentSlipMime: vi.fn(),
  mockLogHumanAction: vi.fn(),
  mockResolveAdminAccess: vi.fn(),
  mockUploadPaymentSlipFile: vi.fn(),
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

vi.mock("@/lib/payment-slip-storage", () => ({
  PAYMENT_SLIP_MAX_BYTES: 5 * 1024 * 1024,
  isAllowedPaymentSlipMime: mockIsAllowedPaymentSlipMime,
  uploadPaymentSlipFile: mockUploadPaymentSlipFile,
}));

function createFormDataRequest(url: string) {
  const formData = new FormData();
  formData.set(
    "file",
    new File([new Uint8Array([1])], "slip.png", { type: "image/png" })
  );

  return new NextRequest(url, {
    method: "POST",
    body: formData,
  });
}

function createQuoteLookupClient(quote: Record<string, unknown>) {
  return {
    from: vi.fn((table: string) => {
      if (table !== "quotes") {
        throw new Error(`Unexpected table ${table}`);
      }

      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: quote, error: null }),
          })),
        })),
      };
    }),
  };
}

function createAllowedAuthMocks() {
  mockCreateClient.mockResolvedValue({
    auth: {
      getClaims: vi.fn().mockResolvedValue({
        data: { claims: { sub: "admin-1" } },
      }),
    },
  });
  mockResolveAdminAccess.mockReturnValue({
    authenticated: true,
    allowed: true,
    email: "admin@example.com",
  });
}

function createSlipReviewClient(options: {
  updatedSlip: { id: string } | null;
  updateEqCalls: Array<[string, unknown]>;
}) {
  const updateChain = {
    eq: vi.fn((column: string, value: unknown) => {
      options.updateEqCalls.push([column, value]);
      return updateChain;
    }),
    select: vi.fn(() => updateChain),
    maybeSingle: vi.fn().mockResolvedValue({
      data: options.updatedSlip,
      error: null,
    }),
  };

  return {
    from: vi.fn((table: string) => {
      if (table === "payment_slips") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: "slip-1",
                  quote_id: "quote-1",
                  status: "pending",
                  payment_id: null,
                },
                error: null,
              }),
            })),
          })),
          update: vi.fn(() => updateChain),
        };
      }

      if (table === "payments") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: "payment-1",
                  order_id: "order-1",
                  status: "PENDING",
                  commercial_orders: { quote_id: "quote-1" },
                },
                error: null,
              }),
            })),
          })),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

describe("payment slip routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAllowedPaymentSlipMime.mockReturnValue(true);
    mockLogHumanAction.mockResolvedValue(undefined);
  });

  it("rejects public slip uploads when the quote is not payment-gated", async () => {
    mockCreateAdminClient.mockReturnValue(
      createQuoteLookupClient({
        id: "quote-1",
        public_token: "public-token-1",
        lead_id: "lead-1",
        status: "sent",
        payment_terms: "deposit",
        payment_status: "unpaid",
        jobs: [],
      })
    );

    const { POST } = await import("../src/app/api/quotes/[token]/slip/route.ts");
    const response = await POST(
      createFormDataRequest("http://localhost/api/quotes/public-token-1/slip"),
      { params: Promise.resolve({ token: "public-token-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe("QUOTE_NOT_WAITING_PAYMENT");
    expect(mockUploadPaymentSlipFile).not.toHaveBeenCalled();
    expect(mockLogHumanAction).not.toHaveBeenCalled();
  });

  it("treats a match update that lost the pending race as a conflict", async () => {
    createAllowedAuthMocks();
    const updateEqCalls: Array<[string, unknown]> = [];
    mockCreateAdminClient.mockReturnValue(
      createSlipReviewClient({ updatedSlip: null, updateEqCalls })
    );

    const { POST } = await import(
      "../src/app/api/admin/payment-slips/[id]/match/route.ts"
    );
    const response = await POST(
      new NextRequest("http://localhost/api/admin/payment-slips/slip-1/match", {
        method: "POST",
        body: JSON.stringify({ paymentId: "payment-1" }),
      }),
      { params: Promise.resolve({ id: "slip-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe("Slip is no longer pending");
    expect(updateEqCalls).toContainEqual(["status", "pending"]);
    expect(mockLogHumanAction).not.toHaveBeenCalled();
  });

  it("treats a reject update that lost the pending race as a conflict", async () => {
    createAllowedAuthMocks();
    const updateEqCalls: Array<[string, unknown]> = [];
    mockCreateAdminClient.mockReturnValue(
      createSlipReviewClient({ updatedSlip: null, updateEqCalls })
    );

    const { POST } = await import(
      "../src/app/api/admin/payment-slips/[id]/reject/route.ts"
    );
    const response = await POST(
      new NextRequest("http://localhost/api/admin/payment-slips/slip-1/reject", {
        method: "POST",
        body: JSON.stringify({ reason: "wrong amount" }),
      }),
      { params: Promise.resolve({ id: "slip-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe("Slip is no longer pending");
    expect(updateEqCalls).toContainEqual(["status", "pending"]);
    expect(mockLogHumanAction).not.toHaveBeenCalled();
  });
});
