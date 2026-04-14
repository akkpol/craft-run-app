// Workflow states — hardcoded, never derived
export const WORKFLOW_STATES = [
  "NEW_MESSAGE",
  "COLLECTING_INFO",
  "FORM_SUBMITTED",
  "QUOTE_DRAFTED",
  "WAITING_CUSTOMER_APPROVAL",
  "JOB_CREATED",
  "HUMAN_REVIEW_REQUIRED",
  "IN_PROGRESS",
  "COMPLETED",
] as const;

export type WorkflowState = (typeof WORKFLOW_STATES)[number];

export const JOB_STATUSES = [
  "JOB_CREATED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export const QUOTE_STATUSES = [
  "draft",
  "sent",
  "approved",
  "rejected",
  "expired",
] as const;

export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const PRODUCT_TYPES = [
  { value: "vinyl_banner", label: "ป้ายไวนิล" },
  { value: "acrylic_sign", label: "ป้ายอะคริลิค" },
  { value: "sticker", label: "สติ๊กเกอร์" },
  { value: "foam_board", label: "ฟิวเจอร์บอร์ด" },
  { value: "aluminium", label: "ป้ายอลูมิเนียม" },
  { value: "other", label: "อื่นๆ" },
] as const;

export const UNITS = [
  { value: "mm", label: "มม.", factor: 1 },
  { value: "cm", label: "ซม.", factor: 10 },
  { value: "m", label: "ม.", factor: 1000 },
  { value: "inch", label: "นิ้ว", factor: 25.4 },
  { value: "ft", label: "ฟุต", factor: 304.8 },
] as const;

export type UnitType = (typeof UNITS)[number]["value"];

// Convert any unit to mm
export function toMM(value: number, unit: UnitType): number {
  const unitDef = UNITS.find((u) => u.value === unit);
  if (!unitDef) return value;
  return Math.round(value * unitDef.factor * 100) / 100;
}

// Calculate area in sqm from mm dimensions
export function areaSqm(widthMm: number, heightMm: number, qty: number): number {
  return (widthMm * heightMm * qty) / 1_000_000;
}

// Simple pricing — per sqm by product type
export const PRICING: Record<string, { perSqm: number; minCharge: number }> = {
  vinyl_banner: { perSqm: 250, minCharge: 500 },
  acrylic_sign: { perSqm: 3500, minCharge: 1500 },
  sticker: { perSqm: 350, minCharge: 300 },
  foam_board: { perSqm: 800, minCharge: 500 },
  aluminium: { perSqm: 4500, minCharge: 2000 },
  other: { perSqm: 500, minCharge: 500 },
};

export function calculatePrice(
  productType: string,
  widthMm: number,
  heightMm: number,
  qty: number
): number {
  const pricing = PRICING[productType] || PRICING.other;
  const area = areaSqm(widthMm, heightMm, qty);
  const calculated = area * pricing.perSqm;
  return Math.max(calculated, pricing.minCharge);
}

// Interfaces
export interface IntakeFormData {
  lineUserId: string;
  displayName: string;
  productType: string;
  width: number;
  height: number;
  unit: UnitType;
  qty: number;
  dueDate: string;
  phone: string;
  note: string;
  referenceInfo: string;
}

export interface ConversationRow {
  id: string;
  line_user_id: string;
  state: WorkflowState;
  last_message_at: string;
  created_at: string;
}

export interface LeadRow {
  id: string;
  conversation_id: string;
  customer_id: string;
  product_type: string;
  width_mm: number;
  height_mm: number;
  qty: number;
  due_date: string;
  note_from_form: string;
  note_from_chat: string;
  reference_info: string;
  status: string;
  created_at: string;
}

export interface QuoteRow {
  id: string;
  lead_id: string;
  subtotal: number;
  discount: number;
  vat: number;
  total: number;
  status: QuoteStatus;
  public_token: string;
  valid_until: string;
  created_at: string;
}

export interface QuoteItemRow {
  id: string;
  quote_id: string;
  label: string;
  qty: number;
  unit_price: number;
  line_total: number;
}

export interface JobRow {
  id: string;
  quote_id: string;
  lead_id: string;
  status: JobStatus;
  assigned_to: string | null;
  created_at: string;
}

export interface EscalationRow {
  id: string;
  conversation_id: string;
  reason: string;
  status: string;
  created_at: string;
}
