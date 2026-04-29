import {
  messagingApi,
  validateSignature,
  WebhookEvent,
} from "@line/bot-sdk";
import { getRuntimeAppConfig } from "@/lib/app-settings";
import { getLineLoginChannelIdFromLiffId } from "./line-liff-identity";
import type { ProductionEventType } from "@/lib/production-review";
import type { WorkflowState } from "@/lib/types";

type VerifyIdTokenResponse = {
  sub?: unknown;
  name?: unknown;
  picture?: unknown;
  email?: unknown;
  auth_time?: unknown;
  amr?: unknown;
  error_description?: unknown;
};

type VerifyAccessTokenResponse = {
  scope?: unknown;
  client_id?: unknown;
  expires_in?: unknown;
  error_description?: unknown;
};

type LineProfileResponse = {
  userId?: unknown;
  displayName?: unknown;
  pictureUrl?: unknown;
  statusMessage?: unknown;
};

type FriendshipStatusResponse = {
  friendFlag?: unknown;
};

function normalizeText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function normalizeStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => normalizeText(entry))
      .filter((entry): entry is string => Boolean(entry));
  }

  if (typeof value === "string") {
    return value
      .split(/\s+/)
      .map((entry) => normalizeText(entry))
      .filter((entry): entry is string => Boolean(entry));
  }

  return [];
}

async function readJsonResponse<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

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
  pictureUrl: string | null;
  email: string | null;
  authTime: number | null;
  amr: string[];
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

  const payload = await readJsonResponse<VerifyIdTokenResponse>(response);

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
    pictureUrl: normalizeText(payload?.picture),
    email: normalizeText(payload?.email),
    authTime:
      typeof payload?.auth_time === "number" && Number.isFinite(payload.auth_time)
        ? payload.auth_time
        : null,
    amr: normalizeStringList(payload?.amr),
  };
}

export async function getVerifiedLiffAccessProfile(
  accessToken: string,
  expectedUserId?: string | null
): Promise<{
  userId: string;
  displayName: string | null;
  pictureUrl: string | null;
  statusMessage: string | null;
  friendshipStatus: boolean | null;
  scope: string[];
  expiresIn: number | null;
}> {
  const trimmedAccessToken = accessToken.trim();
  if (!trimmedAccessToken) {
    throw new Error("Missing LIFF access token");
  }

  const config = await getRuntimeAppConfig();
  const clientId = getLineLoginChannelIdFromLiffId(config.liffId);
  if (!clientId) {
    throw new Error("Missing or invalid LIFF ID configuration");
  }

  const verifyResponse = await fetch(
    `https://api.line.me/oauth2/v2.1/verify?${new URLSearchParams({
      access_token: trimmedAccessToken,
    }).toString()}`,
    {
      cache: "no-store",
    }
  );
  const verifyPayload = await readJsonResponse<VerifyAccessTokenResponse>(
    verifyResponse
  );

  if (!verifyResponse.ok) {
    const description =
      typeof verifyPayload?.error_description === "string"
        ? verifyPayload.error_description
        : "LINE rejected the LIFF access token";
    throw new Error(description);
  }

  if (normalizeText(verifyPayload?.client_id) !== clientId) {
    throw new Error("LIFF access token was issued for a different LINE channel");
  }

  const profileResponse = await fetch("https://api.line.me/v2/profile", {
    headers: {
      Authorization: `Bearer ${trimmedAccessToken}`,
    },
    cache: "no-store",
  });
  const profilePayload = await readJsonResponse<LineProfileResponse>(
    profileResponse
  );

  if (!profileResponse.ok) {
    throw new Error("Failed to load LINE profile from LIFF access token");
  }

  const userId = normalizeText(profilePayload?.userId);
  if (!userId) {
    throw new Error("LINE profile response did not include a user ID");
  }

  if (expectedUserId && expectedUserId.trim() && expectedUserId !== userId) {
    throw new Error("LIFF access token user does not match the verified ID token user");
  }

  let friendshipStatus: boolean | null = null;
  const friendshipResponse = await fetch(
    "https://api.line.me/friendship/v1/status",
    {
      headers: {
        Authorization: `Bearer ${trimmedAccessToken}`,
      },
      cache: "no-store",
    }
  );

  if (friendshipResponse.ok) {
    const friendshipPayload =
      await readJsonResponse<FriendshipStatusResponse>(friendshipResponse);
    friendshipStatus =
      typeof friendshipPayload?.friendFlag === "boolean"
        ? friendshipPayload.friendFlag
        : null;
  }

  return {
    userId,
    displayName: normalizeText(profilePayload?.displayName),
    pictureUrl: normalizeText(profilePayload?.pictureUrl),
    statusMessage: normalizeText(profilePayload?.statusMessage),
    friendshipStatus,
    scope: normalizeStringList(verifyPayload?.scope),
    expiresIn:
      typeof verifyPayload?.expires_in === "number" &&
      Number.isFinite(verifyPayload.expires_in)
        ? verifyPayload.expires_in
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

export async function pushLeadDesignPreviewUpdate(input: {
  userId: string;
  statusToken: string;
  note?: string | null;
  assetUrls: string[];
}) {
  const config = await getRuntimeAppConfig();
  const lineClient = await getLineClient();
  const statusUrl = `${config.baseUrl}/status/${input.statusToken}`;
  const assetLines = input.assetUrls
    .slice(0, 3)
    .map((url, index) => `${index + 1}. ${url}`)
    .join("\n");

  const text = [
    "🎨 ทีมงานส่งแบบให้ตรวจแล้ว",
    input.note ? `หมายเหตุ: ${input.note}` : null,
    assetLines ? `ไฟล์ตัวอย่าง:\n${assetLines}` : null,
    `ดูสถานะงานและตอบกลับทีมงาน: ${statusUrl}`,
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

export async function pushFollowUpMessage(
  userId: string,
  conversationState: string,
  displayName?: string | null
): Promise<void> {
  const lineClient = await getLineClient();
  const name = displayName ? ` คุณ${displayName}` : "";

  let text: string;
  if (conversationState === "WAITING_QUOTE_APPROVAL") {
    text = [
      `สวัสดีครับ${name} 👋`,
      "ทางร้าน FOGUS ได้ส่งใบเสนอราคาให้คุณแล้ว",
      "หากมีข้อสงสัยหรือต้องการแก้ไข สามารถแจ้งได้เลยนะครับ 😊",
    ].join("\n\n");
  } else if (conversationState === "ON_HOLD_CUSTOMER_INPUT") {
    text = [
      `สวัสดีครับ${name} 👋`,
      "เราได้รับข้อมูลจากคุณแล้ว แต่ยังขาดรายละเอียดบางส่วน",
      "กรุณาส่งข้อมูลที่ขาดกลับมาเพื่อให้เราดำเนินการต่อได้ครับ 🙏",
    ].join("\n\n");
  } else {
    text = `สวัสดีครับ${name} 👋 ทีมงาน FOGUS ติดตามงานของคุณอยู่นะครับ หากมีข้อสงสัยสอบถามได้เลยครับ 😊`;
  }

  await lineClient.pushMessage({
    to: userId,
    messages: [{ type: "text", text }],
  });
}

// ── Returning-customer context replies ─────────────────────────────────────

/**
 * Reply when the customer messages while a quote is awaiting their approval.
 * Uses a Flex bubble with a direct link to /quote/[quoteToken].
 * Falls back to plain text + quick reply when quoteToken is not available.
 */
export async function replyWithQuoteApprovalContext(
  replyToken: string,
  displayName: string,
  quoteToken: string | null
): Promise<void> {
  const lineClient = await getLineClient();

  if (!quoteToken) {
    await lineClient.replyMessage({
      replyToken,
      messages: [
        {
          type: "text",
          text: `สวัสดีค่ะ คุณ${displayName} ✉️\nขณะนี้มีใบเสนอราคารอการยืนยันจากคุณอยู่ค่ะ กรุณาติดต่อทีมงานเพื่อขอลิงก์ใบเสนอราคาค่ะ`,
          quickReply: {
            items: [
              {
                type: "action",
                action: { type: "message", label: "💬 คุยกับแอดมิน", text: "ขอคุยกับแอดมิน" },
              },
            ],
          },
        },
      ],
    });
    return;
  }

  const config = await getRuntimeAppConfig();
  const quoteUrl = `${config.baseUrl}/quote/${quoteToken}`;
  const freshUrl = await buildLiffUrlWithMode("fresh");

  const bubble: messagingApi.FlexBubble = {
    type: "bubble",
    hero: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "📄 ใบเสนอราคารอการยืนยัน",
          weight: "bold",
          size: "md",
          align: "center",
          color: "#0f172a",
        },
      ],
      paddingAll: "20px",
      backgroundColor: "#fef9c3",
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
          text: "ขณะนี้มีใบเสนอราคาจากทีมงาน FOGUS รอการยืนยันจากคุณอยู่ค่ะ กรุณาตรวจสอบและยืนยันเพื่อดำเนินการต่อค่ะ",
          size: "sm",
          color: "#475569",
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
            label: "📄 ดูใบเสนอราคา",
            uri: quoteUrl,
          },
          color: "#1a1a2e",
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
            label: "💬 คุยกับแอดมิน",
            text: "ขอคุยกับแอดมิน",
          },
        },
      ],
      paddingAll: "16px",
    },
  };

  await lineClient.replyMessage({
    replyToken,
    messages: [{ type: "flex", altText: "ใบเสนอราคาจาก FOGUS รอการยืนยันค่ะ", contents: bubble }],
  });
}

/**
 * Reply when the customer messages while the conversation is at WAITING_PAYMENT.
 * Shows a link to /status/[quoteToken] and an option to contact admin.
 */
export async function replyWithPaymentContext(
  replyToken: string,
  displayName: string,
  quoteToken: string | null
): Promise<void> {
  const lineClient = await getLineClient();

  if (!quoteToken) {
    await lineClient.replyMessage({
      replyToken,
      messages: [
        {
          type: "text",
          text: `สวัสดีค่ะ คุณ${displayName} 💳\nงานของคุณรอการยืนยันการชำระเงินอยู่ค่ะ กรุณาติดต่อทีมงานเพื่อสอบถามรายละเอียดการชำระเงินค่ะ`,
          quickReply: {
            items: [
              {
                type: "action",
                action: { type: "message", label: "💬 คุยกับแอดมิน", text: "ขอคุยกับแอดมิน" },
              },
            ],
          },
        },
      ],
    });
    return;
  }

  const config = await getRuntimeAppConfig();
  const statusUrl = `${config.baseUrl}/status/${quoteToken}`;

  const bubble: messagingApi.FlexBubble = {
    type: "bubble",
    hero: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "💳 รอการยืนยันการชำระเงิน",
          weight: "bold",
          size: "md",
          align: "center",
          color: "#0f172a",
        },
      ],
      paddingAll: "20px",
      backgroundColor: "#dcfce7",
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
          text: "ใบเสนอราคาได้รับการอนุมัติแล้ว ขณะนี้รอการยืนยันการชำระเงินก่อนเริ่มดำเนินการค่ะ ทีมงานจะแจ้งรายละเอียดให้ทราบค่ะ",
          size: "sm",
          color: "#475569",
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
            label: "📊 ดูสถานะงาน",
            uri: statusUrl,
          },
          color: "#166534",
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

  await lineClient.replyMessage({
    replyToken,
    messages: [{ type: "flex", altText: "งานรอยืนยันการชำระเงินค่ะ", contents: bubble }],
  });
}

const PRODUCTION_STATE_HEADERS: Partial<Record<WorkflowState, string>> = {
  IN_DESIGN: "🎨 อยู่ในขั้นตอนออกแบบ",
  IN_PRODUCTION: "🏭 อยู่ในขั้นตอนผลิต",
  READY_FOR_FULFILLMENT: "✅ งานพร้อมส่งมอบแล้ว",
};

/**
 * Reply when the customer messages during a production-stage conversation.
 * Replaces the previous plain-text handler with a Flex bubble that includes
 * a direct link to the status page when the quoteToken is available.
 */
export async function replyWithProductionStatus(
  replyToken: string,
  displayName: string,
  quoteToken: string | null,
  conversationState: WorkflowState
): Promise<void> {
  const lineClient = await getLineClient();
  const header = PRODUCTION_STATE_HEADERS[conversationState] ?? "📋 งานกำลังดำเนินการ";

  if (!quoteToken) {
    await lineClient.replyMessage({
      replyToken,
      messages: [
        {
          type: "text",
          text: `สวัสดีค่ะ คุณ${displayName} ${header}\nหากต้องการสอบถามเพิ่มเติม สามารถพิมพ์ "คุยกับแอดมิน" ได้เลยค่ะ`,
          quickReply: {
            items: [
              {
                type: "action",
                action: { type: "message", label: "💬 คุยกับแอดมิน", text: "ขอคุยกับแอดมิน" },
              },
            ],
          },
        },
      ],
    });
    return;
  }

  const config = await getRuntimeAppConfig();
  const statusUrl = `${config.baseUrl}/status/${quoteToken}`;

  const bubble: messagingApi.FlexBubble = {
    type: "bubble",
    hero: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: header,
          weight: "bold",
          size: "md",
          align: "center",
          color: "#0f172a",
        },
      ],
      paddingAll: "20px",
      backgroundColor: "#e0f2fe",
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
          text: "ขอบคุณที่ติดต่อมาค่ะ สามารถติดตามความคืบหน้าได้ที่หน้าสถานะงาน หรือพิมพ์ \"คุยกับแอดมิน\" หากต้องการสอบถามเพิ่มเติมค่ะ",
          size: "sm",
          color: "#475569",
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
            label: "📊 ดูสถานะงาน",
            uri: statusUrl,
          },
          color: "#0369a1",
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

  await lineClient.replyMessage({
    replyToken,
    messages: [{ type: "flex", altText: `${header} — ดูสถานะงานที่นี่ค่ะ`, contents: bubble }],
  });
}

/**
 * Reply when a customer whose most-recent conversation was COMPLETED or CANCELLED
 * sends a new message. Acknowledges the closed job and offers a fresh intake.
 */
export async function replyWithTerminalFollowUp(
  replyToken: string,
  displayName: string,
  previousState: "COMPLETED" | "CANCELLED"
): Promise<void> {
  const freshUrl = await buildLiffUrlWithMode("fresh");
  const lineClient = await getLineClient();

  const isPrevCompleted = previousState === "COMPLETED";
  const heroText = isPrevCompleted
    ? "🎉 งานก่อนหน้าเสร็จสมบูรณ์แล้ว"
    : "📌 งานก่อนหน้าถูกยกเลิกแล้ว";
  const bodyText = isPrevCompleted
    ? "ยินดีที่ได้รับใช้ค่ะ หากต้องการสั่งงานใหม่สามารถกดเริ่มงานใหม่ได้เลยค่ะ"
    : "หากต้องการเริ่มรายการใหม่สามารถกดเริ่มงานใหม่ได้เลย หรือติดต่อทีมงานเพื่อสอบถามเพิ่มเติมค่ะ";
  const heroBg = isPrevCompleted ? "#dcfce7" : "#fee2e2";

  const bubble: messagingApi.FlexBubble = {
    type: "bubble",
    hero: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: heroText,
          weight: "bold",
          size: "md",
          align: "center",
          color: "#0f172a",
        },
      ],
      paddingAll: "20px",
      backgroundColor: heroBg,
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
          text: bodyText,
          size: "sm",
          color: "#475569",
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
            label: "📋 เริ่มงานใหม่",
            uri: freshUrl,
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

  await lineClient.replyMessage({
    replyToken,
    messages: [{ type: "flex", altText: heroText, contents: bubble }],
  });
}
export type { WebhookEvent };
