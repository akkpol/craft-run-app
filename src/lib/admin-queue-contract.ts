export const ADMIN_QUEUE_FILTER_KEYS = [
  "all",
  "new-leads",
  "exceptions",
  "payment-ops",
  "customer-waiting",
  "quote-decision",
  "commercial-gate",
  "design-ops",
  "production-ops",
] as const;

export type AdminQueueFilterKey = (typeof ADMIN_QUEUE_FILTER_KEYS)[number];
export type AdminQueueRowFilterKey = Exclude<AdminQueueFilterKey, "all">;

export type AdminQueueOwnerKey =
  | "owner"
  | "finance"
  | "crm"
  | "sales"
  | "review"
  | "production";

export type AdminReadinessStageKey =
  | "intake"
  | "exception"
  | "payment"
  | "customer"
  | "quote"
  | "commercial"
  | "review"
  | "production";

export type AdminQueueContract = {
  key: AdminQueueFilterKey;
  label: string;
  shortLabel: string;
  description: string;
  ownerKey: AdminQueueOwnerKey;
  ownerLabel: string;
  readinessStage: AdminReadinessStageKey;
  nextActionOwner: "internal" | "customer";
};

export const ADMIN_QUEUE_CONTRACT: Record<AdminQueueFilterKey, AdminQueueContract> = {
  all: {
    key: "all",
    label: "ทุกคิว",
    shortLabel: "ทุกคิว",
    description: "มอง CRM inbox ทุกคิวในมุมเดียวเพื่อจัดลำดับ owner และ blocker ที่ต้องขยับก่อน",
    ownerKey: "owner",
    ownerLabel: "Owner view",
    readinessStage: "exception",
    nextActionOwner: "internal",
  },
  "new-leads": {
    key: "new-leads",
    label: "New Leads",
    shortLabel: "New Leads",
    description: "lead และ conversation ระยะต้นที่ยังต้องเก็บ requirement ให้พร้อมก่อนออก quote",
    ownerKey: "crm",
    ownerLabel: "CRM / intake ops",
    readinessStage: "intake",
    nextActionOwner: "internal",
  },
  exceptions: {
    key: "exceptions",
    label: "Exceptions",
    shortLabel: "Exceptions",
    description: "เคสที่ระบบหรือ policy ส่งกลับมาให้คนตัดสินใจทันทีและไม่ควรปล่อยค้าง",
    ownerKey: "owner",
    ownerLabel: "Owner / reviewer",
    readinessStage: "exception",
    nextActionOwner: "internal",
  },
  "payment-ops": {
    key: "payment-ops",
    label: "Payment Ops",
    shortLabel: "Payment Ops",
    description: "คิวงานที่ต้องปลด payment gate, manual review หรือการยืนยันการชำระก่อน flow จะเดินต่อ",
    ownerKey: "finance",
    ownerLabel: "Finance",
    readinessStage: "payment",
    nextActionOwner: "internal",
  },
  "customer-waiting": {
    key: "customer-waiting",
    label: "Customer Waiting",
    shortLabel: "Customer Waiting",
    description: "คิวที่ทีมส่งคำถามหรือ proof กลับไปแล้วและกำลังรอข้อมูลหรือ feedback จากลูกค้า",
    ownerKey: "crm",
    ownerLabel: "CRM / follow-up",
    readinessStage: "customer",
    nextActionOwner: "customer",
  },
  "quote-decision": {
    key: "quote-decision",
    label: "Quote Decision",
    shortLabel: "Quote Decision",
    description: "ใบเสนอราคาที่ต้องตามการอนุมัติ การชำระ หรือการเปิดงานต่อหลังลูกค้าตอบรับ",
    ownerKey: "sales",
    ownerLabel: "Sales / admin",
    readinessStage: "quote",
    nextActionOwner: "internal",
  },
  "commercial-gate": {
    key: "commercial-gate",
    label: "Commercial Gate",
    shortLabel: "Commercial Gate",
    description: "quote ที่ยังติด receiver lock หรือเอกสารหลังรับชำระ และยังไม่ควรปล่อยเข้า production",
    ownerKey: "finance",
    ownerLabel: "Finance & documents",
    readinessStage: "commercial",
    nextActionOwner: "internal",
  },
  "design-ops": {
    key: "design-ops",
    label: "Design Ops",
    shortLabel: "Design Ops",
    description: "หลักฐาน, proof, หรือ media package ที่ยังรอตรวจ ตีกลับ หรือยังต้องส่งต่อให้ลูกค้า",
    ownerKey: "review",
    ownerLabel: "Design / QA review",
    readinessStage: "review",
    nextActionOwner: "internal",
  },
  "production-ops": {
    key: "production-ops",
    label: "Production Ops",
    shortLabel: "Production Ops",
    description: "งาน active ที่มี owner ต้องตาม prompt, preview, production link และสถานะหน้างานต่อจนจบ",
    ownerKey: "production",
    ownerLabel: "Production / fulfillment",
    readinessStage: "production",
    nextActionOwner: "internal",
  },
};

const LEGACY_FILTER_KEY_MAP: Record<string, AdminQueueFilterKey> = {
  escalation: "exceptions",
  blocked: "payment-ops",
  "waiting-customer": "customer-waiting",
  quote: "quote-decision",
  "production-review": "design-ops",
  "running-job": "production-ops",
};

export function isAdminQueueFilterKey(value: string): value is AdminQueueFilterKey {
  return (ADMIN_QUEUE_FILTER_KEYS as readonly string[]).includes(value);
}

export function normalizeAdminQueueFilterKey(value: string | null | undefined): AdminQueueFilterKey | null {
  if (!value) {
    return null;
  }

  if (isAdminQueueFilterKey(value)) {
    return value;
  }

  return LEGACY_FILTER_KEY_MAP[value] || null;
}

export function getAdminQueueContract(key: AdminQueueFilterKey) {
  return ADMIN_QUEUE_CONTRACT[key];
}