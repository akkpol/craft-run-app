type CommercialDocumentAppendixSource =
  | "lead_ai_generated_images"
  | "app_settings";

export type CommercialDocumentAppendixSnapshot = {
  image_url: string;
  image_name: string | null;
  source: CommercialDocumentAppendixSource;
};

type ResolveCommercialDocumentAppendixInput = {
  leadAiGeneratedImages?: unknown;
  documentAppendixImageUrl?: string | null;
  documentAppendixImageName?: string | null;
};

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function resolveCommercialDocumentAppendixSnapshot(
  input: ResolveCommercialDocumentAppendixInput
): CommercialDocumentAppendixSnapshot | null {
  const leadImageUrl = Array.isArray(input.leadAiGeneratedImages)
    ? input.leadAiGeneratedImages.find(
        (value): value is string => normalizeText(value).length > 0
      )
    : null;

  if (leadImageUrl) {
    return {
      image_url: normalizeText(leadImageUrl),
      image_name: null,
      source: "lead_ai_generated_images",
    };
  }

  const settingsImageUrl = normalizeText(input.documentAppendixImageUrl);
  if (!settingsImageUrl) {
    return null;
  }

  return {
    image_url: settingsImageUrl,
    image_name: normalizeText(input.documentAppendixImageName) || null,
    source: "app_settings",
  };
}
