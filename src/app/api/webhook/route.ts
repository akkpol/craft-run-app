import { NextRequest, NextResponse } from "next/server";
import { verifySignature, replyWithIntakeLink, getLineClient } from "@/lib/line";
import { createAdminClient } from "@/lib/supabase/admin";
import type { WebhookEvent } from "@line/bot-sdk";
import { canTransitionConversationState } from "@/lib/workflow-transitions";
import { isWorkflowState } from "@/lib/types";

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

  const supabase = createAdminClient();
  const lineClient = await getLineClient();

  // 3. Process each event — keep it lean and fast
  for (const event of body.events) {
    try {
      if (event.type === "message" && event.message.type === "text") {
        const userId = event.source.userId;
        if (!userId) continue;

        const messageText = event.message.text;

        // 3a. Upsert conversation
        const { data: existingConv } = await supabase
          .from("conversations")
          .select("id, state")
          .eq("line_user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        let conversationId: string;

        if (existingConv) {
          conversationId = existingConv.id;
          await supabase
            .from("conversations")
            .update({ last_message_at: new Date().toISOString() })
            .eq("id", conversationId);
        } else {
          const { data: newConv } = await supabase
            .from("conversations")
            .insert({ line_user_id: userId, state: "NEW_MESSAGE" })
            .select("id")
            .single();
          conversationId = newConv!.id;
        }

        // 3b. Save raw message (always first, before reply)
        await supabase.from("messages").insert({
          conversation_id: conversationId,
          sender_type: "user",
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
            existingConv?.state &&
            isWorkflowState(existingConv.state) &&
            existingConv.state !== "HUMAN_REVIEW_REQUIRED" &&
            !canTransitionConversationState(
              existingConv.state,
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

        if (existingConv?.state === "HUMAN_REVIEW_REQUIRED") {
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

        // 3e. Reply with LIFF intake link
        if (event.replyToken) {
          // Update state to COLLECTING_REQUIREMENTS
          if (
            !existingConv?.state ||
            existingConv.state === "COLLECTING_REQUIREMENTS" ||
            (isWorkflowState(existingConv.state) &&
            canTransitionConversationState(
              existingConv.state,
              "COLLECTING_REQUIREMENTS"
            ))
          ) {
            await supabase
              .from("conversations")
              .update({ state: "COLLECTING_REQUIREMENTS" })
              .eq("id", conversationId);
          }

          // Accumulate chat notes
          const noteUpdate =
            existingConv?.state === "COLLECTING_REQUIREMENTS" ||
            existingConv?.state === "ON_HOLD_CUSTOMER_INPUT"
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

          await replyWithIntakeLink(event.replyToken, displayName);
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
