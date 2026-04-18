// Workflow states — hardcoded, never derived
export const WORKFLOW_STATES = [
  "NEW_MESSAGE",
  "COLLECTING_REQUIREMENTS",
  "REQUIREMENTS_REVIEW",
  "WAITING_QUOTE_APPROVAL",
  "WAITING_PAYMENT",
  "IN_DESIGN",
  "IN_PRODUCTION",
  "READY_FOR_FULFILLMENT",
  "ON_HOLD_CUSTOMER_INPUT",
  "HUMAN_REVIEW_REQUIRED",
  "COMPLETED",
  "CANCELLED",
] as const;

export type WorkflowState = (typeof WORKFLOW_STATES)[number];

export const JOB_STATUSES = [
  "IN_DESIGN",
  "IN_PRODUCTION",
  "READY_FOR_FULFILLMENT",
  "ON_HOLD_CUSTOMER_INPUT",
  "HUMAN_REVIEW_REQUIRED",
  "COMPLETED",
  "CANCELLED",
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export const DESIGN_ASSIGNMENT_MODES = ["auto", "manual"] as const;

export type DesignAssignmentMode = (typeof DESIGN_ASSIGNMENT_MODES)[number];

export const DESIGN_EXECUTORS = ["ai", "human", "unassigned"] as const;

export type DesignExecutor = (typeof DESIGN_EXECUTORS)[number];

export const DESIGN_STATUSES = [
  "not_started",
  "drafting",
  "preview_sent",
  "revision_requested",
  "approved",
] as const;

export type DesignStatus = (typeof DESIGN_STATUSES)[number];

export const DESIGN_STATUS_LABELS: Record<DesignStatus, string> = {
  not_started: "ยังไม่เริ่มออกแบบ",
  drafting: "กำลังทำแบบ",
  preview_sent: "ส่งแบบให้ลูกค้าตรวจแล้ว",
  revision_requested: "ลูกค้าขอแก้แบบ",
  approved: "ลูกค้าอนุมัติแบบแล้ว",
};

export function isDesignStatus(value: string): value is DesignStatus {
  return DESIGN_STATUSES.includes(value as DesignStatus);
}

export function designStatusNeedsCustomerResponse(
  status: DesignStatus | null | undefined
): boolean {
  return status === "preview_sent" || status === "revision_requested";
}

export const FULFILLMENT_MODES = ["pickup", "delivery"] as const;

export type FulfillmentMode = (typeof FULFILLMENT_MODES)[number];

export const FULFILLMENT_STATUSES = [
  "not_ready",
  "ready",
  "delivered",
  "picked_up",
] as const;

export type FulfillmentStatus = (typeof FULFILLMENT_STATUSES)[number];

export const COMPLETION_PACKAGE_STATUSES = [
  "not_required",
  "pending",
  "sent",
] as const;

export type CompletionPackageStatus =
  (typeof COMPLETION_PACKAGE_STATUSES)[number];

export const PRODUCTION_STATUSES = [
  "queued",
  "in_progress",
  "qc",
  "failed_qc",
  "done",
] as const;

export type ProductionStatus = (typeof PRODUCTION_STATUSES)[number];

export const QUOTE_STATUSES = [
  "draft",
  "sent",
  "approved",
  "rejected",
  "expired",
] as const;

export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const PAYMENT_TERMS = ["prepaid", "deposit", "credit"] as const;

export type PaymentTerm = (typeof PAYMENT_TERMS)[number];

export const PAYMENT_STATUSES = [
  "unpaid",
  "partial",
  "paid",
  "not_required",
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_TERM_LABELS: Record<PaymentTerm, string> = {
  prepaid: "จ่ายเต็มก่อนเริ่มงาน",
  deposit: "มัดจำก่อนเริ่มงาน",
  credit: "เครดิตลูกค้า",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: "ยังไม่รับชำระ",
  partial: "รับมัดจำแล้ว",
  paid: "ชำระครบแล้ว",
  not_required: "ยังไม่ต้องรับชำระก่อนผลิต",
};

export const WORKFLOW_STATE_LABELS: Record<WorkflowState, string> = {
  NEW_MESSAGE: "เริ่มต้นการสนทนา",
  COLLECTING_REQUIREMENTS: "กำลังเก็บรายละเอียดงาน",
  REQUIREMENTS_REVIEW: "กำลังตรวจสอบรายละเอียด",
  WAITING_QUOTE_APPROVAL: "รออนุมัติใบเสนอราคา",
  WAITING_PAYMENT: "รอการชำระเงิน",
  IN_DESIGN: "กำลังออกแบบ",
  IN_PRODUCTION: "กำลังผลิต",
  READY_FOR_FULFILLMENT: "พร้อมส่งมอบ",
  ON_HOLD_CUSTOMER_INPUT: "รอข้อมูลจากลูกค้า",
  HUMAN_REVIEW_REQUIRED: "รอทีมงานตรวจสอบ",
  COMPLETED: "เสร็จสมบูรณ์",
  CANCELLED: "ยกเลิก",
};

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  IN_DESIGN: "กำลังออกแบบ",
  IN_PRODUCTION: "กำลังผลิต",
  READY_FOR_FULFILLMENT: "พร้อมส่งมอบ",
  ON_HOLD_CUSTOMER_INPUT: "รอข้อมูลจากลูกค้า",
  HUMAN_REVIEW_REQUIRED: "รอทีมงานตรวจสอบ",
  COMPLETED: "เสร็จสมบูรณ์",
  CANCELLED: "ยกเลิก",
};

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

export function isWorkflowState(value: string): value is WorkflowState {
  return WORKFLOW_STATES.includes(value as WorkflowState);
}

export function isJobStatus(value: string): value is JobStatus {
  return JOB_STATUSES.includes(value as JobStatus);
}

export function isPaymentTerm(value: string): value is PaymentTerm {
  return PAYMENT_TERMS.includes(value as PaymentTerm);
}

export function isPaymentStatus(value: string): value is PaymentStatus {
  return PAYMENT_STATUSES.includes(value as PaymentStatus);
}

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
  aiImagePrompt?: string;
  paymentTerms?: PaymentTerm;
  fulfillmentMode?: FulfillmentMode;
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
  ai_image_prompt?: string;
  ai_image_status?: "not_requested" | "pending" | "generated" | "failed";
  ai_generated_images?: string[];
  ai_image_error?: string;
  fulfillment_mode?: FulfillmentMode | null;
  design_assignment_mode?: DesignAssignmentMode;
  design_executor?: DesignExecutor;
  design_status?: DesignStatus;
  assigned_designer?: string | null;
  hold_reason?: string | null;
  human_review_reason?: string | null;
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
  payment_terms: PaymentTerm;
  payment_status: PaymentStatus;
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
  production_status?: ProductionStatus;
  fulfillment_status?: FulfillmentStatus;
  completion_package_status?: CompletionPackageStatus;
  completed_at?: string | null;
  cancel_reason?: string | null;
  created_at: string;
}

export interface EscalationRow {
  id: string;
  conversation_id: string;
  reason: string;
  status: string;
  created_at: string;
}
