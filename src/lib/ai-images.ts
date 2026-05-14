import { createAdminClient } from "@/lib/supabase/admin";
import { getAiImageRuntimeConfig, type AppSettingsRow } from "@/lib/app-settings";
import { buildLeadAiPreviewStoragePath } from "@/lib/asset-storage-paths";
import { uploadPublicObjectToR2 } from "@/lib/customer-media-storage";
import { generateGoogleAiStudioImage } from "./ai-google-studio";

type LeadAiGenerationInput = {
  leadId: string;
  prompt: string;
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

function getImageExtensionFromContentType(contentType: string | null | undefined) {
  if (!contentType) {
    return "png";
  }

  if (contentType.includes("png")) {
    return "png";
  }

  if (contentType.includes("jpeg") || contentType.includes("jpg")) {
    return "jpg";
  }

  if (contentType.includes("webp")) {
    return "webp";
  }

  return "png";
}

async function uploadGeneratedImage(
  leadId: string,
  fileBytes: Uint8Array,
  contentType = "image/png"
): Promise<string> {
  const filePath = buildLeadAiPreviewStoragePath(
    leadId,
    getImageExtensionFromContentType(contentType)
  );

  // Prefer R2 public bucket: free egress + stable URL (required for LINE push messages).
  // Falls back to Supabase app-assets when CLOUDFLARE_R2_* or CLOUDFLARE_R2_PUBLIC_URL
  // env vars are not set.
  const r2Url = await uploadPublicObjectToR2({
    storagePath: filePath,
    bytes: fileBytes,
    contentType,
  });
  if (r2Url) return r2Url;

  // Fallback: Supabase app-assets (dev/environments without R2 configured).
  const supabase = createAdminClient();
  const { error } = await supabase.storage
    .from(APP_ASSETS_BUCKET)
    .upload(filePath, fileBytes, {
      contentType,
      upsert: false,
    });

  if (error) {
    throw new Error(error.message);
  }

  const { data } = supabase.storage.from(APP_ASSETS_BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
}

async function downloadRemoteGeneratedImage(url: string) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("AI image provider returned an unusable image URL");
  }

  return {
    bytes: new Uint8Array(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") || "image/png",
  };
}

export async function generateLeadAiPreview(
  input: LeadAiGenerationInput
): Promise<string[]> {
  const aiConfig = await getAiImageRuntimeConfig();

  if (!aiConfig.enabled || !aiConfig.apiKey) {
    if (process.env.NODE_ENV !== "production") {
      const promptLower = input.prompt.toLowerCase();
      const stubKey = /sticker|สติ๊?กเกอร/.test(promptLower) ? "sticker" : "vinyl";
      return [`http://localhost:3000/test-fixtures/ai-preview-sample-${stubKey}.svg`];
    }
    throw new Error("AI image generation is not configured");
  }

  const prompt = input.prompt.trim();
  if (!prompt) {
    throw new Error("Lead does not have an AI prompt");
  }

  if (aiConfig.provider === "google") {
    return generateGoogleAiStudioImage({
      leadId: input.leadId,
      prompt,
      apiKey: aiConfig.apiKey,
      model: aiConfig.model,
    });
  }

  if (aiConfig.provider !== "openai") {
    throw new Error("Unsupported AI image provider");
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
        const downloadedImage = await downloadRemoteGeneratedImage(image.url);
        return uploadGeneratedImage(
          input.leadId,
          downloadedImage.bytes,
          downloadedImage.contentType
        );
      }

      if (!image.b64_json) {
        throw new Error("AI image provider response missing image data");
      }

      const fileBytes = Buffer.from(image.b64_json, "base64");
      return uploadGeneratedImage(input.leadId, fileBytes);
    })
  );

  return uploadedUrls;
}

export function getAppAssetsBucketName(): string {
  return APP_ASSETS_BUCKET;
}

export type { LeadAiGenerationInput, AppSettingsRow };