import { randomUUID } from "node:crypto";

function sanitizeAssetFileName(fileName: string) {
  return (fileName || "upload.bin")
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 120);
}

type PathIdentity = {
  now?: number;
  nonce?: string;
};

function resolvePathIdentity(identity?: PathIdentity) {
  return {
    now: identity?.now ?? Date.now(),
    nonce: identity?.nonce ?? randomUUID(),
  };
}

export function buildLeadCustomerReferenceStoragePath(
  leadId: string,
  fileName: string,
  identity?: PathIdentity
) {
  const { now, nonce } = resolvePathIdentity(identity);
  return `leads/${leadId}/customer-reference/${now}-${nonce}-${sanitizeAssetFileName(fileName)}`;
}

export function buildLeadAiPreviewStoragePath(
  leadId: string,
  extension = "png",
  identity?: PathIdentity
) {
  const { now, nonce } = resolvePathIdentity(identity);
  const safeExtension = extension.replace(/[^a-zA-Z0-9]/g, "") || "png";
  return `leads/${leadId}/ai-preview/${now}-${nonce}.${safeExtension}`;
}

export function buildJobMediaStoragePath(
  jobId: string,
  eventId: string,
  fileName: string,
  identity?: PathIdentity
) {
  const { now, nonce } = resolvePathIdentity(identity);
  return `jobs/${jobId}/events/${eventId}/${now}-${nonce}-${sanitizeAssetFileName(fileName)}`;
}