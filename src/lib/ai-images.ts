import { createAdminClient } from "@/lib/supabase/admin";
import { getAiImageRuntimeConfig, type AppSettingsRow } from "@/lib/app-settings";

type LeadAiInput = {
  id: string;
  product_type: string | null;
  width_mm: number | null;
  height_mm: number | null;
  qty: number | null;
  note_from_form: string | null;
  reference_info: string | null;
  ai_image_prompt: string | null;
};

type OpenAiImageResponse = {
  data?: Array<{
    b64_json?: string;
    revised_prompt?: string;
    url?: string;
  }>;
  error?: {
    message?: string;
  };
};

const APP_ASSETS_BUCKET = "app-assets";

function buildPrompt(lead: LeadAiInput): string {
  const parts = [
    lead.ai_image_prompt?.trim(),
    lead.product_type ? `ประเภทงาน: ${lead.product_type}` : "",
    lead.width_mm && lead.height_mm
      ? `ขนาดงานประมาณ ${(lead.width_mm / 10).toFixed(1)} x ${(lead.height_mm / 10).toFixed(1)} ซม.`
      : "",
    lead.qty ? `จำนวน ${lead.qty} ชิ้น` : "",
    lead.note_from_form?.trim() ? `รายละเอียดจากลูกค้า: ${lead.note_from_form.trim()}` : "",
    lead.reference_info?.trim() ? `ข้อมูลอ้างอิง: ${lead.reference_info.trim()}` : "",
    "Create a polished Thai signage or print concept mockup, front-facing, realistic materials, readable layout, production-friendly composition.",
  ];

  return parts.filter(Boolean).join("\n");
}

async function uploadGeneratedImage(leadId: string, fileBytes: Uint8Array): Promise<string> {
  const supabase = createAdminClient();
  const filePath = `ai-previews/${leadId}/${Date.now()}.png`;
  const { error } = await supabase.storage
    .from(APP_ASSETS_BUCKET)
    .upload(filePath, fileBytes, {
      contentType: "image/png",
      upsert: false,
    });

  if (error) {
    throw new Error(error.message);
  }

  const { data } = supabase.storage.from(APP_ASSETS_BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
}

export async function generateLeadAiPreview(lead: LeadAiInput): Promise<string[]> {
  const aiConfig = await getAiImageRuntimeConfig();

  if (!aiConfig.enabled || !aiConfig.apiKey) {
    throw new Error("AI image generation is not configured");
  }

  if (aiConfig.provider !== "openai") {
    throw new Error("Unsupported AI image provider");
  }

  const prompt = buildPrompt(lead);
  if (!prompt) {
    throw new Error("Lead does not have an AI prompt");
  }

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${aiConfig.apiKey}`,
    },
    body: JSON.stringify({
      model: aiConfig.model,
      prompt,
      size: "1024x1024",
    }),
  });

  const payload = (await response.json()) as OpenAiImageResponse;
  if (!response.ok) {
    throw new Error(payload.error?.message || "AI image provider request failed");
  }

  const images = payload.data || [];
  if (images.length === 0) {
    throw new Error("AI image provider returned no images");
  }

  const uploadedUrls = await Promise.all(
    images.slice(0, 1).map(async (image) => {
      if (image.url) {
        return image.url;
      }

      if (!image.b64_json) {
        throw new Error("AI image provider response missing image data");
      }

      const fileBytes = Buffer.from(image.b64_json, "base64");
      return uploadGeneratedImage(lead.id, fileBytes);
    })
  );

  return uploadedUrls;
}

export function getAppAssetsBucketName(): string {
  return APP_ASSETS_BUCKET;
}

export type { LeadAiInput, AppSettingsRow };