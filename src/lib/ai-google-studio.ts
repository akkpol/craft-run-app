import { createAdminClient } from "@/lib/supabase/admin";
import { buildLeadAiPreviewStoragePath } from "@/lib/asset-storage-paths";

type GoogleImageResponse = {
  predictions?: Array<{
    bytesBase64Encoded: string;
    mimeType?: string;
  }>;
  error?: {
    message: string;
    code?: number;
    status?: string;
  };
};

const APP_ASSETS_BUCKET = "app-assets";

async function uploadGeneratedImage(
  leadId: string,
  fileBytes: Uint8Array,
  contentType = "image/jpeg"
): Promise<string> {
  const supabase = createAdminClient();
  const filePath = buildLeadAiPreviewStoragePath(leadId, "jpg");

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

export async function generateGoogleAiStudioImage(params: {
  leadId: string;
  prompt: string;
  apiKey: string;
  model: string;
}): Promise<string[]> {
  const { leadId, prompt, apiKey, model } = params;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: {
        sampleCount: 1,
      },
    }),
  });

  const payload = (await response.json()) as GoogleImageResponse;

  if (!response.ok) {
    throw new Error(payload.error?.message || "Google AI Studio image generation failed");
  }

  const predictions = payload.predictions || [];
  if (predictions.length === 0) {
    throw new Error("Google AI Studio returned no images");
  }

  const uploadedUrls = await Promise.all(
    predictions.slice(0, 1).map(async (prediction) => {
      const fileBytes = Buffer.from(prediction.bytesBase64Encoded, "base64");
      return uploadGeneratedImage(leadId, fileBytes);
    })
  );

  return uploadedUrls;
}
