import { type AppLocale } from "./locale";
import {
  WORKFLOW_STATES,
  isWorkflowState,
  normalizeWorkflowState,
  type WorkflowState,
} from "./workflow-state";

export { WORKFLOW_STATES, isWorkflowState, normalizeWorkflowState };
export type { WorkflowState };

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

const LOCALIZED_DESIGN_STATUS_LABELS: Record<
  AppLocale,
  Record<DesignStatus, string>
> = {
  th: DESIGN_STATUS_LABELS,
  my: {
    not_started: "ဒီဇိုင်း မစရသေးပါ",
    drafting: "ဒီဇိုင်းရေးဆွဲနေသည်",
    preview_sent: "နမူနာပေးပို့ပြီး",
    revision_requested: "ပြင်ဆင်ရန် တောင်းဆိုထားသည်",
    approved: "ဖောက်သည် အတည်ပြုပြီး",
  },
  en: {
    not_started: "Not started",
    drafting: "Drafting",
    preview_sent: "Preview sent",
    revision_requested: "Revision requested",
    approved: "Approved",
  },
};

const LOCALIZED_PAYMENT_TERM_LABELS: Record<
  AppLocale,
  Record<PaymentTerm, string>
> = {
  th: PAYMENT_TERM_LABELS,
  my: {
    prepaid: "အလုပ်မစမီ အပြည့်ပေးချေ",
    deposit: "အလုပ်မစမီ စပေါ်ငွေ",
    credit: "ဖောက်သည် ခရက်ဒစ်",
  },
  en: {
    prepaid: "Pay in full before production",
    deposit: "Deposit before production",
    credit: "Customer credit",
  },
};

const LOCALIZED_PAYMENT_STATUS_LABELS: Record<
  AppLocale,
  Record<PaymentStatus, string>
> = {
  th: PAYMENT_STATUS_LABELS,
  my: {
    unpaid: "မပေးချေရသေး",
    partial: "စပေါ်ငွေ လက်ခံပြီး",
    paid: "အပြည့် ပေးချေပြီး",
    not_required: "မထုတ်လုပ်မီ ပေးချေရန် မလို",
  },
  en: {
    unpaid: "Unpaid",
    partial: "Partially paid",
    paid: "Paid in full",
    not_required: "Not required before production",
  },
};

const LOCALIZED_WORKFLOW_STATE_LABELS: Record<
  AppLocale,
  Record<WorkflowState, string>
> = {
  th: WORKFLOW_STATE_LABELS,
  my: {
    NEW_MESSAGE: "စကားပြောစတင်",
    COLLECTING_REQUIREMENTS: "လိုအပ်ချက်များ စုဆောင်းနေသည်",
    REQUIREMENTS_REVIEW: "လိုအပ်ချက်များ စစ်ဆေးနေသည်",
    WAITING_QUOTE_APPROVAL: "ဈေးနှုန်းအတည်ပြုချက် စောင့်နေသည်",
    WAITING_PAYMENT: "ငွေပေးချေမှု စောင့်နေသည်",
    IN_DESIGN: "ဒီဇိုင်းလုပ်နေသည်",
    IN_PRODUCTION: "ထုတ်လုပ်နေသည်",
    READY_FOR_FULFILLMENT: "ပို့ဆောင်ရန် အသင့်",
    ON_HOLD_CUSTOMER_INPUT: "ဖောက်သည်အချက်အလက် စောင့်နေသည်",
    HUMAN_REVIEW_REQUIRED: "အဖွဲ့စစ်ဆေးမှု စောင့်နေသည်",
    COMPLETED: "ပြီးစီးပါပြီ",
    CANCELLED: "ပယ်ဖျက်ထားသည်",
  },
  en: {
    NEW_MESSAGE: "New conversation",
    COLLECTING_REQUIREMENTS: "Collecting requirements",
    REQUIREMENTS_REVIEW: "Requirements review",
    WAITING_QUOTE_APPROVAL: "Waiting for quote approval",
    WAITING_PAYMENT: "Waiting for payment",
    IN_DESIGN: "In design",
    IN_PRODUCTION: "In production",
    READY_FOR_FULFILLMENT: "Ready for fulfillment",
    ON_HOLD_CUSTOMER_INPUT: "Waiting on customer input",
    HUMAN_REVIEW_REQUIRED: "Human review required",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
  },
};

const LOCALIZED_JOB_STATUS_LABELS: Record<AppLocale, Record<JobStatus, string>> = {
  th: JOB_STATUS_LABELS,
  my: {
    IN_DESIGN: "ဒီဇိုင်းလုပ်နေသည်",
    IN_PRODUCTION: "ထုတ်လုပ်နေသည်",
    READY_FOR_FULFILLMENT: "ပို့ဆောင်ရန် အသင့်",
    ON_HOLD_CUSTOMER_INPUT: "ဖောက်သည်အချက်အလက် စောင့်နေသည်",
    HUMAN_REVIEW_REQUIRED: "အဖွဲ့စစ်ဆေးမှု စောင့်နေသည်",
    COMPLETED: "ပြီးစီးပါပြီ",
    CANCELLED: "ပယ်ဖျက်ထားသည်",
  },
  en: {
    IN_DESIGN: "In design",
    IN_PRODUCTION: "In production",
    READY_FOR_FULFILLMENT: "Ready for fulfillment",
    ON_HOLD_CUSTOMER_INPUT: "Waiting on customer input",
    HUMAN_REVIEW_REQUIRED: "Human review required",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
  },
};

export const PRODUCT_TYPES = [
  {
    value: "vinyl_banner",
    label: "ป้ายไวนิล",
    category: "signage",
    categoryLabel: "ป้ายและหน้าร้าน",
    description: "เหมาะกับป้ายโปรโมชัน ป้ายหน้าร้าน และงานด่วน",
    keywords: ["ไวนิล", "แบนเนอร์", "ป้าย", "หน้าร้าน", "banner"],
  },
  {
    value: "acrylic_sign",
    label: "ป้ายอะคริลิค",
    category: "signage",
    categoryLabel: "ป้ายและหน้าร้าน",
    description: "งานป้ายพรีเมียม ตัวอักษร โลโก้ หรือป้ายบริษัท",
    keywords: ["อะคริลิค", "ป้ายบริษัท", "โลโก้", "acrylic"],
  },
  {
    value: "sticker",
    label: "สติ๊กเกอร์",
    category: "label",
    categoryLabel: "สติ๊กเกอร์และฉลาก",
    description: "ฉลากสินค้า สติ๊กเกอร์ติดแพ็กเกจ และงานไดคัท",
    keywords: ["สติ๊กเกอร์", "ฉลาก", "แพ็กเกจ", "label", "sticker"],
  },
  {
    value: "foam_board",
    label: "ฟิวเจอร์บอร์ด",
    category: "display",
    categoryLabel: "บอร์ดและดิสเพลย์",
    description: "บอร์ดตั้งโต๊ะ งานนิทรรศการ และป้ายชั่วคราว",
    keywords: ["ฟิวเจอร์บอร์ด", "บอร์ด", "ดิสเพลย์", "foam board"],
  },
  {
    value: "aluminium",
    label: "ป้ายอลูมิเนียม",
    category: "signage",
    categoryLabel: "ป้ายและหน้าร้าน",
    description: "ป้ายทนแดดทนฝน ใช้งานภายนอกหรือโครงการระยะยาว",
    keywords: ["อลูมิเนียม", "ป้ายกลางแจ้ง", "ภายนอก", "aluminium"],
  },
  {
    value: "other",
    label: "อื่นๆ",
    category: "custom",
    categoryLabel: "งานพิเศษ",
    description: "งานที่ยังไม่แน่ใจประเภท หรืออยากให้ทีมช่วยแนะนำ",
    keywords: ["อื่นๆ", "custom", "พิเศษ", "แนะนำ"],
  },
] as const;

export type ProductTypeValue = (typeof PRODUCT_TYPES)[number]["value"];
export type ProductCategoryValue = (typeof PRODUCT_TYPES)[number]["category"];

const LOCALIZED_PRODUCT_TYPE_LABELS: Record<
  AppLocale,
  Record<ProductTypeValue, string>
> = {
  th: {
    vinyl_banner: "ป้ายไวนิล",
    acrylic_sign: "ป้ายอะคริลิค",
    sticker: "สติ๊กเกอร์",
    foam_board: "ฟิวเจอร์บอร์ด",
    aluminium: "ป้ายอลูมิเนียม",
    other: "อื่นๆ",
  },
  my: {
    vinyl_banner: "ဗီနိုင်းဆိုင်းဘုတ်",
    acrylic_sign: "အက်ခရိုလစ်ဆိုင်းဘုတ်",
    sticker: "စတစ်ကာ",
    foam_board: "ဖိုမ်ဘုတ်",
    aluminium: "အလူမီနီယမ်ဆိုင်းဘုတ်",
    other: "အခြား",
  },
  en: {
    vinyl_banner: "Vinyl banner",
    acrylic_sign: "Acrylic sign",
    sticker: "Sticker",
    foam_board: "Foam board",
    aluminium: "Aluminium sign",
    other: "Other",
  },
};

export const UNITS = [
  { value: "mm", label: "มม.", factor: 1 },
  { value: "cm", label: "ซม.", factor: 10 },
  { value: "m", label: "ม.", factor: 1000 },
  { value: "inch", label: "นิ้ว", factor: 25.4 },
  { value: "ft", label: "ฟุต", factor: 304.8 },
] as const;

export type UnitType = (typeof UNITS)[number]["value"];

function getLocalizedLabel<T extends string>(
  labels: Record<AppLocale, Record<T, string>>,
  key: T,
  locale: AppLocale
): string {
  return labels[locale]?.[key] ?? labels.th[key];
}

export function getDesignStatusLabel(
  status: DesignStatus,
  locale: AppLocale = "th"
): string {
  return getLocalizedLabel(LOCALIZED_DESIGN_STATUS_LABELS, status, locale);
}

export function getPaymentTermLabel(
  paymentTerm: PaymentTerm,
  locale: AppLocale = "th"
): string {
  return getLocalizedLabel(LOCALIZED_PAYMENT_TERM_LABELS, paymentTerm, locale);
}

export function getPaymentStatusLabel(
  paymentStatus: PaymentStatus,
  locale: AppLocale = "th"
): string {
  return getLocalizedLabel(LOCALIZED_PAYMENT_STATUS_LABELS, paymentStatus, locale);
}

export function getWorkflowStateLabel(
  workflowState: WorkflowState,
  locale: AppLocale = "th"
): string {
  return getLocalizedLabel(LOCALIZED_WORKFLOW_STATE_LABELS, workflowState, locale);
}

export function getJobStatusLabel(
  jobStatus: JobStatus,
  locale: AppLocale = "th"
): string {
  return getLocalizedLabel(LOCALIZED_JOB_STATUS_LABELS, jobStatus, locale);
}

export function getProductTypeLabel(
  productType: string | null | undefined,
  locale: AppLocale = "th"
): string | undefined {
  if (!productType) {
    return undefined;
  }

  const localizedLabels = LOCALIZED_PRODUCT_TYPE_LABELS[locale] as Record<
    string,
    string
  >;
  const fallbackLabels = LOCALIZED_PRODUCT_TYPE_LABELS.th as Record<string, string>;

  return localizedLabels[productType] ?? fallbackLabels[productType] ?? productType;
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
  intakeMode?: "resume" | "fresh";
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
