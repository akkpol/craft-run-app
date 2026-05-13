import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeLineGateway } from "@/lib/fake-line-gateway";
import { createTextMessageEvent } from "./fixtures/mock-webhooks";

const {
  mockReplyWithIntakeLink,
  mockReplyWithPaymentContext,
  mockReplyWithProductionStatus,
  mockReplyWithQuoteApprovalContext,
  mockReplyWithResumeOrFreshChoice,
  mockReplyWithTerminalFollowUp,
  mockLogHumanAction,
  mockLogSystemAction,
} = vi.hoisted(() => ({
  mockReplyWithIntakeLink: vi.fn(),
  mockReplyWithPaymentContext: vi.fn(),
  mockReplyWithProductionStatus: vi.fn(),
  mockReplyWithQuoteApprovalContext: vi.fn(),
  mockReplyWithResumeOrFreshChoice: vi.fn(),
  mockReplyWithTerminalFollowUp: vi.fn(),
  mockLogHumanAction: vi.fn(),
  mockLogSystemAction: vi.fn(),
}));

vi.mock("@/lib/line", () => ({
  getLineClient: vi.fn(),
  replyWithIntakeLink: mockReplyWithIntakeLink,
  replyWithPaymentContext: mockReplyWithPaymentContext,
  replyWithProductionStatus: mockReplyWithProductionStatus,
  replyWithQuoteApprovalContext: mockReplyWithQuoteApprovalContext,
  replyWithResumeOrFreshChoice: mockReplyWithResumeOrFreshChoice,
  replyWithTerminalFollowUp: mockReplyWithTerminalFollowUp,
}));

vi.mock("@/lib/action-log", () => ({
  logHumanAction: mockLogHumanAction,
  logSystemAction: mockLogSystemAction,
}));

function createNewLeadSupabase() {
  const conversationInsert = vi.fn(() => ({
    select: vi.fn(() => ({
      single: vi.fn().mockResolvedValue({
        data: { id: "conv-1" },
        error: null,
      }),
    })),
  }));
  const conversationUpdate = vi.fn(() => ({
    eq: vi.fn().mockResolvedValue({ error: null }),
  }));
  const messageInsert = vi.fn().mockResolvedValue({ error: null });
  const customerUpsert = vi.fn().mockResolvedValue({ error: null });

  const supabase = {
    from: vi.fn((table: string) => {
      if (table === "conversations") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              })),
            })),
          })),
          insert: conversationInsert,
          update: conversationUpdate,
        };
      }

      if (table === "messages") {
        return {
          insert: messageInsert,
        };
      }

      if (table === "customers") {
        return {
          upsert: customerUpsert,
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };

  return {
    supabase,
    conversationInsert,
    conversationUpdate,
    messageInsert,
    customerUpsert,
  };
}

function createEscalationSupabase() {
  const conversationInsert = vi.fn(() => ({
    select: vi.fn(() => ({
      single: vi.fn().mockResolvedValue({
        data: { id: "conv-esc-1" },
        error: null,
      }),
    })),
  }));
  const conversationUpdate = vi.fn(() => ({
    eq: vi.fn().mockResolvedValue({ error: null }),
  }));
  const messageInsert = vi.fn().mockResolvedValue({ error: null });
  const customerUpsert = vi.fn().mockResolvedValue({ error: null });
  const escalationInsert = vi.fn().mockResolvedValue({ error: null });

  const supabase = {
    from: vi.fn((table: string) => {
      if (table === "conversations") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              })),
            })),
          })),
          insert: conversationInsert,
          update: conversationUpdate,
        };
      }

      if (table === "messages") {
        return {
          insert: messageInsert,
        };
      }

      if (table === "customers") {
        return {
          upsert: customerUpsert,
        };
      }

      if (table === "escalations") {
        return {
          insert: escalationInsert,
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };

  return {
    supabase,
    conversationInsert,
    conversationUpdate,
    messageInsert,
    customerUpsert,
    escalationInsert,
  };
}

describe("processWebhookEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReplyWithIntakeLink.mockResolvedValue(undefined);
    mockReplyWithPaymentContext.mockResolvedValue(undefined);
    mockReplyWithProductionStatus.mockResolvedValue(undefined);
    mockReplyWithQuoteApprovalContext.mockResolvedValue(undefined);
    mockReplyWithResumeOrFreshChoice.mockResolvedValue(undefined);
    mockReplyWithTerminalFollowUp.mockResolvedValue(undefined);
    mockLogHumanAction.mockResolvedValue(undefined);
    mockLogSystemAction.mockResolvedValue(undefined);
  });

  it("creates a conversation and replies with the intake link for a new customer message", async () => {
    const { processWebhookEvent } = await import("@/lib/webhook-event-processor");
    const gateway = createFakeLineGateway({
      profiles: {
        "user-1": { displayName: "ลูกค้าทดสอบ" },
      },
    });
    const {
      supabase,
      conversationInsert,
      conversationUpdate,
      messageInsert,
      customerUpsert,
    } = createNewLeadSupabase();

    await processWebhookEvent(createTextMessageEvent(), {
      supabase: supabase as never,
      lineClient: gateway,
    });

    expect(conversationInsert).toHaveBeenCalledWith({
      line_user_id: "user-1",
      state: "NEW_MESSAGE",
    });
    expect(messageInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        conversation_id: "conv-1",
        sender_type: "user",
        line_message_id: "message-1",
      })
    );
    expect(customerUpsert).toHaveBeenCalledWith(
      {
        line_user_id: "user-1",
        display_name: "ลูกค้าทดสอบ",
      },
      { onConflict: "line_user_id" }
    );
    expect(conversationUpdate).toHaveBeenCalledWith({
      state: "COLLECTING_REQUIREMENTS",
    });
    expect(mockReplyWithIntakeLink).toHaveBeenCalledWith(
      "reply-token-1",
      "ลูกค้าทดสอบ",
      expect.objectContaining({
        lineGateway: gateway,
        auditSupabase: supabase,
      })
    );
    expect(mockLogSystemAction).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({ actionType: "conversation.created" })
    );
    expect(mockLogSystemAction).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({ actionType: "line.webhook_received" })
    );
  });

  it("opens an escalation and sends an acknowledgement for escalation keywords", async () => {
    const { processWebhookEvent } = await import("@/lib/webhook-event-processor");
    const gateway = createFakeLineGateway({
      profiles: {
        "user-1": { displayName: "ลูกค้าเร่งด่วน" },
      },
    });
    const { supabase, conversationUpdate, escalationInsert } =
      createEscalationSupabase();

    await processWebhookEvent(
      createTextMessageEvent({
        message: {
          id: "message-2",
          type: "text",
          quoteToken: "quote-token-2",
          text: "ขอคุยกับแอดมิน",
        },
      }),
      {
        supabase: supabase as never,
        lineClient: gateway,
      }
    );

    expect(escalationInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        conversation_id: "conv-esc-1",
        status: "open",
      })
    );
    expect(conversationUpdate).toHaveBeenCalledWith({
      state: "HUMAN_REVIEW_REQUIRED",
    });
    expect(gateway.getReplyCalls()).toHaveLength(1);
    expect(gateway.getReplyCalls()[0].request).toMatchObject({
      replyToken: "reply-token-1",
      messages: [
        expect.objectContaining({
          type: "text",
          text: "ขอบคุณค่ะ ทีมงานจะติดต่อกลับโดยเร็วที่สุดนะคะ 🙏",
        }),
      ],
    });
    expect(mockLogHumanAction).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({ actionType: "conversation.escalated" })
    );
  });
});
