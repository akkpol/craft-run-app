import {
  WORKFLOW_STATES,
  type WorkflowState,
} from "@/lib/workflow-state";
import type { AdminQueueFilterKey } from "@/lib/admin-queue-contract";

export const WORKFLOW_AUTOMATION_MODES = [
  "auto_run",
  "customer_waiting",
  "human_gate",
  "terminal",
] as const;

export type WorkflowAutomationMode =
  (typeof WORKFLOW_AUTOMATION_MODES)[number];

export type WorkflowOwnerKey =
  | "system"
  | "crm"
  | "sales"
  | "finance"
  | "design"
  | "production"
  | "owner";

export type WorkflowNextActionOwner =
  | "system"
  | "customer"
  | "internal"
  | "none";

export type WorkflowSurfaceKind =
  | "action"
  | "reference"
  | "configuration";

export type WorkflowSurfaceRef = {
  href: string;
  label: string;
  kind: WorkflowSurfaceKind;
};

export type WorkflowOwnerContract = {
  state: WorkflowState;
  ownerKey: WorkflowOwnerKey;
  ownerLabel: string;
  automationMode: WorkflowAutomationMode;
  nextActionOwner: WorkflowNextActionOwner;
  primaryQueue: AdminQueueFilterKey | null;
  primarySurface: WorkflowSurfaceRef;
  supportingSurfaces: WorkflowSurfaceRef[];
  customerActions: string[];
  internalActions: string[];
  autoEvents: string[];
  humanGateReasons: string[];
  summary: string;
};

export const WORKFLOW_OWNER_MAP = {
  NEW_MESSAGE: {
    state: "NEW_MESSAGE",
    ownerKey: "system",
    ownerLabel: "System intake router",
    automationMode: "auto_run",
    nextActionOwner: "system",
    primaryQueue: "new-leads",
    primarySurface: {
      href: "/admin?filter=new-leads",
      label: "New lead intake queue",
      kind: "action",
    },
    supportingSurfaces: [
      { href: "/admin/liff-monitor", label: "LIFF monitor", kind: "reference" },
    ],
    customerActions: [],
    internalActions: ["inspect_intake_context"],
    autoEvents: ["line.message.received", "conversation.created"],
    humanGateReasons: [],
    summary: "ระบบรับข้อความแรกและ route เข้าการเก็บ requirement โดยไม่ต้องให้คนกดเป็นค่าเริ่มต้น",
  },
  COLLECTING_REQUIREMENTS: {
    state: "COLLECTING_REQUIREMENTS",
    ownerKey: "crm",
    ownerLabel: "CRM / intake ops",
    automationMode: "customer_waiting",
    nextActionOwner: "customer",
    primaryQueue: "new-leads",
    primarySurface: {
      href: "/liff/intake",
      label: "Customer LIFF intake",
      kind: "action",
    },
    supportingSurfaces: [
      { href: "/admin/manual-intake", label: "Manual intake", kind: "action" },
      { href: "/admin?filter=new-leads", label: "New leads", kind: "action" },
    ],
    customerActions: ["submit_intake", "attach_reference_files"],
    internalActions: ["manual_intake", "request_missing_requirements"],
    autoEvents: ["liff.intake.submitted", "manual_intake.created"],
    humanGateReasons: ["unclear_requirement", "unsupported_product", "missing_customer_identity"],
    summary: "ลูกค้าหรือแอดมินกรอก requirement; ระบบควร validate แล้วส่งต่อ review อัตโนมัติเมื่อข้อมูลพอ",
  },
  REQUIREMENTS_REVIEW: {
    state: "REQUIREMENTS_REVIEW",
    ownerKey: "crm",
    ownerLabel: "CRM / sales admin",
    automationMode: "auto_run",
    nextActionOwner: "system",
    primaryQueue: "new-leads",
    primarySurface: {
      href: "/admin?filter=new-leads",
      label: "Requirement review queue",
      kind: "action",
    },
    supportingSurfaces: [
      { href: "/admin/customers", label: "Customer profiles", kind: "action" },
    ],
    customerActions: [],
    internalActions: ["review_requirement", "create_quote", "hold_for_customer_input"],
    autoEvents: ["intake.validation.completed", "quote.created"],
    humanGateReasons: ["pricing_exception", "missing_dimensions", "ambiguous_reference"],
    summary: "ระบบควรประเมินความครบถ้วนและสร้าง quote เมื่อทำได้; คนเข้ามาเฉพาะเคสที่ข้อมูลหรือราคาไม่ชัด",
  },
  WAITING_QUOTE_APPROVAL: {
    state: "WAITING_QUOTE_APPROVAL",
    ownerKey: "sales",
    ownerLabel: "Sales / admin",
    automationMode: "customer_waiting",
    nextActionOwner: "customer",
    primaryQueue: "quote-decision",
    primarySurface: {
      href: "/quote/[token]",
      label: "Customer quote decision",
      kind: "action",
    },
    supportingSurfaces: [
      { href: "/admin?filter=quote-decision", label: "Quote decision queue", kind: "action" },
    ],
    customerActions: ["approve_quote", "reject_quote", "rescope_quote"],
    internalActions: ["follow_quote_decision", "reissue_quote"],
    autoEvents: ["quote.approved", "quote.rejected", "quote.rescope_requested"],
    humanGateReasons: ["customer_rescope_request", "quote_expired", "custom_discount_review"],
    summary: "ลูกค้าตัดสินใจใบเสนอราคา; หลัง approve ระบบต้อง route ไป payment gate หรือ design ตามกติกา payment",
  },
  WAITING_PAYMENT: {
    state: "WAITING_PAYMENT",
    ownerKey: "finance",
    ownerLabel: "Finance",
    automationMode: "human_gate",
    nextActionOwner: "internal",
    primaryQueue: "payment-ops",
    primarySurface: {
      href: "/admin/accounting",
      label: "Payment and document operations",
      kind: "action",
    },
    supportingSurfaces: [
      { href: "/admin?filter=payment-ops", label: "Payment ops queue", kind: "action" },
    ],
    customerActions: ["send_payment_evidence"],
    internalActions: ["update_payment_status", "update_payment_terms", "sync_payment_record"],
    autoEvents: ["payment.status_updated", "job.created_when_unlocked"],
    humanGateReasons: ["payment_not_confirmed", "deposit_missing", "payment_receiver_mismatch"],
    summary: "การเงินปลด payment gate; เมื่อผ่านแล้วระบบควรสร้างหรือ reuse job และขยับเข้า design เอง",
  },
  IN_DESIGN: {
    state: "IN_DESIGN",
    ownerKey: "design",
    ownerLabel: "Design / QA review",
    automationMode: "human_gate",
    nextActionOwner: "internal",
    primaryQueue: "design-ops",
    primarySurface: {
      href: "/admin/prompts",
      label: "Prompt and design preview workbench",
      kind: "action",
    },
    supportingSurfaces: [
      { href: "/studio", label: "Studio operations board", kind: "action" },
      { href: "/admin?filter=design-ops", label: "Design ops queue", kind: "action" },
    ],
    customerActions: [],
    internalActions: ["generate_ai_preview", "send_preview_to_customer", "mark_design_status"],
    autoEvents: ["ai_preview.generated", "preview.sent_to_customer", "design.approved"],
    humanGateReasons: ["visual_quality_review", "prompt_needs_edit", "ai_generation_failed", "customer_revision_requested"],
    summary: "ทีมออกแบบเป็นเจ้าของ preview loop; ระบบควรช่วย generate/send/route แต่ visual approval ยังต้อง human-gated",
  },
  IN_PRODUCTION: {
    state: "IN_PRODUCTION",
    ownerKey: "production",
    ownerLabel: "Production / fulfillment",
    automationMode: "human_gate",
    nextActionOwner: "internal",
    primaryQueue: "production-ops",
    primarySurface: {
      href: "/admin?filter=production-ops",
      label: "Production ops queue",
      kind: "action",
    },
    supportingSurfaces: [
      { href: "/admin/accounting", label: "Commercial document context", kind: "action" },
      { href: "/status/[token]", label: "Customer status", kind: "action" },
    ],
    customerActions: [],
    internalActions: ["move_to_ready_for_fulfillment", "upload_production_evidence", "hold_for_customer_input"],
    autoEvents: ["production_link.created", "customer.status_notified"],
    humanGateReasons: ["production_qc_needed", "material_or_file_issue", "commercial_gate_not_satisfied"],
    summary: "ทีมผลิตขยับงานจริง; ระบบต้องกันการเข้า production ถ้า payment/design/document gate ยังไม่ผ่าน",
  },
  READY_FOR_FULFILLMENT: {
    state: "READY_FOR_FULFILLMENT",
    ownerKey: "production",
    ownerLabel: "Production / fulfillment",
    automationMode: "human_gate",
    nextActionOwner: "internal",
    primaryQueue: "production-ops",
    primarySurface: {
      href: "/admin?filter=production-ops",
      label: "Fulfillment queue",
      kind: "action",
    },
    supportingSurfaces: [
      { href: "/status/[token]", label: "Customer status", kind: "action" },
    ],
    customerActions: [],
    internalActions: ["mark_fulfillment_complete", "send_completion_package"],
    autoEvents: ["fulfillment.ready", "customer.status_notified"],
    humanGateReasons: ["delivery_or_pickup_pending", "completion_package_review"],
    summary: "งานพร้อมส่งมอบ; คนยืนยัน fulfillment ส่วนระบบควรแจ้งลูกค้าและเตรียมหลักฐานปิดงาน",
  },
  ON_HOLD_CUSTOMER_INPUT: {
    state: "ON_HOLD_CUSTOMER_INPUT",
    ownerKey: "crm",
    ownerLabel: "CRM / follow-up",
    automationMode: "customer_waiting",
    nextActionOwner: "customer",
    primaryQueue: "customer-waiting",
    primarySurface: {
      href: "/admin/follow-up",
      label: "Customer waiting follow-up",
      kind: "action",
    },
    supportingSurfaces: [
      { href: "/status/[token]", label: "Customer status response", kind: "action" },
      { href: "/admin?filter=customer-waiting", label: "Customer waiting queue", kind: "action" },
    ],
    customerActions: ["resolve_hold", "request_design_revision_response"],
    internalActions: ["send_follow_up", "resume_after_customer_reply", "route_back_to_design"],
    autoEvents: ["customer.reply_received", "hold.resolved"],
    humanGateReasons: ["missing_customer_input", "revision_details_needed", "follow_up_overdue"],
    summary: "รอลูกค้าส่งข้อมูลหรือ feedback; ระบบควรตามและ resume state อัตโนมัติเมื่อข้อมูลกลับมา",
  },
  HUMAN_REVIEW_REQUIRED: {
    state: "HUMAN_REVIEW_REQUIRED",
    ownerKey: "owner",
    ownerLabel: "Owner / reviewer",
    automationMode: "human_gate",
    nextActionOwner: "internal",
    primaryQueue: "exceptions",
    primarySurface: {
      href: "/admin?filter=exceptions",
      label: "Exception review queue",
      kind: "action",
    },
    supportingSurfaces: [
      { href: "/admin/liff-monitor", label: "LIFF monitor", kind: "reference" },
      { href: "/flow", label: "Workflow policy reference", kind: "reference" },
    ],
    customerActions: ["contact_admin"],
    internalActions: ["resolve_exception", "return_to_previous_state", "cancel_job"],
    autoEvents: ["escalation.created", "exception.logged"],
    humanGateReasons: ["customer_requested_human", "policy_conflict", "system_error", "high_risk_decision"],
    summary: "ระบบหยุดเพื่อให้ reviewer ตัดสินใจ; ต้องมี reason code ชัดและ resume/cancel path เดียว",
  },
  COMPLETED: {
    state: "COMPLETED",
    ownerKey: "system",
    ownerLabel: "System archive",
    automationMode: "terminal",
    nextActionOwner: "none",
    primaryQueue: null,
    primarySurface: {
      href: "/status/[token]",
      label: "Completed customer status",
      kind: "action",
    },
    supportingSurfaces: [
      { href: "/admin/customers", label: "Customer history", kind: "reference" },
    ],
    customerActions: ["start_fresh_intake"],
    internalActions: ["review_history"],
    autoEvents: ["job.completed", "completion_package.sent"],
    humanGateReasons: [],
    summary: "งานจบแล้วและไม่ควรถูก reuse เป็น intake เดิม; ลูกค้าต้องเริ่มงานใหม่ถ้าจะทำต่อ",
  },
  CANCELLED: {
    state: "CANCELLED",
    ownerKey: "system",
    ownerLabel: "System archive",
    automationMode: "terminal",
    nextActionOwner: "none",
    primaryQueue: null,
    primarySurface: {
      href: "/status/[token]",
      label: "Cancelled customer status",
      kind: "action",
    },
    supportingSurfaces: [
      { href: "/admin/customers", label: "Customer history", kind: "reference" },
    ],
    customerActions: ["start_fresh_intake"],
    internalActions: ["review_cancel_reason"],
    autoEvents: ["quote.rejected", "job.cancelled"],
    humanGateReasons: [],
    summary: "งานถูกยกเลิกและเป็น terminal state; ห้าม route กลับไป workflow เดิมโดยเงียบ ๆ",
  },
} satisfies Record<WorkflowState, WorkflowOwnerContract>;

export function getWorkflowOwnerContract(
  state: WorkflowState
): WorkflowOwnerContract {
  return WORKFLOW_OWNER_MAP[state];
}

export function getWorkflowOwnerContracts(): WorkflowOwnerContract[] {
  return WORKFLOW_STATES.map((state) => WORKFLOW_OWNER_MAP[state]);
}

export function getWorkflowStatesByAutomationMode(
  mode: WorkflowAutomationMode
): WorkflowState[] {
  return WORKFLOW_STATES.filter(
    (state) => WORKFLOW_OWNER_MAP[state].automationMode === mode
  );
}

export function isHumanGateWorkflowState(state: WorkflowState): boolean {
  return WORKFLOW_OWNER_MAP[state].automationMode === "human_gate";
}

export function isTerminalWorkflowOwnerState(state: WorkflowState): boolean {
  return WORKFLOW_OWNER_MAP[state].automationMode === "terminal";
}
