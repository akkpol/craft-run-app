import {
  getConversationActionLabel,
  getJobActionLabel,
  getQuoteActionLabel,
  quoteUnlocksProduction,
} from "@/lib/admin-action-labels";
import {
  ADMIN_QUEUE_FILTER_KEYS,
  getAdminQueueContract,
  type AdminQueueFilterKey,
  type AdminQueueOwnerKey,
} from "@/lib/admin-queue-contract";
import type { AdminOverviewPage, AdminOverviewRow } from "@/lib/admin-overview";
import {
  getWorkflowOwnerContract,
  type WorkflowAutomationMode,
} from "@/lib/workflow-owner-map";
import { normalizeWorkflowState, type WorkflowState } from "@/lib/workflow-state";

type CardStatusTone = "neutral" | "info" | "warning" | "danger" | "success" | "accent";

export type AdminOverviewCardModel = {
  id: string;
  rowKind: AdminOverviewRow["kind"];
  filterKey: AdminOverviewRow["filterKey"];
  queueLabel: string;
  queueDescription: string;
  ownerKey: AdminQueueOwnerKey | string;
  ownerLabel: string;
  automationMode: WorkflowAutomationMode;
  nextActionOwner: "internal" | "customer" | "system" | "none";
  title: string;
  subtitle: string;
  workflowState: WorkflowState | null;
  workflowLabel: string;
  statusLabel: string;
  statusTone: CardStatusTone;
  stopReasonLabel: string;
  contextChips: string[];
  evidenceSummary: string[];
  primaryActionLabel: string;
  primarySurfaceLabel: string;
  primarySurfaceHref: string;
  summary: string;
  row: AdminOverviewRow;
};

export type AdminOverviewCardGroup = {
  key: AdminQueueFilterKey;
  label: string;
  description: string;
  ownerLabel: string;
  count: number;
  cards: AdminOverviewCardModel[];
};

const STOP_REASON_LABELS: Record<string, string> = {
  unclear_requirement: "รายละเอียดงานยังไม่ชัด",
  unsupported_product: "สินค้ายังไม่อยู่ใน flow ที่รองรับ",
  missing_customer_identity: "ยังไม่ยืนยันตัวตนลูกค้า",
  pricing_exception: "ต้องให้คนตรวจราคา",
  missing_dimensions: "ขนาดงานยังไม่ครบ",
  ambiguous_reference: "reference ยังไม่ชัดพอออก quote",
  customer_rescope_request: "ลูกค้าขอปรับ scope งาน",
  quote_expired: "ใบเสนอราคาหมดอายุ",
  custom_discount_review: "ส่วนลดต้องให้คนอนุมัติ",
  payment_not_confirmed: "ยังไม่ยืนยันการชำระ",
  deposit_missing: "ยอดมัดจำยังไม่ถึงเกณฑ์เปิดงาน",
  payment_receiver_mismatch: "ผู้รับชำระไม่ตรงกับผู้ออกเอกสาร",
  visual_quality_review: "ต้องมีคนตรวจคุณภาพภาพ",
  prompt_needs_edit: "ต้องแก้ prompt ก่อนส่งต่อ",
  ai_generation_failed: "AI สร้างภาพไม่สำเร็จ",
  customer_revision_requested: "ลูกค้าขอแก้แบบ",
  production_qc_needed: "ต้องตรวจคุณภาพก่อนส่งมอบ",
  material_or_file_issue: "ไฟล์หรือวัสดุยังมีปัญหา",
  commercial_gate_not_satisfied: "เอกสารการค้ายังไม่เคลียร์",
  delivery_or_pickup_pending: "ยังไม่ยืนยันการส่งมอบ",
  completion_package_review: "ต้องเช็กชุดปิดงานก่อน",
  missing_customer_input: "รอข้อมูลจากลูกค้า",
  revision_details_needed: "รอรายละเอียดการแก้แบบ",
  follow_up_overdue: "follow-up เกินเวลาแล้ว",
  customer_requested_human: "ลูกค้าขอคุยกับคน",
  policy_conflict: "ติด policy conflict",
  system_error: "ระบบต้องให้คนช่วยแก้",
  high_risk_decision: "เป็นเคสเสี่ยงสูงต้องให้คนตัดสินใจ",
};

const WORKFLOW_STATE_LABELS: Record<WorkflowState, string> = {
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

const JOB_STATUS_LABELS: Record<string, string> = {
  IN_DESIGN: "กำลังออกแบบ",
  IN_PRODUCTION: "กำลังผลิต",
  READY_FOR_FULFILLMENT: "พร้อมส่งมอบ",
  ON_HOLD_CUSTOMER_INPUT: "รอข้อมูลจากลูกค้า",
  HUMAN_REVIEW_REQUIRED: "รอทีมงานตรวจสอบ",
  COMPLETED: "เสร็จสมบูรณ์",
  CANCELLED: "ยกเลิก",
};

const PAYMENT_TERM_LABELS: Record<string, string> = {
  prepaid: "จ่ายเต็มก่อนเริ่มงาน",
  deposit: "มัดจำก่อนเริ่มงาน",
  credit: "เครดิตลูกค้า",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  unpaid: "ยังไม่รับชำระ",
  partial: "รับมัดจำแล้ว",
  paid: "ชำระครบแล้ว",
  not_required: "ยังไม่ต้องรับชำระก่อนผลิต",
};

const QUOTE_STATUS_LABELS: Record<string, string> = {
  draft: "ร่างใบเสนอราคา",
  sent: "รอลูกค้าอนุมัติ",
  approved: "อนุมัติแล้ว",
  rejected: "ปฏิเสธแล้ว",
  expired: "หมดอายุ",
};

const DOCUMENT_REQUEST_LABELS: Record<string, string> = {
  quotation: "ขอใบเสนอราคา",
  billing_note: "ขอใบวางบิล",
  invoice: "ขอใบแจ้งหนี้",
  receipt: "ขอใบเสร็จ",
  tax_invoice: "ขอใบกำกับภาษี",
  tax_invoice_receipt: "ขอใบกำกับภาษีพร้อมใบเสร็จ",
};

const BILLING_ENTITY_LABELS: Record<string, string> = {
  person: "บุคคลธรรมดา",
  company: "บริษัท / นิติบุคคล",
};

const LIFF_CONTEXT_LABELS: Record<string, string> = {
  utou: "LIFF 1:1",
  group: "LIFF Group",
  room: "LIFF Room",
  external: "External browser",
  none: "Other LINE surface",
};

function getWorkflowStateForRow(row: AdminOverviewRow): WorkflowState | null {
  if (row.kind === "conversation") {
    return row.conversationState;
  }

  if (row.kind === "escalation") {
    return row.conversationState || "HUMAN_REVIEW_REQUIRED";
  }

  if (row.kind === "quote") {
    if (row.filterKey === "commercial-gate") {
      return "WAITING_PAYMENT";
    }

    return "WAITING_QUOTE_APPROVAL";
  }

  if (row.kind === "production-review") {
    return "IN_DESIGN";
  }

  if (row.kind === "running-job") {
    return normalizeWorkflowState(row.jobStatus);
  }

  return null;
}

function getCardStatusTone(mode: WorkflowAutomationMode): CardStatusTone {
  switch (mode) {
    case "auto_run":
      return "success";
    case "customer_waiting":
      return "info";
    case "human_gate":
      return "warning";
    case "terminal":
      return "neutral";
  }
}

function getCardStatusLabel(row: AdminOverviewRow, workflowState: WorkflowState | null) {
  if (row.kind === "quote") {
    return row.filterKey === "commercial-gate"
      ? "ติดด่านเอกสารการค้า"
      : WORKFLOW_STATE_LABELS.WAITING_QUOTE_APPROVAL;
  }

  if (row.kind === "running-job") {
    return JOB_STATUS_LABELS[row.jobStatus] || row.jobStatus;
  }

  if (workflowState) {
    return WORKFLOW_STATE_LABELS[workflowState];
  }

  return getAdminQueueContract(row.filterKey).label;
}

function getContextChips(row: AdminOverviewRow): string[] {
  return [
    row.documentRequestType
      ? DOCUMENT_REQUEST_LABELS[row.documentRequestType] || row.documentRequestType
      : null,
    row.billingEntityType
      ? BILLING_ENTITY_LABELS[row.billingEntityType] || row.billingEntityType
      : null,
    row.liffContextType
      ? LIFF_CONTEXT_LABELS[row.liffContextType] || row.liffContextType
      : null,
    row.lineFriendshipStatus === true
      ? "เป็นเพื่อน OA แล้ว"
      : row.lineFriendshipStatus === false
        ? "ยังไม่ได้เพิ่ม OA"
        : null,
    row.liffAppLanguage ? `ภาษา ${row.liffAppLanguage}` : null,
  ].filter((value): value is string => Boolean(value));
}

function fallbackStopReason(row: AdminOverviewRow, workflowState: WorkflowState | null) {
  if (row.kind === "escalation") {
    return row.reason;
  }

  if (row.kind === "conversation") {
    if (row.filterKey === "new-leads") {
      if (row.conversationState === "NEW_MESSAGE") {
        return "ยังไม่ได้เริ่มเก็บ requirement";
      }

      if (row.conversationState === "COLLECTING_REQUIREMENTS") {
        return "รอลูกค้ากรอก requirement ให้ครบ";
      }

      return "กำลังตรวจ requirement ก่อนออก quote";
    }

    if (row.filterKey === "payment-ops") {
      if (row.paymentStatus === "partial") {
        return "มัดจำยังไม่ถึงเกณฑ์เปิดงาน";
      }

      if (row.paymentStatus === "paid") {
        return "ยังต้องให้ทีมตรวจ payment/commercial gate";
      }

      return "ยังไม่ยืนยันการชำระ";
    }

    return row.note || "รอข้อมูลหรือ feedback จากลูกค้า";
  }

  if (row.kind === "quote") {
    if (row.filterKey === "commercial-gate") {
      return "receiver lock หรือเอกสารการค้ายังไม่เคลียร์";
    }

    if (row.quoteStatus === "sent") {
      return "รอลูกค้าตัดสินใจ quote";
    }

    if (!quoteUnlocksProduction(row.paymentTerms, row.paymentStatus)) {
      return "payment gate ยังไม่ผ่าน";
    }

    return "ระบบควรเปิดงานต่อแต่ยังไม่มี job";
  }

  if (row.kind === "production-review") {
    return row.note || "รอตรวจหลักฐานจากหน้างาน";
  }

  if (row.kind === "running-job") {
    if (row.pendingReviewCount > 0) {
      return `มีหลักฐานรอตรวจ ${row.pendingReviewCount} รายการ`;
    }

    if (row.jobStatus === "READY_FOR_FULFILLMENT") {
      return "รอยืนยันการส่งมอบ";
    }

    if (row.jobStatus === "IN_DESIGN") {
      return row.previewImageCount > 0
        ? "มี preview ให้ขยับงานต่อ"
        : "ยังไม่มี preview สำหรับส่งลูกค้า";
    }

    if (row.jobStatus === "ON_HOLD_CUSTOMER_INPUT") {
      return "รอข้อมูลจากลูกค้า";
    }

    if (row.jobStatus === "HUMAN_REVIEW_REQUIRED") {
      return "ต้องให้ reviewer ตัดสินใจ";
    }

    return "งานยังอยู่ใน flow การผลิต";
  }

  if (workflowState) {
    return WORKFLOW_STATE_LABELS[workflowState];
  }

  return getAdminQueueContract(row.filterKey).description;
}

function getStopReasonLabel(row: AdminOverviewRow, workflowState: WorkflowState | null) {
  if (row.kind === "escalation") {
    return row.reason;
  }

  if (row.kind === "conversation" && row.filterKey === "customer-waiting" && row.note) {
    return row.note;
  }

  if (row.kind === "running-job" && row.pendingReviewCount > 0) {
    return `มีหลักฐานรอตรวจ ${row.pendingReviewCount} รายการ`;
  }

  const contract = workflowState ? getWorkflowOwnerContract(workflowState) : null;

  if (contract?.automationMode === "human_gate") {
    const priorityReason = contract.humanGateReasons.find((reason) => {
      if (row.kind === "conversation" && row.filterKey === "payment-ops") {
        if (reason === "deposit_missing" && row.paymentStatus === "partial") {
          return true;
        }

        if (reason === "payment_not_confirmed" && row.paymentStatus === "unpaid") {
          return true;
        }
      }

      if (row.kind === "running-job" && row.jobStatus === "IN_PRODUCTION") {
        return reason === "production_qc_needed";
      }

      if (row.kind === "running-job" && row.jobStatus === "READY_FOR_FULFILLMENT") {
        return reason === "delivery_or_pickup_pending";
      }

      if (row.kind === "production-review") {
        return reason === "visual_quality_review" || reason === "prompt_needs_edit";
      }

      if (row.kind === "escalation") {
        return reason === "customer_requested_human" || reason === "high_risk_decision";
      }

      return false;
    });

    if (priorityReason && STOP_REASON_LABELS[priorityReason]) {
      return STOP_REASON_LABELS[priorityReason];
    }

    const firstReason = contract.humanGateReasons[0];
    if (firstReason && STOP_REASON_LABELS[firstReason]) {
      return STOP_REASON_LABELS[firstReason];
    }
  }

  return fallbackStopReason(row, workflowState);
}

function getEvidenceSummary(row: AdminOverviewRow): string[] {
  if (row.kind === "conversation") {
    return [
      row.quoteStatus
        ? `ใบเสนอราคา: ${QUOTE_STATUS_LABELS[row.quoteStatus] || row.quoteStatus}`
        : "ยังไม่มีใบเสนอราคา",
      row.paymentStatus
        ? `การชำระ: ${PAYMENT_STATUS_LABELS[row.paymentStatus]}`
        : null,
      row.jobStatus
        ? `สถานะงาน: ${JOB_STATUS_LABELS[row.jobStatus] || row.jobStatus}`
        : null,
    ].filter((value): value is string => Boolean(value));
  }

  if (row.kind === "quote") {
    return [
      `เงื่อนไขชำระ: ${PAYMENT_TERM_LABELS[row.paymentTerms]}`,
      `การชำระ: ${PAYMENT_STATUS_LABELS[row.paymentStatus]}`,
      row.hasJob ? "สร้าง job แล้ว" : "ยังไม่สร้าง job",
    ];
  }

  if (row.kind === "production-review") {
    return [
      `ไฟล์หลักฐาน ${row.assetCount} ชิ้น`,
      row.submittedByLabel ? `ผู้ส่ง ${row.submittedByLabel}` : null,
      row.sentToCustomerAt ? "ส่งให้ลูกค้าแล้ว" : "ยังไม่ส่งให้ลูกค้า",
    ].filter((value): value is string => Boolean(value));
  }

  if (row.kind === "running-job") {
    return [
      row.pendingReviewCount > 0
        ? `รอตรวจ ${row.pendingReviewCount} รายการ`
        : "ไม่มี review ค้าง",
      row.assignedTo ? `ผู้รับผิดชอบ ${row.assignedTo}` : "ยังไม่ assign ผู้รับผิดชอบ",
      row.previewImageCount > 0 ? `มี preview ${row.previewImageCount} แบบ` : null,
      row.productionStatus ? `หน้างาน ${row.productionStatus}` : null,
    ].filter((value): value is string => Boolean(value));
  }

  if (row.kind === "escalation") {
    return [
      row.quoteStatus
        ? `ใบเสนอราคา: ${QUOTE_STATUS_LABELS[row.quoteStatus] || row.quoteStatus}`
        : "ยังไม่มีใบเสนอราคา",
      row.paymentStatus
        ? `การชำระ: ${PAYMENT_STATUS_LABELS[row.paymentStatus]}`
        : null,
    ].filter((value): value is string => Boolean(value));
  }

  return [];
}

function getPrimaryActionLabel(row: AdminOverviewRow) {
  if (row.kind === "conversation") {
    return getConversationActionLabel(row.conversationState, row.filterKey);
  }

  if (row.kind === "escalation") {
    return row.conversationState
      ? getConversationActionLabel(row.conversationState, "exceptions")
      : "ตอบเคสนี้";
  }

  if (row.kind === "quote") {
    return getQuoteActionLabel(
      row.quoteStatus,
      row.paymentTerms,
      row.paymentStatus,
      row.hasJob
    );
  }

  if (row.kind === "production-review") {
    return "ตรวจหลักฐาน";
  }

  return getJobActionLabel(row.jobStatus);
}

function getPrimarySurface(row: AdminOverviewRow, workflowState: WorkflowState | null) {
  if (row.kind === "quote" && row.filterKey === "commercial-gate") {
    return {
      href: "/admin/accounting",
      label: "เอกสาร / การเงิน",
    };
  }

  if (workflowState) {
    const contract = getWorkflowOwnerContract(workflowState);
    return {
      href: contract.primarySurface.href,
      label: contract.primarySurface.label,
    };
  }

  return {
    href: `/admin?filter=${row.filterKey}`,
    label: getAdminQueueContract(row.filterKey).label,
  };
}

export function buildAdminOverviewCardModel(
  row: AdminOverviewRow
): AdminOverviewCardModel {
  const workflowState = getWorkflowStateForRow(row);
  const queueContract = getAdminQueueContract(row.filterKey);
  const workflowContract = workflowState
    ? getWorkflowOwnerContract(workflowState)
    : null;
  const primarySurface = getPrimarySurface(row, workflowState);

  return {
    id: row.id,
    rowKind: row.kind,
    filterKey: row.filterKey,
    queueLabel: queueContract.label,
    queueDescription: queueContract.description,
    ownerKey: workflowContract?.ownerKey || queueContract.ownerKey,
    ownerLabel: workflowContract?.ownerLabel || queueContract.ownerLabel,
    automationMode: workflowContract?.automationMode || "human_gate",
    nextActionOwner: workflowContract?.nextActionOwner || queueContract.nextActionOwner,
    title: row.customerLabel,
    subtitle: row.productLabel,
    workflowState,
    workflowLabel: workflowState ? WORKFLOW_STATE_LABELS[workflowState] : queueContract.label,
    statusLabel: getCardStatusLabel(row, workflowState),
    statusTone: getCardStatusTone(workflowContract?.automationMode || "human_gate"),
    stopReasonLabel: getStopReasonLabel(row, workflowState),
    contextChips: getContextChips(row),
    evidenceSummary: getEvidenceSummary(row),
    primaryActionLabel: getPrimaryActionLabel(row),
    primarySurfaceLabel: primarySurface.label,
    primarySurfaceHref: primarySurface.href,
    summary: workflowContract?.summary || queueContract.description,
    row,
  };
}

export function buildAdminOverviewCardGroups(
  overview: Pick<AdminOverviewPage, "filter" | "rows">
): AdminOverviewCardGroup[] {
  const activeKeys = overview.filter === "all"
    ? ADMIN_QUEUE_FILTER_KEYS.filter(
        (key): key is Exclude<AdminQueueFilterKey, "all"> => key !== "all"
      )
    : [overview.filter];

  return activeKeys
    .map((key) => {
      const contract = getAdminQueueContract(key);
      const cards = overview.rows
        .filter((row) => row.filterKey === key)
        .map(buildAdminOverviewCardModel);

      return {
        key,
        label: contract.label,
        description: contract.description,
        ownerLabel: contract.ownerLabel,
        count: cards.length,
        cards,
      };
    })
    .filter((group) => group.count > 0 || overview.filter === group.key);
}