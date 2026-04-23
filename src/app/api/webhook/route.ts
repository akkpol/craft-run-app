import { NextRequest, NextResponse } from "next/server";
import {
  verifySignature,
  replyWithIntakeLink,
  replyWithResumeOrFreshChoice,
  replyWithQuoteApprovalContext,
  replyWithPaymentContext,
  replyWithProductionStatus,
  replyWithTerminalFollowUp,
  getLineClient,
} from "@/lib/line";
import { createAdminClient } from "@/lib/supabase/admin";
import type { WebhookEvent } from "@line/bot-sdk";
import {
  canTransitionConversationState,
  getReusableConversationState,
  isTerminalConversationState,
} from "@/lib/workflow-transitions";
import type { WorkflowState } from "@/lib/types";
import { logSystemAction, logHumanAction } from "@/lib/action-log";


/**
 * Looks up the most recent quote token (quotes.public_token) for a conversation.
 * Returns null when no lead or quote exists yet.
 */
async function lookupLatestQuoteToken(
  supabase: ReturnType<typeof createAdminClient>,
  conversationId: string
): Promise<string | null> {
  const { data: lead } = await supabase
    .from("leads")
    .select("id")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!lead?.id) return null;
  const { data: quote } = await supabase
    .from("quotes")
    .select("public_token")
    .eq("lead_id", lead.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return quote?.public_token ?? null;
}

async function redactMessageForUnsend(
  supabase: ReturnType<typeof createAdminClient>,
  lineMessageId: string
) {
  const nowIso = new Date().toISOString();
  const { data: messageRow, error: messageLookupError } = await supabase
    .from("messages")
    .select("id, conversation_id, unsent_at")
    .eq("line_message_id", lineMessageId)
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

  const { error: updateMessageError } = await supabase
    .from("messages")
    .update({
      raw_text: null,
      raw_payload: {
        type: "unsend",
        line_message_id: lineMessageId,
        redacted_at: nowIso,
      },
      unsent_at: nowIso,
    })
    .eq("id", messageRow.id);

  if (updateMessageError) {
    console.error("Failed to redact unsent message:", updateMessageError.message);
    return;
  }

  await logSystemAction(supabase, {
    entityType: "message",
    entityId: messageRow.id,
    actionType: "message.unsent",
    serviceName: "webhook",
    note: "Customer unsent a LINE message",
    payload: {
      conversation_id: messageRow.conversation_id,
      line_message_id: lineMessageId,
    },
  });
}

export async function POST(request: NextRequest) {
  // 1. Read raw body for signature verification
  const rawBody = await request.text();
  const signature = request.headers.get("x-line-signature");

  if (!signature || !(await verifySignature(rawBody, signature))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // 2. Parse events
  let body: { events: WebhookEvent[] };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body.events)) {
    return NextResponse.json({ error: "Invalid events payload" }, { status: 400 });
  }

  if (body.events.length === 0) {
    return NextResponse.json({ status: "ok" });
  }

  const supabase = createAdminClient();
  const lineClient = await getLineClient();

  // 3. Process each event — keep it lean and fast
  for (const event of body.events) {
    try {
      if (event.type === "unsend") {
        if (event.unsend.messageId) {
          await redactMessageForUnsend(supabase, event.unsend.messageId);
        }
        continue;
      }

      if (event.type === "message" && event.message.type === "text") {
        const userId = event.source.userId;
        if (!userId) continue;

        const messageText = event.message.text;

        // 3a. Upsert conversation
        const { data: existingConvRows, error: existingConvError } = await supabase
          .from("conversations")
          .select("id, state")
          .eq("line_user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1);

        if (existingConvError) {
          console.error("Failed to load existing conversation:", existingConvError.message);
          continue;
        }

        const existingConv = existingConvRows?.[0] ?? null;
        const reusableCollectionState = getReusableConversationState(
          existingConv?.state,
          "COLLECTING_REQUIREMENTS"
        );
        const reusableReviewState =
          reusableCollectionState ??
          getReusableConversationState(existingConv?.state, "REQUIREMENTS_REVIEW");

        const MID_PRODUCTION_STATES: WorkflowState[] = [
          "IN_DESIGN",
          "IN_PRODUCTION",
          "READY_FOR_FULFILLMENT",
        ];
        const isActiveMidProduction =
          !!existingConv &&
          MID_PRODUCTION_STATES.includes(existingConv.state as WorkflowState);

        let conversationId: string;
        let conversationState: WorkflowState = "NEW_MESSAGE";
        let reusedConversation = false;

        if (existingConv && reusableReviewState) {
          reusedConversation = true;
          conversationId = existingConv.id;
          conversationState = reusableReviewState;

          const conversationUpdate: {
            last_message_at: string;
            state?: WorkflowState;
          } = {
            last_message_at: new Date().toISOString(),
          };

          if (reusableReviewState !== existingConv.state) {
            conversationUpdate.state = reusableReviewState;
          }

          const { error: updateConversationError } = await supabase
            .from("conversations")
            .update(conversationUpdate)
            .eq("id", conversationId);

          if (updateConversationError) {
            console.error("Failed to update conversation:", updateConversationError.message);
            continue;
          }
        } else if (isActiveMidProduction) {
          reusedConversation = true;
          conversationId = existingConv!.id;
          conversationState = existingConv!.state as WorkflowState;
          const { error: midProductionUpdateError } = await supabase
            .from("conversations")
            .update({ last_message_at: new Date().toISOString() })
            .eq("id", conversationId);
          if (midProductionUpdateError) {
            console.error(
              `Failed to update last_message_at for conversation ${conversationId}:`,
              midProductionUpdateError.message
            );
            continue;
          }
        } else {
          const { data: newConv, error: newConvError } = await supabase
            .from("conversations")
            .insert({ line_user_id: userId, state: "NEW_MESSAGE" })
            .select("id")
            .single();

          if (!newConv?.id) {
            console.error(
              "Failed to create conversation:",
              newConvError?.message || "conversation insert returned null"
            );
            continue;
          }

          conversationId = newConv.id;
          conversationState = "NEW_MESSAGE";
          await logSystemAction(supabase, {
            entityType: "conversation",
            entityId: conversationId,
            actionType: "conversation.created",
            serviceName: "webhook",
            note: "New conversation from LINE message",
            payload: {
              state: "NEW_MESSAGE",
              line_user_id: userId,
              previous_state: existingConv?.state ?? null,
            },
          });
        }

        // 3b. Save raw message (always first, before reply)
        await supabase.from("messages").insert({
          conversation_id: conversationId,
          sender_type: "user",
          line_message_id: event.message.id,
          raw_text: messageText,
          raw_payload: event as unknown as Record<string, unknown>,
        });

        // 3c. Upsert customer
        let displayName = "ลูกค้า";
        try {
          const profile = await lineClient.getProfile(userId);
          displayName = profile.displayName;

          await supabase
            .from("customers")
            .upsert(
              { line_user_id: userId, display_name: displayName },
              { onConflict: "line_user_id" }
            );
        } catch {
          // Profile fetch can fail for users who haven't added as friend
        }

        // 3d. Check for escalation keywords
        const escalationKeywords = [
          "คุยกับคน",
          "คุยกับแอดมิน",
          "ขอคุยกับคน",
          "ต้องการคุยกับคน",
          "admin",
        ];
        const isEscalation = escalationKeywords.some((kw) =>
          messageText.toLowerCase().includes(kw)
        );

        if (isEscalation) {
          if (
            reusedConversation &&
            conversationState !== "HUMAN_REVIEW_REQUIRED" &&
            !canTransitionConversationState(
              conversationState,
              "HUMAN_REVIEW_REQUIRED"
            )
          ) {
            continue;
          }

          // Create escalation
          await supabase.from("escalations").insert({
            conversation_id: conversationId,
            reason: `Customer requested: "${messageText}"`,
            status: "open",
          });

          await supabase
            .from("conversations")
            .update({ state: "HUMAN_REVIEW_REQUIRED" })
            .eq("id", conversationId);

          await logHumanAction(supabase, {
            entityType: "conversation",
            entityId: conversationId,
            actionType: "conversation.escalated",
            actorId: userId,
            actorLabel: displayName,
            note: "Customer requested human support",
            payload: { to: "HUMAN_REVIEW_REQUIRED", trigger: messageText },
          });

          if (event.replyToken) {
            await lineClient.replyMessage({
              replyToken: event.replyToken,
              messages: [
                {
                  type: "text",
                  text: "ขอบคุณค่ะ ทีมงานจะติดต่อกลับโดยเร็วที่สุดนะคะ 🙏",
                },
              ],
            });
          }
          continue;
        }

        if (conversationState === "HUMAN_REVIEW_REQUIRED") {
          if (event.replyToken) {
            await lineClient.replyMessage({
              replyToken: event.replyToken,
              messages: [
                {
                  type: "text",
                  text: "ทีมงานได้รับเรื่องแล้ว ตอนนี้กำลังตรวจสอบและจะติดต่อกลับโดยเร็วที่สุดค่ะ",
                },
              ],
            });
          }
          continue;
        }

        if (MID_PRODUCTION_STATES.includes(conversationState)) {
          const quoteToken = await lookupLatestQuoteToken(supabase, conversationId);
          if (event.replyToken) {
            await replyWithProductionStatus(
              event.replyToken,
              displayName,
              quoteToken,
              conversationState
            );
          }
          continue;
        }

        // WAITING_QUOTE_APPROVAL: send quote link — do NOT offer resume/fresh intake
        if (conversationState === "WAITING_QUOTE_APPROVAL") {
          const quoteToken = await lookupLatestQuoteToken(supabase, conversationId);
          if (event.replyToken) {
            await replyWithQuoteApprovalContext(event.replyToken, displayName, quoteToken);
          }
          continue;
        }

        // WAITING_PAYMENT: send status link — do NOT offer resume/fresh intake
        if (conversationState === "WAITING_PAYMENT") {
          const quoteToken = await lookupLatestQuoteToken(supabase, conversationId);
          if (event.replyToken) {
            await replyWithPaymentContext(event.replyToken, displayName, quoteToken);
          }
          continue;
        }

        const shouldOfferResumeOrFresh =
          reusedConversation &&
          [
            "COLLECTING_REQUIREMENTS",
            "REQUIREMENTS_REVIEW",
            "ON_HOLD_CUSTOMER_INPUT",
          ].includes(conversationState);

        // 3e. Reply with LIFF intake link
        if (event.replyToken) {
          // Update state to COLLECTING_REQUIREMENTS
          if (
            conversationState === "COLLECTING_REQUIREMENTS" ||
            canTransitionConversationState(
              conversationState,
              "COLLECTING_REQUIREMENTS"
            )
          ) {
            await supabase
              .from("conversations")
              .update({ state: "COLLECTING_REQUIREMENTS" })
              .eq("id", conversationId);

            await logSystemAction(supabase, {
              entityType: "conversation",
              entityId: conversationId,
              actionType: "conversation.state_changed",
              serviceName: "webhook",
              payload: { from: conversationState, to: "COLLECTING_REQUIREMENTS" },
            });
          }

          // Accumulate chat notes
          const noteUpdate =
            conversationState === "COLLECTING_REQUIREMENTS" ||
            conversationState === "ON_HOLD_CUSTOMER_INPUT"
              ? messageText
              : undefined;

          if (noteUpdate) {
            // If there's an existing lead, append chat note
            const { data: existingLead } = await supabase
              .from("leads")
              .select("id, note_from_chat")
              .eq("conversation_id", conversationId)
              .order("created_at", { ascending: false })
              .limit(1)
              .single();

            if (existingLead) {
              const prevNote = existingLead.note_from_chat || "";
              await supabase
                .from("leads")
                .update({
                  note_from_chat: prevNote
                    ? `${prevNote}\n${noteUpdate}`
                    : noteUpdate,
                })
                .eq("id", existingLead.id);
            }
          }

          if (shouldOfferResumeOrFresh) {
            await replyWithResumeOrFreshChoice(event.replyToken, displayName);
          } else if (
            existingConv &&
            isTerminalConversationState(existingConv.state as WorkflowState)
          ) {
            await replyWithTerminalFollowUp(
              event.replyToken,
              displayName,
              existingConv.state as "COMPLETED" | "CANCELLED"
            );
          } else {
            await replyWithIntakeLink(event.replyToken, displayName);
          }
        }
      }

      // Handle follow event (user adds bot as friend)
      if (event.type === "follow") {
        const userId = event.source.userId;
        if (!userId) continue;

        try {
          const profile = await lineClient.getProfile(userId);
          await supabase
            .from("customers")
            .upsert(
              {
                line_user_id: userId,
                display_name: profile.displayName,
              },
              { onConflict: "line_user_id" }
            );
        } catch {
          // Ignore profile errors
        }
      }
    } catch (error) {
      // Log but don't fail — other events should still process
      console.error("Webhook event error:", error);
    }
  }

  // Always return 200 quickly to LINE
  return NextResponse.json({ status: "ok" });
}
