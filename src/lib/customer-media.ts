import { randomUUID } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  getDefaultCustomerMediaBucket,
  removeCustomerMediaObjects,
  signCustomerMediaAssetLocators,
  type CustomerMediaAssetLocator,
  type CustomerMediaStorageProvider,
  uploadCustomerMediaObject,
} from "./customer-media-storage";
import { buildLeadCustomerReferenceStoragePath } from "./asset-storage-paths";

type AdminClient = ReturnType<typeof createAdminClient>;

export const CUSTOMER_MEDIA_BUCKET = getDefaultCustomerMediaBucket();
export const MAX_CUSTOMER_MEDIA_FILES = 5;
export const MAX_CUSTOMER_MEDIA_FILE_SIZE = 10 * 1024 * 1024;

const SIGNED_CUSTOMER_MEDIA_URL_TTL_SECONDS = 60 * 60 * 24;
const ALLOWED_CUSTOMER_MEDIA_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

export type LeadMediaAssetRow = {
  id: string;
  lead_id: string;
  storage_path: string;
  storage_provider?: CustomerMediaStorageProvider | null;
  storage_bucket?: string | null;
  original_file_name: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  created_at: string;
  signed_url?: string | null;
};

export function validateCustomerMediaFiles(files: File[]) {
  if (files.length > MAX_CUSTOMER_MEDIA_FILES) {
    throw new Error(`อัปโหลดได้สูงสุด ${MAX_CUSTOMER_MEDIA_FILES} ไฟล์ต่อคำขอ`);
  }

  for (const file of files) {
    if (file.size > MAX_CUSTOMER_MEDIA_FILE_SIZE) {
      throw new Error("ไฟล์ใหญ่เกิน 10MB กรุณาลดขนาดรูปแล้วลองใหม่");
    }

    // Reject files with missing MIME type to avoid upload failures
    if (!file.type) {
      throw new Error("ไฟล์ต้องมีประเภทที่ชัดเจน กรุณาเลือกไฟล์ใหม่");
    }

    if (!ALLOWED_CUSTOMER_MEDIA_TYPES.has(file.type)) {
      throw new Error("รองรับเฉพาะรูปภาพ PNG, JPG, WEBP, HEIC, HEIF หรือ PDF");
    }
  }
}

export async function uploadLeadMediaFiles({
  supabase,
  leadId,
  files,
}: {
  supabase: AdminClient;
  leadId: string;
  files: File[];
}) {
  validateCustomerMediaFiles(files);

  if (files.length === 0) {
    return [];
  }

  const createdAt = new Date().toISOString();
  const uploadedAssets: CustomerMediaAssetLocator[] = [];
  const insertedAssetIds: string[] = [];

  try {
    const assetRows: LeadMediaAssetRow[] = [];

    for (const file of files) {
      const storagePath = buildLeadCustomerReferenceStoragePath(leadId, file.name);
      const bytes = new Uint8Array(await file.arrayBuffer());
      const uploadedAsset = await uploadCustomerMediaObject({
        supabase,
        storagePath,
        bytes,
        contentType: file.type || "application/octet-stream",
      });

      uploadedAssets.push(uploadedAsset);
      const assetId = randomUUID();
      insertedAssetIds.push(assetId);
      assetRows.push({
        id: assetId,
        lead_id: leadId,
        storage_path: storagePath,
        storage_provider: uploadedAsset.storage_provider,
        storage_bucket: uploadedAsset.storage_bucket,
        original_file_name: file.name || null,
        mime_type: file.type,
        file_size_bytes: file.size,
        created_at: createdAt,
      });
    }

    const { error: assetInsertError } = await supabase
      .from("lead_media_assets")
      .insert(assetRows);

    if (assetInsertError) {
      throw new Error(assetInsertError.message);
    }

    return assetRows;
  } catch (error) {
    // Clean up only the files and DB rows from this failed request
    if (uploadedAssets.length > 0) {
      await removeCustomerMediaObjects({
        supabase,
        assets: uploadedAssets,
      });
    }

    if (insertedAssetIds.length > 0) {
      await supabase.from("lead_media_assets").delete().in("id", insertedAssetIds);
    }
    throw error;
  }
}

function normalizeLeadMediaAssetInputs(
  assetsOrPaths: Array<
    string | Pick<LeadMediaAssetRow, "storage_path" | "storage_provider" | "storage_bucket">
  >
): CustomerMediaAssetLocator[] {
  return assetsOrPaths.map((assetOrPath) => {
    if (typeof assetOrPath === "string") {
      return {
        storage_path: assetOrPath,
        storage_provider: "supabase",
        storage_bucket: CUSTOMER_MEDIA_BUCKET,
      };
    }

    return {
      storage_path: assetOrPath.storage_path,
      storage_provider: assetOrPath.storage_provider,
      storage_bucket: assetOrPath.storage_bucket,
    };
  });
}

export async function signLeadMediaAssetPaths(
  supabase: AdminClient,
  assetsOrPaths: Array<
    string | Pick<LeadMediaAssetRow, "storage_path" | "storage_provider" | "storage_bucket">
  >
): Promise<Record<string, string>> {
  const assets = normalizeLeadMediaAssetInputs(assetsOrPaths);

  return signCustomerMediaAssetLocators({
    supabase,
    assets,
    expiresIn: SIGNED_CUSTOMER_MEDIA_URL_TTL_SECONDS,
  });
}
