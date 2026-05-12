export const DOCUMENT_REQUEST_TYPES = [
  "quote",
  "invoice",
  "receipt",
  "tax_invoice",
] as const;

export type DocumentRequestType = (typeof DOCUMENT_REQUEST_TYPES)[number];

export const DOCUMENT_REQUEST_TYPE_LABELS: Record<DocumentRequestType, string> = {
  quote: "ใบเสนอราคา",
  invoice: "ใบแจ้งหนี้ / Invoice",
  receipt: "ใบเสร็จรับเงิน",
  tax_invoice: "ใบกำกับภาษี",
};

const DOCUMENT_REQUEST_PRIMARY_PRIORITY: DocumentRequestType[] = [
  "tax_invoice",
  "receipt",
  "invoice",
  "quote",
];

export function isDocumentRequestType(value: unknown): value is DocumentRequestType {
  return (
    typeof value === "string" &&
    DOCUMENT_REQUEST_TYPES.includes(value as DocumentRequestType)
  );
}

export function normalizeDocumentRequestTypes(
  values: unknown
): DocumentRequestType[] {
  const rawValues = Array.isArray(values) ? values : [values];
  const normalized = rawValues.filter(isDocumentRequestType);
  const unique = Array.from(new Set(normalized));

  return unique.length > 0 ? unique : ["quote"];
}

export function getPrimaryDocumentRequestType(
  values: readonly DocumentRequestType[] | null | undefined
): DocumentRequestType {
  const normalized = normalizeDocumentRequestTypes(values);
  return (
    DOCUMENT_REQUEST_PRIMARY_PRIORITY.find((type) => normalized.includes(type)) ||
    "quote"
  );
}
