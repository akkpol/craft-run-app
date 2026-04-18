import { createHash, createHmac } from "node:crypto";

const TOKEN_SEPARATOR = ".";

export function createProductionLinkToken(input: {
  linkId: string;
  secret: string;
}): string {
  const signature = createHmac("sha256", input.secret)
    .update(input.linkId)
    .digest("hex");

  return `${input.linkId}${TOKEN_SEPARATOR}${signature}`;
}

export function hashProductionLinkToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function extractProductionLinkId(token: string): string | null {
  const [linkId] = token.split(TOKEN_SEPARATOR, 1);
  return linkId || null;
}

export function buildProductionLinkUrl(
  baseUrl: string,
  token: string
): string {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
  return `${normalizedBaseUrl}/production/${token}`;
}
