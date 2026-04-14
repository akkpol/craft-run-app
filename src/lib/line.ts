import {
  messagingApi,
  validateSignature,
  WebhookEvent,
} from "@line/bot-sdk";

const config = {
  channelSecret: process.env.LINE_CHANNEL_SECRET!,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!,
};

export const lineClient = new messagingApi.MessagingApiClient({
  channelAccessToken: config.channelAccessToken,
});

export function verifySignature(body: string, signature: string): boolean {
  return validateSignature(body, config.channelSecret, signature);
}

export function parseLiffUrl(path: string): string {
  return `https://liff.line.me/${process.env.LIFF_ID}${path}`;
}

// Reply with LIFF intake link + quick reply options
export async function replyWithIntakeLink(
  replyToken: string,
  displayName: string
) {
  const liffUrl = parseLiffUrl("/intake");

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

// Send quote link to customer via push message
export async function pushQuoteLink(
  userId: string,
  quoteToken: string,
  leadSummary: string
) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
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
          text: "กรุณาตรวจสอบและอนุมัติใบเสนอราคาค่ะ",
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

// Send status update to customer
export async function pushStatusUpdate(
  userId: string,
  status: string,
  statusToken: string
) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const statusLabels: Record<string, string> = {
    JOB_CREATED: "✅ สร้างงานเรียบร้อย",
    IN_PROGRESS: "🔧 กำลังดำเนินการ",
    COMPLETED: "🎉 งานเสร็จสมบูรณ์",
  };

  const label = statusLabels[status] || `📋 สถานะ: ${status}`;

  const textMsg: messagingApi.TextMessage = {
    type: "text",
    text: `${label}\n\nดูสถานะงาน: ${baseUrl}/status/${statusToken}`,
  };

  await lineClient.pushMessage({
    to: userId,
    messages: [textMsg],
  });
}

export type { WebhookEvent };
