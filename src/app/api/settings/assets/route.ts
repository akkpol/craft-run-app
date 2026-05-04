import { NextRequest, NextResponse } from "next/server";
import { APP_SETTINGS_ID } from "@/lib/app-settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppAssetsBucketName } from "@/lib/ai-images";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const DOCUMENT_APPENDIX_SCHEMA_ERROR =
  "Database schema is missing document appendix settings columns. Run migration 20260504042703_add_document_appendix_settings.sql before uploading a document appendix image.";

function getFieldForAssetType(assetType: string): { urlField: string; nameField?: string; folder: string } | null {
  if (assetType === "logo") {
    return { urlField: "business_logo_url", folder: "branding/logo" };
  }

  if (assetType === "catalog") {
    return {
      urlField: "business_catalog_url",
      nameField: "business_catalog_name",
      folder: "branding/catalog",
    };
  }

  if (assetType === "paymentQr") {
    return { urlField: "payment_qr_code_url", folder: "payment/qr" };
  }

  if (assetType === "paymentSecondaryQr") {
    return {
      urlField: "payment_secondary_qr_code_url",
      folder: "payment/qr-secondary",
    };
  }

  if (assetType === "documentAppendixImage") {
    return {
      urlField: "document_appendix_image_url",
      nameField: "document_appendix_image_name",
      folder: "documents/appendix",
    };
  }

  return null;
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const assetType = String(formData.get("assetType") || "");
  const file = formData.get("file");

  const config = getFieldForAssetType(assetType);
  if (!config) {
    return NextResponse.json({ error: "Unsupported asset type" }, { status: 400 });
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File size is invalid" }, { status: 400 });
  }

  const fileExt = file.name.includes(".") ? file.name.split(".").pop() : "bin";
  const filePath = `${config.folder}/${Date.now()}-${crypto.randomUUID()}.${fileExt}`;
  const supabase = createAdminClient();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from(getAppAssetsBucketName())
    .upload(filePath, bytes, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data } = supabase.storage.from(getAppAssetsBucketName()).getPublicUrl(filePath);
  const payload: Record<string, string | null> = {
    id: APP_SETTINGS_ID,
    [config.urlField]: data.publicUrl,
  };

  if (config.nameField) {
    payload[config.nameField] = file.name;
  }

  const { error: saveError } = await supabase.from("app_settings").upsert(payload, { onConflict: "id" });
  if (saveError) {
    if (/document_appendix_image_(url|name)/i.test(saveError.message)) {
      return NextResponse.json({ error: DOCUMENT_APPENDIX_SCHEMA_ERROR }, { status: 409 });
    }

    return NextResponse.json({ error: saveError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    assetType,
    url: data.publicUrl,
    fileName: file.name,
  });
}