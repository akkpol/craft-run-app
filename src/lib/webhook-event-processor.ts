import type { WebhookEvent } from "@line/bot-sdk";

import { logHumanAction, logSystemAction } from "@/lib/action-log";
import { resolveInboundConversation } from "@/lib/intake-business";
import {
  replyWithIntakeLink,
  replyWithPaymentContext,
  replyWithProductionStatus,
  replyWithQuoteApprovalContext,
  replyWithResumeOrFreshChoice,
  replyWithTerminalFollowUp,
  type LineGateway,
  type LineGatewayOptions,
} from "@/lib/line";
import { createAdminClient } from "@/lib/supabase/admin";
import type { WorkflowState } from "@/lib/types";
import {
  canTransitionConversationState,
  isTerminalConversationState,
} from "@/lib/workflow-transitions";

type AdminClient = ReturnType<typeof createAdminClient>;

export type WebhookProcessorContext = {
  supabase: AdminClient;
  lineClient: LineGateway;
  runtimeConfig?: LineGatewayOptions["runtimeConfig"];
  simulation?: {
    runId: string;
  };
};

const MID_PRODUCTION_STATES: WorkflowState[] = [
  "IN_DESIGN",
  "IN_PRODUCTION",
  "READY_FOR_FULFILLMENT",
];

function simulationPayload(context: WebhookProcessorContext) {
  return context.simulation
    ? {
        simulation: true,
        simulation_run_id: context.simulation.runId,
      }
    : {};
}

function withSimulationPayload(
  context: WebhookProcessorContext,
  payload: Record<string, unknown>
) {
  return {
    ...payload,
    ...simulationPayload(context),
  };
}

function lineOptions(context: WebhookProcessorContext): LineGatewayOptions {
  return {
    lineGateway: context.lineClient,
    auditSupabase: context.supabase,
    actionLogPayload: simulationPayload(context),
    runtimeConfig: context.runtimeConfig,
  };
}

async function lookupLatestQuoteToken(
  supabase: AdminClient,
  conversationId: string
): Promise<string | null> {
  const { data: lead } = await supabase
    .from("leads")
    .select("id")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!lead?.id) {
    return null;
  }

  const { data: quote } = await supabase
    .from("quotes")
    .select("public_token")
    .eq("lead_id", lead.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return quote?.public_token ?? null;
}

export async function processUnsendEvent(
  event: Extract<WebhookEvent, { type: "unsend" }>,
  context: WebhookProcessorContext
) {
  if (!event.unsend.messageId) {
    return;
  }

  const nowIso = new Date().toISOString();
  const { data: messageRow, error: messageLookupError } = await context.supabase
    .from("messages")
    .select("id, conversation_id, unsent_at")
    .eq("line_message_id", event.unsend.messageId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (messageLookupError) {
    console.error("Failed to load message for unsend:", messageLookupError.message);
    return;
  }

  if (!messageRow || messageRow.unsent_at) {
    return;
  }

  const { error: updateMessageError } = await context.supabase
    .from("messages")
    .update({
      raw_text: null,
      raw_payload: {
        type: "unsend",
        line_message_id: event.unsend.messageId,
        redacted_at: nowIso,
      },
      unsent_at: nowIso,
    })
    .eq("id", messageRow.id);

  if (updateMessageError) {
    console.error("Failed to redact unsent message:", updateMessageError.message);
    return;
  }

  await logSystemAction(context.supabase, {
    entityType: "message",
    entityId: messageRow.id,
    actionType: "message.unsent",
    serviceName: "webhook",
    note: "Customer unsent a LINE message",
    payload: withSimulationPayload(context, {
      conversation_id: messageRow.conversation_id,
      line_message_id: event.unsend.messageId,
    }),
  });
}

export async function processMessageTextEvent(
  event: Extract<WebhookEvent, { type: "message" }>,
  context: WebhookProcessorContext
) {
  if (event.message.type !== "text") {
    return;
  }

  const userId = event.source.userId;
  if (!userId) {
    return;
  }

  const messageText = event.message.text;
  const { data: existingConversationRows, error: existingConversationError } =
    await context.supabase
      .from("conversations")
      .select("id, state")
      .eq("line_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);

  if (existingConversationError) {
    throw new Error(
      `Failed to load existing conversation: ${existingConversationError.message}`
    );
  }

  const existingConversation = existingConversationRows?.[0] ?? null;
  const { conversationId, conversationState, reusedConversation } =
    await resolveInboundConversation({
      supabase: context.supabase,
      userId,
      existingConversation,
      midProductionStates: MID_PRODUCTION_STATES,
      actionLogPayload: simulationPayload(context),
    });

  await context.supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_type: "user",
    line_message_id: event.message.id,
    raw_text: messageText,
    raw_payload: event as unknown as Record<string, unknown>,
  });

  let displayName = "ลูกค้า";
  try {
    const profile = await context.lineClient.getProfile(userId);
    displayName = profile.displayName;

    await context.supabase.from("customers").upsert(
      { line_user_id: userId, display_name: displayName },
      { onConflict: "line_user_id" }
    );
  } catch {
    // Profile fetch can fail for users who have not added the OA as a friend.
  }

  await logSystemAction(context.supabase, {
    entityType: "conversation",
    entityId: conversationId,
    actionType: "line.webhook_received",
    serviceName: "webhook",
    note: "Received inbound LINE text message",
    payload: withSimulationPayload(context, {
      line_user_id: userId,
      message_id: event.message.id,
      message_type: "text",
      message_length: messageText.length,
      reply_token_present: Boolean(event.replyToken),
      conversation_state: conversationState,
      reused_conversation: reusedConversation,
    }),
  });

  const escalationKeywords = [
    "คุยกับคน",
    "คุยกับแอดมิน",
    "ขอคุยกับคน",
    "ต้องการคุยกับคน",
    "admin",
  ];
  const isEscalation = escalationKeywords.some((keyword) =>
    messageText.toLowerCase().includes(keyword)
  );

  if (isEscalation) {
    if (
      reusedConversation &&
      conversationState !== "HUMAN_REVIEW_REQUIRED" &&
      !canTransitionConversationState(conversationState, "HUMAN_REVIEW_REQUIRED")
    ) {
      return;
    }

    await context.supabase.from("escalations").insert({
      conversation_id: conversationId,
      reason: `Customer requested: "${messageText}"`,
      status: "open",
    });

    await context.supabase
      .from("conversations")
      .update({ state: "HUMAN_REVIEW_REQUIRED" })
      .eq("id", conversationId);

    await logHumanAction(context.supabase, {
      entityType: "conversation",
      entityId: conversationId,
      actionType: "conversation.escalated",
      actorId: userId,
      actorLabel: displayName,
      note: "Customer requested human support",
      payload: withSimulationPayload(context, {
        to: "HUMAN_REVIEW_REQUIRED",
        trigger: messageText,
      }),
    });

    if (event.replyToken) {
      try {
        await context.lineClient.replyMessage({
          replyToken: event.replyToken,
          messages: [
            {
              type: "text",
              text: "ขอบคุณค่ะ ทีมงานจะติดต่อกลับโดยเร็วที่สุดนะคะ 🙏",
            },
          ],
        });

        await logSystemAction(context.supabase, {
          entityType: "conversation",
          entityId: conversationId,
          actionType: "line.reply_sent",
          serviceName: "webhook",
          note: "Sent escalation acknowledgement",
          payload: withSimulationPayload(context, {
            channel: "reply",
            flow: "support",
            reply_variant: "escalation_ack",
            line_user_id: userId,
            conversation_state: "HUMAN_REVIEW_REQUIRED",
          }),
        });
      } catch (error) {
        await logSystemAction(context.supabase, {
          entityType: "conversation",
          entityId: conversationId,
          actionType: "line.reply_failed",
          serviceName: "webhook",
          note: "Failed to send escalation acknowledgement",
          payload: withSimulationPayload(context, {
            channel: "reply",
            flow: "support",
            reply_variant: "escalation_ack",
            line_user_id: userId,
            conversation_state: "HUMAN_REVIEW_REQUIRED",
            error_message: error instanceof Error ? error.message : String(error),
          }),
        });
        throw error;
      }
    }

    return;
  }

  if (conversationState === "HUMAN_REVIEW_REQUIRED") {
    if (event.replyToken) {
      try {
        await context.lineClient.replyMessage({
          replyToken: event.replyToken,
          messages: [
            {
              type: "text",
              text: "ทีมงานได้รับเรื่องแล้ว ตอนนี้กำลังตรวจสอบและจะติดต่อกลับโดยเร็วที่สุดค่ะ",
            },
          ],
        });

        await logSystemAction(context.supabase, {
          entityType: "conversation",
          entityId: conversationId,
          actionType: "line.reply_sent",
          serviceName: "webhook",
          note: "Sent human review pending acknowledgement",
          payload: withSimulationPayload(context, {
            channel: "reply",
            flow: "support",
            reply_variant: "human_review_pending",
            line_user_id: userId,
            conversation_state: conversationState,
          }),
        });
      } catch (error) {
        await logSystemAction(context.supabase, {
          entityType: "conversation",
          entityId: conversationId,
          actionType: "line.reply_failed",
          serviceName: "webhook",
          note: "Failed to send human review pending acknowledgement",
          payload: withSimulationPayload(context, {
            channel: "reply",
            flow: "support",
            reply_variant: "human_review_pending",
            line_user_id: userId,
            conversation_state: conversationState,
            error_message: error instanceof Error ? error.message : String(error),
          }),
        });
        throw error;
      }
    }

    return;
  }

  if (MID_PRODUCTION_STATES.includes(conversationState)) {
    const quoteToken = await lookupLatestQuoteToken(context.supabase, conversationId);
    if (event.replyToken) {
      await replyWithProductionStatus(
        event.replyToken,
        displayName,
        quoteToken,
        conversationState,
        lineOptions(context)
      );
    }
    return;
  }

  if (conversationState === "WAITING_QUOTE_APPROVAL") {
    const quoteToken = await lookupLatestQuoteToken(context.supabase, conversationId);
    if (event.replyToken) {
      await replyWithQuoteApprovalContext(
        event.replyToken,
        displayName,
        quoteToken,
        lineOptions(context)
      );
    }
    return;
  }

  if (conversationState === "WAITING_PAYMENT") {
    const quoteToken = await lookupLatestQuoteToken(context.supabase, conversationId);
    if (event.replyToken) {
      await replyWithPaymentContext(event.replyToken, displayName, quoteToken, {
        ...lineOptions(context),
      });
    }
    return;
  }

  const shouldOfferResumeOrFresh =
    reusedConversation &&
    [
      "COLLECTING_REQUIREMENTS",
      "REQUIREMENTS_REVIEW",
      "ON_HOLD_CUSTOMER_INPUT",
    ].includes(conversationState);

  if (!event.replyToken) {
    return;
  }

  if (
    conversationState === "COLLECTING_REQUIREMENTS" ||
    canTransitionConversationState(conversationState, "COLLECTING_REQUIREMENTS")
  ) {
    await context.supabase
      .from("conversations")
      .update({ state: "COLLECTING_REQUIREMENTS" })
      .eq("id", conversationId);

    await logSystemAction(context.supabase, {
      entityType: "conversation",
      entityId: conversationId,
      actionType: "conversation.state_changed",
      serviceName: "webhook",
      payload: withSimulationPayload(context, {
        from: conversationState,
        to: "COLLECTING_REQUIREMENTS",
      }),
    });
  }

  const noteUpdate =
    conversationState === "COLLECTING_REQUIREMENTS" ||
    conversationState === "ON_HOLD_CUSTOMER_INPUT"
      ? messageText
      : undefined;

  if (noteUpdate) {
    const { data: existingLead } = await context.supabase
      .from("leads")
      .select("id, note_from_chat")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (existingLead) {
      const prevNote = existingLead.note_from_chat || "";
      await context.supabase
        .from("leads")
        .update({
          note_from_chat: prevNote ? `${prevNote}\n${noteUpdate}` : noteUpdate,
        })
        .eq("id", existingLead.id);
    }
  }

  if (shouldOfferResumeOrFresh) {
    await replyWithResumeOrFreshChoice(event.replyToken, displayName, {
      ...lineOptions(context),
    });
  } else if (
    existingConversation &&
    isTerminalConversationState(existingConversation.state as WorkflowState)
  ) {
    await replyWithTerminalFollowUp(
      event.replyToken,
      displayName,
      existingConversation.state as "COMPLETED" | "CANCELLED",
      lineOptions(context)
    );
  } else {
    await replyWithIntakeLink(event.replyToken, displayName, {
      ...lineOptions(context),
    });
  }
}

export async function processFollowEvent(
  event: Extract<WebhookEvent, { type: "follow" }>,
  context: WebhookProcessorContext
) {
  const userId = event.source.userId;
  if (!userId) {
    return;
  }

  try {
    const profile = await context.lineClient.getProfile(userId);
    await context.supabase.from("customers").upsert(
      {
        line_user_id: userId,
        display_name: profile.displayName,
      },
      { onConflict: "line_user_id" }
    );
  } catch {
    // Ignore profile errors.
  }
}

export async function processWebhookEvent(
  event: WebhookEvent,
  context: WebhookProcessorContext
) {
  if (event.type === "unsend") {
    await processUnsendEvent(event, context);
    return;
  }

  if (event.type === "message" && event.message.type === "text") {
    await processMessageTextEvent(event, context);
    return;
  }

  if (event.type === "follow") {
    await processFollowEvent(event, context);
  }
}
