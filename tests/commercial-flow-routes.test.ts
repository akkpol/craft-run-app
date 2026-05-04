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
});