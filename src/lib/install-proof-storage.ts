import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export const INSTALL_PROOFS_BUCKET = "install-proofs";
export const INSTALL_PROOF_MAX_BYTES = 10 * 1024 * 1024;
export const INSTALL_PROOF_ALLOWED_MIME = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
] as const;

export function isAllowedInstallProofMime(mime: string): boolean {
  return (INSTALL_PROOF_ALLOWED_MIME as readonly string[]).includes(
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

export function buildInstallProofStoragePath(installId: string, file: File): string {
  const now = new Date().toISOString().replace(/[:.]/g, "-");
  const nonce =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `installations/${installId}/${now}-${nonce}.${getExtensionFromFile(file)}`;
}

export async function uploadInstallProofFile(
  installId: string,
  file: File
): Promise<{ storagePath: string; size: number; mimeType: string; originalFileName: string }> {
  if (!file.type) {
    throw new Error("Missing file mime type");
  }
  if (!isAllowedInstallProofMime(file.type)) {
    throw new Error(`Unsupported file type: ${file.type}`);
  }
  if (file.size <= 0 || file.size > INSTALL_PROOF_MAX_BYTES) {
    throw new Error(`File size out of range (max ${INSTALL_PROOF_MAX_BYTES} bytes)`);
  }

  const storagePath = buildInstallProofStoragePath(installId, file);
  const supabase = createAdminClient();
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error } = await supabase.storage
    .from(INSTALL_PROOFS_BUCKET)
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
    originalFileName: file.name || `install-proof-${Date.now()}`,
  };
}

export async function createInstallProofSignedUrl(
  storagePath: string,
  expiresInSeconds = 60 * 10
): Promise<string | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(INSTALL_PROOFS_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
