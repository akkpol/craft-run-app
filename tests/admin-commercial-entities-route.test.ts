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

function createValidCreateBody(overrides: Record<string, unknown> = {}) {
  return {
    code: "FOGUS-SUB-2",
    type: "company",
    role: "SUB_COMPANY",
    legalName: "Fogus Sub Co., Ltd.",
    displayName: "Fogus Sub",
    isVatRegistered: false,
    branchType: "HEAD_OFFICE",
    ...overrides,
  };
}

function createPatchClient(options: {
  current: Record<string, unknown> | null;
  inflightCount?: number;
}) {
  const entityUpdates: Array<Record<string, unknown>> = [];
  const ordersIn = vi.fn().mockResolvedValue({
    count: options.inflightCount ?? 0,
    error: null,
  });

  const client = {
    from: vi.fn((table: string) => {
      if (table === "commercial_entities") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: options.current,
                error: null,
              }),
            })),
          })),
          update: vi.fn((payload: Record<string, unknown>) => {
            entityUpdates.push(payload);
            return {
              eq: vi.fn(() => ({
                select: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { ...options.current, ...payload },
                    error: null,
                  }),
                })),
              })),
            };
          }),
        };
      }

      if (table === "commercial_orders") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              in: ordersIn,
            })),
          })),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };

  return { client, entityUpdates, ordersIn };
}

async function callCreateRoute(body: Record<string, unknown>) {
  const { POST } = await import("../src/app/api/admin/commercial-entities/route.ts");
  return POST(
    new NextRequest("http://localhost/api/admin/commercial-entities", {
      method: "POST",
      body: JSON.stringify(body),
    })
  );
}

async function callPatchRoute(body: Record<string, unknown>) {
  const { PATCH } = await import("../src/app/api/admin/commercial-entities/[id]/route.ts");
  return PATCH(
    new NextRequest("http://localhost/api/admin/commercial-entities/entity-1", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: "entity-1" }) }
  );
}

describe("admin commercial entity routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createAllowedAuthMocks();
    mockLogHumanAction.mockResolvedValue(undefined);
  });

  it("rejects invalid branchType when creating an entity", async () => {
    const response = await callCreateRoute(
      createValidCreateBody({
        branchType: "WAREHOUSE",
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "ENTITY_BRANCH_TYPE_INVALID",
    });
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
  });

  it("requires issuer address when creating a VAT receiver entity", async () => {
    const response = await callCreateRoute(
      createValidCreateBody({
        taxId: "0105561234567",
        isVatRegistered: true,
        address: " ",
      })
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      error: "VAT_ENTITY_REQUIRES_ADDRESS",
    });
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
  });

  it("blocks deactivation while a selected receiver still has unpaid or partial orders", async () => {
    const supabase = createPatchClient({
      current: {
        id: "entity-1",
        type: "company",
        role: "SUB_COMPANY",
        is_vat_registered: true,
        tax_id: "0105561234567",
        address: "Bangkok",
      },
      inflightCount: 1,
    });
    mockCreateAdminClient.mockReturnValue(supabase.client);

    const response = await callPatchRoute({ active: false });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: "ENTITY_HAS_INFLIGHT_ORDERS",
      inflightCount: 1,
    });
    expect(supabase.ordersIn).toHaveBeenCalledWith("quotes.payment_status", [
      "unpaid",
      "partial",
    ]);
    expect(supabase.entityUpdates).toHaveLength(0);
  });

  it("prevents clearing the issuer address from an existing VAT entity", async () => {
    const supabase = createPatchClient({
      current: {
        id: "entity-1",
        type: "company",
        role: "SUB_COMPANY",
        is_vat_registered: true,
        tax_id: "0105561234567",
        address: "Bangkok",
      },
    });
    mockCreateAdminClient.mockReturnValue(supabase.client);

    const response = await callPatchRoute({ address: "" });

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      error: "VAT_ENTITY_REQUIRES_ADDRESS",
    });
    expect(supabase.entityUpdates).toHaveLength(0);
  });
});
