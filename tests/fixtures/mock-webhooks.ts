import type { WebhookEvent } from "@line/bot-sdk";

type TextMessageEventOverrides = Partial<Extract<WebhookEvent, { type: "message" }>>;
type FollowEventOverrides = Partial<Extract<WebhookEvent, { type: "follow" }>>;
type UnsendEventOverrides = Partial<Extract<WebhookEvent, { type: "unsend" }>>;

export function createTextMessageEvent(
  overrides: TextMessageEventOverrides = {}
): Extract<WebhookEvent, { type: "message" }> {
  return {
    type: "message",
    mode: "active",
    timestamp: Date.now(),
    webhookEventId: "evt-text-1",
    deliveryContext: {
      isRedelivery: false,
    },
    source: {
      type: "user",
      userId: "user-1",
    },
    replyToken: "reply-token-1",
    message: {
      id: "message-1",
      type: "text",
      quoteToken: "quote-token-1",
      text: "สวัสดีค่ะ",
    },
    ...overrides,
  } as Extract<WebhookEvent, { type: "message" }>;
}

export function createFollowEvent(
  overrides: FollowEventOverrides = {}
): Extract<WebhookEvent, { type: "follow" }> {
  return {
    type: "follow",
    mode: "active",
    timestamp: Date.now(),
    webhookEventId: "evt-follow-1",
    deliveryContext: {
      isRedelivery: false,
    },
    source: {
      type: "user",
      userId: "user-1",
    },
    replyToken: "reply-token-1",
    ...overrides,
  } as Extract<WebhookEvent, { type: "follow" }>;
}

export function createUnsendEvent(
  overrides: UnsendEventOverrides = {}
): Extract<WebhookEvent, { type: "unsend" }> {
  return {
    type: "unsend",
    mode: "active",
    timestamp: Date.now(),
    webhookEventId: "evt-unsend-1",
    deliveryContext: {
      isRedelivery: false,
    },
    source: {
      type: "user",
      userId: "user-1",
    },
    unsend: {
      messageId: "message-1",
    },
    ...overrides,
  } as Extract<WebhookEvent, { type: "unsend" }>;
}
