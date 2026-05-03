import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockCreateAdminClient, mockPushFollowUpMessage, mockLogHumanAction } = vi.hoisted(() => ({
  mockCreateAdminClient: vi.fn(),
  mockPushFollowUpMessage: vi.fn(),
  mockLogHumanAction: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mockCreateAdminClient,
}));

vi.mock("@/lib/line", () => ({
  pushFollowUpMessage: mockPushFollowUpMessage,
}));

vi.mock("@/lib/action-log", () => ({
  logHumanAction: mockLogHumanAction,
}));

function createQueryResult(data: unknown) {
  return {
    data,
    error: null,
  };
}

function createSupabaseClient(conversations: unknown[], customers: unknown[] = []) {
  return {
    from(table: string) {
      if (table === "conversations") {
        return {
          select() {
            return this;
          },
          in() {
            return this;
          },
          lt() {
            return this;
          },
          order() {
            return this;
          },
          limit() {
            return createQueryResult(conversations);
          },
        };
      }

      if (table === "customers") {
        return {
          select() {
            return this;
          },
          in() {
            return createQueryResult(customers);
          },
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  };
}

describe("admin follow-up route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLogHumanAction.mockResolvedValue(undefined);
    mockPushFollowUpMessage.mockResolvedValue(undefined);
    process.env.CRON_SECRET = "";
  });

  it("returns a queue-split preview before sending", async () => {
    mockCreateAdminClient.mockReturnValue(
      createSupabaseClient(
        [
          {
            id: "conv-1",
            state: "WAITING_QUOTE_APPROVAL",
            line_user_id: "user-1",
            last_message_at: "2026-05-01T10:00:00.000Z",
          },
          {
            id: "conv-2",
            state: "ON_HOLD_CUSTOMER_INPUT",
            line_user_id: "user-2",
            last_message_at: "2026-05-01T11:00:00.000Z",
          },
        ],
        [
          { line_user_id: "user-1", display_name: "A" },
          { line_user_id: "user-2", display_name: "B" },
        ]
      )
    );

    const { GET } = await import("../src/app/api/admin/follow-up/route.ts");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.totalCount).toBe(2);
    expect(body.queueCounts).toEqual({
      "quote-decision": 1,
      "customer-waiting": 1,
    });
    expect(body.conversations).toHaveLength(2);
    expect(body.conversations[0]).toMatchObject({
      id: "conv-1",
      queueKey: "quote-decision",
      queueLabel: "Quote Decision",
    });
  });

  it("sends follow-up only for eligible conversations", async () => {
    mockCreateAdminClient.mockReturnValue(
      createSupabaseClient(
        [
          {
            id: "conv-1",
            state: "WAITING_QUOTE_APPROVAL",
            line_user_id: "user-1",
            last_message_at: "2026-05-01T10:00:00.000Z",
          },
        ],
        [{ line_user_id: "user-1", display_name: "A" }]
      )
    );

    const { POST } = await import("../src/app/api/admin/follow-up/route.ts");
    const response = await POST(
      new NextRequest("http://localhost/api/admin/follow-up", {
        method: "POST",
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.sent).toBe(1);
    expect(mockPushFollowUpMessage).toHaveBeenCalledWith(
      "user-1",
      "WAITING_QUOTE_APPROVAL",
      "A"
    );
    expect(mockLogHumanAction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actionType: "follow_up_sent",
      })
    );
  });
});
