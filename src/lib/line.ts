import {
  messagingApi,
  validateSignature,
  WebhookEvent,
} from "@line/bot-sdk";
import { getRuntimeAppConfig } from "@/lib/app-settings";
import { getLineLoginChannelIdFromLiffId } from "./line-liff-identity";
import type { ProductionEventType } from "@/lib/production-review";

export async function getLineClient() {
  const config = await getRuntimeAppConfig();
  return new messagingApi.MessagingApiClient({
    channelAccessToken: config.lineChannelAccessToken,
  });
}

export async function verifySignature(body: string, signature: string): Promise<boolean> {
  const config = await getRuntimeAppConfig();
  if (!config.lineChannelSecret) {
    return false;
  }

  return validateSignature(body, config.lineChannelSecret, signature);
}

export async function verifyLiffIdToken(idToken: string): Promise<{
  userId: string;
  displayName: string | null;
}> {
  const trimmedIdToken = idToken.trim();
  if (!trimmedIdToken) {
    throw new Error("Missing LIFF ID token");
  }

  const config = await getRuntimeAppConfig();
  const clientId = getLineLoginChannelIdFromLiffId(config.liffId);
  if (!clientId) {
    throw new Error("Missing or invalid LIFF ID configuration");
  }

  const response = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      id_token: trimmedIdToken,
      client_id: clientId,
    }),
    cache: "no-store",
  });

  let payload:
    | {
        sub?: unknown;
        name?: unknown;
        error_description?: unknown;
      }
    | null = null;

  try {
    payload = (await response.json()) as {
      sub?: unknown;
      name?: unknown;
      error_description?: unknown;
    };
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const description =
      typeof payload?.error_description === "string"
        ? payload.error_description
        : "LINE rejected the LIFF identity token";
    throw new Error(description);
  }

  const userId = typeof payload?.sub === "string" ? payload.sub.trim() : "";
  if (!userId) {
    throw new Error("LINE verification did not return a user ID");
  }

  return {
    userId,
    displayName:
      typeof payload?.name === "string" && payload.name.trim().length > 0
        ? payload.name.trim()
        : null,
  };
}

export async function parseLiffUrl(path: string): Promise<string> {
  const config = await getRuntimeAppConfig();
  const normalizedPath =
    !path || path.startsWith("/") || path.startsWith("?")
      ? path
      : `/${path}`;
  return `https://liff.line.me/${config.liffId}${normalizedPath}`;
}

async function buildLiffUrlWithMode(mode?: "resume" | "fresh"): Promise<string> {
  const path = mode ? `?mode=${mode}` : "";
  return parseLiffUrl(path);
}

async function buildLiffUrlWithMode(mode?: "resume" | "fresh"): Promise<string> {
  const path = mode ? `/intake?mode=${mode}` : "/intake";
  return parseLiffUrl(path);
}

// Reply with LIFF intake link + quick reply options
export async function replyWithIntakeLink(
  replyToken: string,
  displayName: string
) {
  const liffUrl = await buildLiffUrlWithMode("resume");
  const lineClient = await getLineClient();

  const bubble: messagingApi.FlexBubble = {
    type: "bubble",
    hero: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "🏭 FOGUS Print & Sign",
          weight: "bold",
          size: "lg",
          align: "center",
          color: "#1a1a2e",
        },
      ],
      paddingAll: "20px",
      backgroundColor: "#f0f0f5",
    },
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: `สวัสดีค่ะ คุณ${displayName}! 👋`,
          weight: "bold",
          size: "md",
          wrap: true,
        },
        {
          type: "text",
          text: "กรุณากรอกรายละเอียดงานที่ต้องการผ่านฟอร์มด้านล่างนะคะ เพื่อให้เราจัดเตรียมใบเสนอราคาให้ค่ะ",
          size: "sm",
          color: "#666666",
          margin: "md",
          wrap: true,
        },
      ],
      paddingAll: "16px",
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        {
          type: "button",
          style: "primary",
          height: "md",
          action: {
            type: "uri",
            label: "📋 กรอกรายละเอียดงาน",
            uri: liffUrl,
          },
          color: "#1a1a2e",
        },
        {
          type: "button",
          style: "secondary",
          height: "sm",
          action: {
            type: "message",
            label: "💬 คุยกับแอดมิน",
            text: "ขอคุยกับแอดมิน",
          },
        },
      ],
      paddingAll: "16px",
    },
  };

  const flexMessage: messagingApi.FlexMessage = {
    type: "flex",
    altText: "กรุณากรอกรายละเอียดงานที่ต้องการค่ะ",
    contents: bubble,
  };

  await lineClient.replyMessage({
    replyToken,
    messages: [flexMessage],
  });
}

export async function replyWithResumeOrFreshChoice(
  replyToken: string,
  displayName: string
) {
  const resumeUrl = await buildLiffUrlWithMode("resume");
  const freshUrl = await buildLiffUrlWithMode("fresh");
  const lineClient = await getLineClient();

  const bubble: messagingApi.FlexBubble = {
    type: "bubble",
    hero: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "FOGUS Workflow",
          weight: "bold",
          size: "lg",
          align: "center",
          color: "#0f172a",
        },
      ],
      paddingAll: "20px",
      backgroundColor: "#ecfeff",
    },
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: `สวัสดีค่ะ คุณ${displayName}`,
          weight: "bold",
          size: "md",
          wrap: true,
        },
        {
          type: "text",
          text: "ต้องการทำรายการเดิมต่อจากข้อมูลที่ค้างไว้ หรือเริ่มคำขอใหม่ตั้งแต่ต้นคะ",
          size: "sm",
          color: "#475569",
          margin: "md",
          wrap: true,
        },
        {
          type: "box",
          layout: "vertical",
          margin: "lg",
          spacing: "sm",
          contents: [
            {
              type: "text",
              text: "ทำรายการเดิมต่อ: ใช้ flow เดิมและเติมข้อมูลที่ยังขาด",
              size: "xs",
              color: "#0f766e",
              wrap: true,
            },
            {
              type: "text",
              text: "เริ่มงานใหม่: เปิดคำขอใหม่อีกชุดตั้งแต่ต้น",
              size: "xs",
              color: "#9a3412",
              wrap: true,
            },
          ],
        },
      ],
      paddingAll: "16px",
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        {
          type: "button",
          style: "primary",
          height: "md",
          action: {
            type: "uri",
            label: "ทำรายการเดิมต่อ",
            uri: resumeUrl,
          },
          color: "#0f766e",
        },
        {
          type: "button",
          style: "secondary",
          height: "md",
          action: {
            type: "uri",
            label: "เริ่มงานใหม่",
            uri: freshUrl,
          },
        },
        {
          type: "button",
          style: "secondary",
          height: "sm",
          action: {
            type: "message",
            label: "คุยกับแอดมิน",
            text: "ขอคุยกับแอดมิน",
          },
        },
      ],
      paddingAll: "16px",
    },
  };

  await lineClient.replyMessage({
    replyToken,
    messages: [
      {
        type: "flex",
        altText: "เลือกว่าจะทำรายการเดิมต่อหรือเริ่มงานใหม่",
        contents: bubble,
      },
    ],
  });
}

// Send quote link to customer via push message
export async function pushQuoteLink(
  userId: string,
  quoteToken: string,
  leadSummary: string
) {
  const config = await getRuntimeAppConfig();
  const lineClient = await getLineClient();
  const baseUrl = config.baseUrl;
  const quoteUrl = `${baseUrl}/quote/${quoteToken}`;

  const bubble: messagingApi.FlexBubble = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "📄 ใบเสนอราคา",
          weight: "bold",
          size: "lg",
        },
        {
          type: "text",
          text: leadSummary,
          size: "sm",
          color: "#666666",
          margin: "md",
          wrap: true,
        },
        {
          type: "text",
          text: "กรุณาตรวจสอบและอนุมัติใบเสนอราคา เมื่ออนุมัติแล้วทีมงานจะแจ้งขั้นตอนชำระเงินและเริ่มงานตามคิวให้ค่ะ",
          size: "sm",
          color: "#999999",
          margin: "md",
          wrap: true,
        },
      ],
      paddingAll: "16px",
    },
    footer: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "button",
          style: "primary",
          action: {
            type: "uri",
            label: "ดูใบเสนอราคา",
            uri: quoteUrl,
          },
          color: "#1a1a2e",
        },
      ],
      paddingAll: "16px",
    },
  };

  await lineClient.pushMessage({
    to: userId,
    messages: [
      {
        type: "flex",
        altText: "ใบเสนอราคาจาก FOGUS",
        contents: bubble,
      },
    ],
  });
}

function getCustomerStatusCopy(status: string, statusUrl: string): string {
  const statusCopy: Record<string, string> = {
    WAITING_PAYMENT:
      `💳 งานได้รับการยืนยันแล้ว\nกรุณารอทีมงานแจ้งยอดและยืนยันการชำระเงินก่อนเริ่มงาน\n\nดูสถานะงาน: ${statusUrl}`,
    IN_DESIGN:
      `🎨 ทีมออกแบบกำลังจัดทำแบบให้ค่ะ\nหากมีข้อมูลหรือไฟล์เพิ่มเติม สามารถส่งกลับมาในแชต LINE ได้เลย\n\nดูสถานะงาน: ${statusUrl}`,
    IN_PRODUCTION:
      `🏭 งานเข้าสู่ขั้นตอนผลิตแล้ว\nทีมงานกำลังดำเนินการตามแบบที่อนุมัติไว้ค่ะ\n\nดูสถานะงาน: ${statusUrl}`,
    READY_FOR_FULFILLMENT:
      `✅ งานผ่าน QC แล้วและพร้อมส่งมอบ\nทีมงานจะนัดรับงานหรือจัดส่งให้ตามรูปแบบที่เลือกไว้ค่ะ\n\nดูสถานะงาน: ${statusUrl}`,
    ON_HOLD_CUSTOMER_INPUT:
      `📝 งานรอข้อมูลเพิ่มเติมจากลูกค้า\nเมื่อส่งข้อมูลครบแล้ว ทีมงานจะเดินงานต่อให้ทันทีค่ะ\n\nดูสถานะงาน: ${statusUrl}`,
    HUMAN_REVIEW_REQUIRED:
      `🙋 ทีมงานกำลังตรวจสอบรายละเอียดเพิ่มเติม\nหากต้องมีการยืนยันข้อมูลเพิ่มเติม เราจะติดต่อกลับทาง LINE ค่ะ\n\nดูสถานะงาน: ${statusUrl}`,
    COMPLETED:
      `🎉 งานเสร็จสมบูรณ์แล้ว\nหากเป็นรับที่หน้าร้าน กรุณานัดรับงานได้เลย และหากเป็นจัดส่ง ทีมงานได้ดำเนินการส่งมอบเรียบร้อยค่ะ\n\nดูสถานะงาน: ${statusUrl}`,
    CANCELLED:
      `❌ งานถูกยกเลิกแล้ว\nหากต้องการเริ่มรายการใหม่หรือสอบถามเพิ่มเติม สามารถทักหาเราได้ทาง LINE ค่ะ\n\nดูสถานะงาน: ${statusUrl}`,
  };

  return statusCopy[status] || `📋 มีการอัปเดตสถานะงาน\nสถานะล่าสุด: ${status}\n\nดูสถานะงาน: ${statusUrl}`;
}

function getProductionEventLabel(eventType: ProductionEventType): string {
  if (eventType === "ready_for_production") {
    return "หลักฐานก่อนเริ่มผลิต";
  }

  if (eventType === "completed") {
    return "หลักฐานงานเสร็จ";
  }

  return "หลักฐาน proof";
}

// Send status update to customer
export async function pushStatusUpdate(
  userId: string,
  status: string,
  statusToken: string
) {
  const config = await getRuntimeAppConfig();
  const lineClient = await getLineClient();
  const baseUrl = config.baseUrl;
  const statusUrl = `${baseUrl}/status/${statusToken}`;

  const textMsg: messagingApi.TextMessage = {
    type: "text",
    text: getCustomerStatusCopy(status, statusUrl),
  };

  await lineClient.pushMessage({
    to: userId,
    messages: [textMsg],
  });
}

export async function pushProductionEvidenceUpdate(input: {
  userId: string;
  statusToken: string;
  eventType: ProductionEventType;
  note?: string | null;
  assetUrls: string[];
}) {
  const config = await getRuntimeAppConfig();
  const lineClient = await getLineClient();
  const baseUrl = config.baseUrl;
  const statusUrl = `${baseUrl}/status/${input.statusToken}`;
  const assetLines = input.assetUrls
    .slice(0, 3)
    .map((url, index) => `${index + 1}. ${url}`)
    .join("\n");

  const text = [
    `📷 มี${getProductionEventLabel(input.eventType)}จากทีมงาน`,
    input.note ? `หมายเหตุ: ${input.note}` : null,
    assetLines ? `ไฟล์แนบ:\n${assetLines}` : null,
    `ดูสถานะงาน: ${statusUrl}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  await lineClient.pushMessage({
    to: input.userId,
    messages: [
      {
        type: "text",
        text,
      },
    ],
  });
}

export type { WebhookEvent };
