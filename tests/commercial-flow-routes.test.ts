import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockCreateAdminClient, mockLogHumanAction } = vi.hoisted(() => ({
  mockCreateAdminClient: vi.fn(),
  mockLogHumanAction: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mockCreateAdminClient,
}));

vi.mock("@/lib/action-log", () => ({
  logHumanAction: mockLogHumanAction,
}));

describe("commercial flow route confirmation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLogHumanAction.mockResolvedValue(undefined);
  });

  it("confirms payment and locks the receiver on the happy path", async () => {
    const paymentUpdate = vi.fn().mockResolvedValue({ error: null });
    const orderUpdate = vi.fn().mockResolvedValue({ error: null });
    const paymentUpdatePayloads: Array<Record<string, unknown>> = [];
    const orderUpdatePayloads: Array<Record<string, unknown>> = [];

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "payments") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: "payment-1",
                    order_id: "order-1",
                    receiver_entity_id: "entity-main",
                    status: "PENDING",
                    amount: 963,
                  },
                  error: null,
                }),
              })),
            })),
            update: vi.fn((payload: Record<string, unknown>) => {
              paymentUpdatePayloads.push(payload);
              return {
                eq: paymentUpdate,
              };
            }),
          };
        }

        if (table === "commercial_orders") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: "order-1",
                    quote_id: "quote-1",
                    selected_receiver_entity_id: "entity-main",
                    payment_receiver_locked_at: null,
                  },
                  error: null,
                }),
              })),
            })),
            update: vi.fn((payload: Record<string, unknown>) => {
              orderUpdatePayloads.push(payload);
              return {
                eq: orderUpdate,
              };
            }),
          };
        }

        if (table === "quote_payment_records") {
          // Fail-open: no record → amount validation is skipped (backward-compatible).
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              })),
            })),
          };
        }

        if (table === "commercial_entities") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: "entity-main",
                    active: true,
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

    mockCreateAdminClient.mockReturnValue(supabase);

    const { POST } = await import("../src/app/api/payments/confirm/route.ts");
    const response = await POST(
      new NextRequest("http://localhost/api/payments/confirm", {
        method: "POST",
        body: JSON.stringify({ paymentId: "payment-1" }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.paymentId).toBe("payment-1");
    expect(body.orderId).toBe("order-1");
    expect(body.receiverEntityId).toBe("entity-main");
    expect(paymentUpdatePayloads).toHaveLength(1);
    expect(paymentUpdatePayloads[0]).toMatchObject({
      status: "CONFIRMED",
    });
    expect(orderUpdatePayloads).toHaveLength(1);
    expect(orderUpdatePayloads[0]).toHaveProperty("payment_receiver_locked_at");
    expect(mockLogHumanAction).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({
        actionType: "commercial.payment_confirmed",
        entityId: "quote-1",
      })
    );
  });

  it("re-applies the receiver lock when payment is already confirmed but the order is still unlocked", async () => {
    const paymentUpdate = vi.fn();
    const orderUpdate = vi.fn().mockResolvedValue({ error: null });
    const orderUpdatePayloads: Array<Record<string, unknown>> = [];

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "payments") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: "payment-1",
                    order_id: "order-1",
                    receiver_entity_id: "entity-main",
                    status: "CONFIRMED",
                    amount: 963,
                  },
                  error: null,
                }),
              })),
            })),
            update: vi.fn(() => ({
              eq: paymentUpdate,
            })),
          };
        }

        if (table === "commercial_orders") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: "order-1",
                    quote_id: "quote-1",
                    selected_receiver_entity_id: "entity-main",
                    payment_receiver_locked_at: null,
                  },
                  error: null,
                }),
              })),
            })),
            update: vi.fn((payload: Record<string, unknown>) => {
              orderUpdatePayloads.push(payload);
              return {
                eq: orderUpdate,
              };
            }),
          };
        }

        if (table === "commercial_entities") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: "entity-main",
                    active: true,
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

    mockCreateAdminClient.mockReturnValue(supabase);

    const { POST } = await import("../src/app/api/payments/confirm/route.ts");
    const response = await POST(
      new NextRequest("http://localhost/api/payments/confirm", {
        method: "POST",
        body: JSON.stringify({ paymentId: "payment-1" }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(paymentUpdate).not.toHaveBeenCalled();
    expect(orderUpdatePayloads).toHaveLength(1);
    expect(orderUpdatePayloads[0]).toHaveProperty("payment_receiver_locked_at");
    expect(mockLogHumanAction).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({
        actionType: "commercial.payment_confirmed",
        entityId: "quote-1",
      })
    );
  });

  it("short-circuits document issue when a payment already has an issued document", async () => {
    const rpc = vi.fn();
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "payments") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: "payment-1",
                    order_id: "order-1",
                    receiver_entity_id: "entity-main",
                    status: "CONFIRMED",
                    amount: 963,
                    currency: "THB",
                    paid_at: "2026-05-02T15:25:00.000Z",
                  },
                  error: null,
                }),
              })),
            })),
          };
        }

        if (table === "commercial_documents") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: "doc-1",
                    document_number: "RE-2026-00001",
                    document_type: "RECEIPT",
                  },
                  error: null,
                }),
              })),
            })),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
      rpc,
    };

    mockCreateAdminClient.mockReturnValue(supabase);

    const { POST } = await import("../src/app/api/commercial/documents/issue/route.ts");
    const response = await POST(
      new NextRequest("http://localhost/api/commercial/documents/issue", {
        method: "POST",
        body: JSON.stringify({ paymentId: "payment-1" }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toMatchObject({
      error: "DOCUMENT_ALREADY_ISSUED",
      documentId: "doc-1",
      documentNumber: "RE-2026-00001",
    });
    expect(rpc).not.toHaveBeenCalled();
    expect(mockLogHumanAction).not.toHaveBeenCalled();
  });

  /**
   * Helper: build a Supabase mock for the payments/confirm route where the
   * caller can override any of the four tables the route reads. Centralises
   * the boilerplate so each launch-blocker scenario stays compact and reads
   * like a state declaration.
   */
  function buildPaymentsConfirmSupabase(overrides: {
    payment?: Record<string, unknown> | null;
    commercialOrder?: Record<string, unknown> | null;
    quotePaymentRecord?: Record<string, unknown> | null;
    commercialEntity?: Record<string, unknown> | null;
  }) {
    const payment =
      overrides.payment === null
        ? null
        : {
            id: "payment-1",
            order_id: "order-1",
            receiver_entity_id: "entity-main",
            status: "PENDING",
            amount: 1000,
            ...overrides.payment,
          };
    const commercialOrder =
      overrides.commercialOrder === null
        ? null
        : {
            id: "order-1",
            quote_id: "quote-1",
            selected_receiver_entity_id: "entity-main",
            payment_receiver_locked_at: null,
            ...overrides.commercialOrder,
          };
    const commercialEntity =
      overrides.commercialEntity === null
        ? null
        : {
            id: "entity-main",
            active: true,
            ...overrides.commercialEntity,
          };

    return {
      from: vi.fn((table: string) => {
        if (table === "payments") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi
                  .fn()
                  .mockResolvedValue({ data: payment, error: null }),
              })),
            })),
            update: vi.fn(() => ({ eq: vi.fn() })),
          };
        }

        if (table === "commercial_orders") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi
                  .fn()
                  .mockResolvedValue({ data: commercialOrder, error: null }),
              })),
            })),
            update: vi.fn(() => ({ eq: vi.fn() })),
          };
        }

        if (table === "quote_payment_records") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: overrides.quotePaymentRecord ?? null,
                  error: null,
                }),
              })),
            })),
          };
        }

        if (table === "commercial_entities") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi
                  .fn()
                  .mockResolvedValue({ data: commercialEntity, error: null }),
              })),
            })),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    };
  }

  async function callPaymentsConfirm() {
    const { POST } = await import("../src/app/api/payments/confirm/route.ts");
    return POST(
      new NextRequest("http://localhost/api/payments/confirm", {
        method: "POST",
        body: JSON.stringify({ paymentId: "payment-1" }),
      })
    );
  }

  // C4 — Prepaid customer paid less than amount_due. FIX-1 must reject with
  // PAYMENT_AMOUNT_UNDERPAID rather than silently confirming. Without this
  // guard, a partial transfer would lock the receiver and unlock production.
  it("rejects a prepaid payment whose amount is less than amount_due (C4)", async () => {
    mockCreateAdminClient.mockReturnValue(
      buildPaymentsConfirmSupabase({
        payment: { amount: 800 },
        quotePaymentRecord: {
          amount_due: 1000,
          payment_terms: "prepaid",
        },
      })
    );

    const response = await callPaymentsConfirm();
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error).toBe("PAYMENT_AMOUNT_UNDERPAID");
    expect(mockLogHumanAction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ entityId: "quote-1" })
    );
  });

  // C5 — Prepaid customer overpaid (e.g. wrong manual entry). The route must
  // block overpayment too so the operator decides explicitly whether to refund
  // or accept; silently confirming an over-amount would distort accounting.
  it("rejects a prepaid payment whose amount exceeds amount_due (C5)", async () => {
    mockCreateAdminClient.mockReturnValue(
      buildPaymentsConfirmSupabase({
        payment: { amount: 1200 },
        quotePaymentRecord: {
          amount_due: 1000,
          payment_terms: "prepaid",
        },
      })
    );

    const response = await callPaymentsConfirm();
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error).toBe("PAYMENT_AMOUNT_OVERPAID");
  });

  // C6 — Money entered entity A but the order had entity B selected. This
  // breaks the "เงินเข้าใคร = เอกสารออกชื่อนั้น" invariant and must be
  // rejected before locking the receiver. The check fires from
  // validatePaymentConfirm and runs before the amount validation, so we do
  // not even need a quote_payment_records row here.
  it("rejects payment when receiver entity does not match the order's selected receiver (C6)", async () => {
    mockCreateAdminClient.mockReturnValue(
      buildPaymentsConfirmSupabase({
        payment: { receiver_entity_id: "entity-secondary" },
        commercialOrder: { selected_receiver_entity_id: "entity-main" },
      })
    );

    const response = await callPaymentsConfirm();
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error).toBe("PAYMENT_RECEIVER_MISMATCH");
  });

  // C7 — Receiver entity exists but has been marked inactive (e.g. a closed
  // bank account). Even if everything else matches, confirming would lock
  // money into an unusable account. Must reject with RECEIVER_ENTITY_INACTIVE.
  it("rejects payment when the receiver entity is inactive (C7)", async () => {
    mockCreateAdminClient.mockReturnValue(
      buildPaymentsConfirmSupabase({
        commercialEntity: { active: false },
      })
    );

    const response = await callPaymentsConfirm();
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error).toBe("RECEIVER_ENTITY_INACTIVE");
  });
});