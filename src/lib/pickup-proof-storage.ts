import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export const PICKUP_PROOFS_BUCKET = "pickup-proofs";
export const PICKUP_PROOF_MAX_BYTES = 10 * 1024 * 1024;
export const PICKUP_PROOF_ALLOWED_MIME = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
] as const;

export function isAllowedPickupProofMime(mime: string): boolean {
  return (PICKUP_PROOF_ALLOWED_MIME as readonly string[]).includes(
    (mime || "").toLowerCase()
  );
}

function getExtensionFromFile(file: File): string {
  if (file.name && file.name.includes(".")) {
    const ext = file.name.split(".").pop();
    if (ext) return ext.toLowerCase();
  }
  const type = (file.type || "").toLowerCase();
  if (type.includes("png")) return "png";
  if (type.includes("jpeg") || type.includes("jpg")) return "jpg";
  if (type.includes("webp")) return "webp";
  if (type.includes("heic")) return "heic";
  if (type.includes("heif")) return "heif";
  if (type.includes("pdf")) return "pdf";
  return "bin";
}

export function buildPickupProofStoragePath(jobId: string, file: File): string {
  const now = new Date().toISOString().replace(/[:.]/g, "-");
  const nonce =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `pickups/${jobId}/${now}-${nonce}.${getExtensionFromFile(file)}`;
}

export async function uploadPickupProofFile(
  jobId: string,
  file: File
): Promise<{ storagePath: string; size: number; mimeType: string; originalFileName: string }> {
  if (!file.type) {
    throw new Error("Missing file mime type");
  }
  if (!isAllowedPickupProofMime(file.type)) {
    throw new Error(`Unsupported file type: ${file.type}`);
  }
  if (file.size <= 0 || file.size > PICKUP_PROOF_MAX_BYTES) {
    throw new Error(`File size out of range (max ${PICKUP_PROOF_MAX_BYTES} bytes)`);
  }

  const storagePath = buildPickupProofStoragePath(jobId, file);
  const supabase = createAdminClient();
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error } = await supabase.storage
    .from(PICKUP_PROOFS_BUCKET)
    .upload(storagePath, bytes, {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    throw new Error(error.message);
  }

  return {
    storagePath,
    size: file.size,
    mimeType: file.type,
    originalFileName: file.name || `pickup-proof-${Date.now()}`,
  };
}

export async function deletePickupProofFile(storagePath: string): Promise<void> {
  const supabase = createAdminClient();
  await supabase.storage.from(PICKUP_PROOFS_BUCKET).remove([storagePath]);
}

export async function createPickupProofSignedUrl(
  storagePath: string,
  expiresInSeconds = 60 * 10
): Promise<string | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(PICKUP_PROOFS_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
