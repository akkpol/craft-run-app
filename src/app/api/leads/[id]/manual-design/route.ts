import { NextRequest, NextResponse } from "next/server";

import { logHumanAction } from "@/lib/action-log";
import { getAppAssetsBucketName } from "@/lib/ai-images";
import { buildLeadAiPreviewStoragePath } from "@/lib/asset-storage-paths";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

function getExtensionFromFile(file: File) {
  if (file.name && file.name.includes(".")) {
    const ext = file.name.split(".").pop();
    if (ext) return ext.toLowerCase();
  }
  const type = file.type || "";
  if (type.includes("png")) return "png";
  if (type.includes("jpeg") || type.includes("jpg")) return "jpg";
  if (type.includes("webp")) return "webp";
  return "png";
}

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File size is invalid" }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "File must be an image" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (leadError || !lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const filePath = buildLeadAiPreviewStoragePath(id, getExtensionFromFile(file));
  const bytes = new Uint8Array(await file.arrayBuffer());
  const bucket = getAppAssetsBucketName();

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(filePath, bytes, {
      contentType: file.type || "image/png",
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: publicUrl } = supabase.storage.from(bucket).getPublicUrl(filePath);
  const imageUrl = publicUrl.publicUrl;

  const { error: updateError } = await supabase
    .from("leads")
    .update({
      ai_image_status: "generated",
      ai_generated_images: [imageUrl],
      ai_image_error: null,
      design_status: "drafting",
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  await logHumanAction(supabase, {
    entityType: "lead",
    entityId: id,
    actionType: "lead.manual_design_uploaded",
    actorLabel: "Admin",
    note: "Admin uploaded a manual design (AI escape hatch)",
    payload: {
      image_url: imageUrl,
      file_size: file.size,
      content_type: file.type,
    },
  }).catch(() => null);

  return NextResponse.json({ success: true, imageUrl });
}
