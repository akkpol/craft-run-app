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
    description: "มอง CRM inbox ทุกคิวในมุมเดียวเพื่อจัดลำดับและหา blocker ที่ต้องขยับก่อน",
    ownerKey: "owner",
    ownerLabel: "ภาพรวม",
    readinessStage: "exception",
    nextActionOwner: "internal",
  },
  "new-leads": {
    key: "new-leads",
    label: "งานใหม่",
    shortLabel: "งานใหม่",
    description: "lead และ conversation ระยะต้นที่ยังต้องเก็บข้อมูลให้พร้อมก่อนออกใบเสนอราคา",
    ownerKey: "crm",
    ownerLabel: "CRM / รับงาน",
    readinessStage: "intake",
    nextActionOwner: "internal",
  },
  exceptions: {
    key: "exceptions",
    label: "กรณีพิเศษ",
    shortLabel: "กรณีพิเศษ",
    description: "เคสที่ระบบหรือ policy ส่งกลับมาให้คนตัดสินใจทันทีและไม่ควรปล่อยค้าง",
    ownerKey: "owner",
    ownerLabel: "เจ้าของ / ตรวจสอบ",
    readinessStage: "exception",
    nextActionOwner: "internal",
  },
  "payment-ops": {
    key: "payment-ops",
    label: "รับชำระ",
    shortLabel: "รับชำระ",
    description: "คิวที่ต้องยืนยันการชำระหรือตรวจสลิปก่อนระบบจะเดินต่อได้",
    ownerKey: "finance",
    ownerLabel: "การเงิน",
    readinessStage: "payment",
    nextActionOwner: "internal",
  },
  "customer-waiting": {
    key: "customer-waiting",
    label: "รอลูกค้า",
    shortLabel: "รอลูกค้า",
    description: "คิวที่ทีมส่งคำถามหรือแบบดีไซน์กลับไปแล้ว กำลังรอข้อมูลหรือ feedback จากลูกค้า",
    ownerKey: "crm",
    ownerLabel: "CRM / ติดตาม",
    readinessStage: "customer",
    nextActionOwner: "customer",
  },
  "quote-decision": {
    key: "quote-decision",
    label: "ใบเสนอราคา",
    shortLabel: "ใบเสนอราคา",
    description: "ใบเสนอราคาที่รอลูกค้าอนุมัติ หรือต้องตามการชำระก่อนเปิดงานได้",
    ownerKey: "sales",
    ownerLabel: "ฝ่ายขาย",
    readinessStage: "quote",
    nextActionOwner: "internal",
  },
  "commercial-gate": {
    key: "commercial-gate",
    label: "เอกสาร / ผู้รับเงิน",
    shortLabel: "เอกสาร",
    description: "quote ที่ยังต้องเลือกผู้รับเงินหรือออกเอกสารหลังรับชำระ ก่อนส่งเข้าผลิตได้",
    ownerKey: "finance",
    ownerLabel: "การเงิน / เอกสาร",
    readinessStage: "commercial",
    nextActionOwner: "internal",
  },
  "design-ops": {
    key: "design-ops",
    label: "ออกแบบ / ตรวจงาน",
    shortLabel: "ออกแบบ",
    description: "งานที่ยังรอตรวจแบบ ตีกลับ หรือต้องส่ง preview ให้ลูกค้าดู",
    ownerKey: "review",
    ownerLabel: "ออกแบบ / QC",
    readinessStage: "review",
    nextActionOwner: "internal",
  },
  "production-ops": {
    key: "production-ops",
    label: "ผลิต / จัดส่ง",
    shortLabel: "ผลิต",
    description: "งานที่อยู่ในขั้นผลิตหรือรอจัดส่ง — ติดตาม prompt, preview, และสถานะหน้างาน",
    ownerKey: "production",
    ownerLabel: "ผลิต / จัดส่ง",
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