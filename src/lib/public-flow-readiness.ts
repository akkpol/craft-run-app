import {
  getAdminQueueContract,
  type AdminQueueFilterKey,
} from "./admin-queue-contract";

type PublicNextActionOwner = "customer" | "internal";

export type PublicFlowReadinessSummary = {
  queueKey: AdminQueueFilterKey;
  queueLabel: string;
  ownerLabel: string;
  headline: string;
  detail: string;
  nextActionLabel: string;
  nextActionOwner: PublicNextActionOwner;
};

type ReturningCustomerReplyType =
  | "intake_link"
  | "resume_or_fresh"
  | "quote_approval_context"
  | "payment_context"
  | "production_status"
  | "terminal_fresh_intake";

function buildSummary(input: {
  queueKey: AdminQueueFilterKey;
  headline: string;
  detail: string;
  nextActionLabel: string;
  nextActionOwner: PublicNextActionOwner;
}): PublicFlowReadinessSummary {
  const contract = getAdminQueueContract(input.queueKey);

  return {
    queueKey: input.queueKey,
    queueLabel: contract.label,
    ownerLabel: contract.ownerLabel,
    headline: input.headline,
    detail: input.detail,
    nextActionLabel: input.nextActionLabel,
    nextActionOwner: input.nextActionOwner,
  };
}

export function getLineReplyReadinessSummary(
  replyType: ReturningCustomerReplyType
): PublicFlowReadinessSummary {
  switch (replyType) {
    case "quote_approval_context":
      return buildSummary({
        queueKey: "quote-decision",
        headline: "ระบบกำลังรอคำตอบจากคุณเรื่องใบเสนอราคา",
        detail: "เปิดใบเสนอราคาเพื่อตรวจรายละเอียด อนุมัติ หรือขอปรับงานต่อจากหน้าที่ส่งให้",
        nextActionLabel: "ตรวจและตอบกลับใบเสนอราคา",
        nextActionOwner: "customer",
      });
    case "payment_context":
      return buildSummary({
        queueKey: "payment-ops",
        headline: "งานนี้อยู่ในช่วงยืนยันการชำระเงิน",
        detail: "หลังชำระแล้วให้ส่งหลักฐานกลับมาใน LINE เพื่อให้ทีมงานตรวจสอบและปลดล็อกขั้นถัดไป",
        nextActionLabel: "ชำระเงินและส่งหลักฐาน",
        nextActionOwner: "customer",
      });
    case "production_status":
      return buildSummary({
        queueKey: "production-ops",
        headline: "งานอยู่ระหว่างดำเนินการของทีมงาน",
        detail: "ใช้หน้า status เพื่อติดตามความคืบหน้าและตอบเฉพาะเมื่อระบบแจ้งว่าต้องการข้อมูลจากคุณ",
        nextActionLabel: "ติดตามสถานะล่าสุด",
        nextActionOwner: "internal",
      });
    case "terminal_fresh_intake":
      return buildSummary({
        queueKey: "new-leads",
        headline: "หากต้องการเริ่มงานใหม่ สามารถส่งรายละเอียดรอบใหม่ได้เลย",
        detail: "ระบบจะเปิดคำขอใหม่ให้และไม่ปนกับงานเก่าที่ปิดหรือยกเลิกไปแล้ว",
        nextActionLabel: "เริ่มคำขอใหม่",
        nextActionOwner: "customer",
      });
    case "resume_or_fresh":
    case "intake_link":
    default:
      return buildSummary({
        queueKey: "new-leads",
        headline: "ระบบกำลังเก็บ requirement เพื่อเตรียมออกใบเสนอราคา",
        detail: "กรอกข้อมูลหลักของงานให้ครบ แล้วระบบจะพาไปขั้นถัดไปโดยไม่ต้องเริ่มใหม่ทั้งงาน",
        nextActionLabel: "กรอกข้อมูลที่ขาดให้ครบ",
        nextActionOwner: "customer",
      });
  }
}

export function getLiffReadinessSummary(input: {
  intakeMode: "resume" | "fresh";
}): PublicFlowReadinessSummary {
  return buildSummary({
    queueKey: "new-leads",
    headline:
      input.intakeMode === "resume"
        ? "กำลังต่อข้อมูลเดิมเพื่อให้ทีมงานออกใบเสนอราคาได้"
        : "กำลังเริ่ม lead ใหม่เพื่อเตรียมออกใบเสนอราคา",
    detail:
      input.intakeMode === "resume"
        ? "กรอกเฉพาะรายละเอียดที่ยังขาดหรืออัปเดตข้อมูลล่าสุด ระบบจะไม่พาคุณกลับไปเริ่มทั้งขั้นตอนโดยไม่จำเป็น"
        : "กรอกข้อมูลหลักของงานให้ครบ ระบบจะใช้ชุดข้อมูลนี้เป็นฐานสำหรับประเมินราคา ออกใบเสนอราคา และขั้นตอนถัดไป",
    nextActionLabel: "ส่งรายละเอียดงาน",
    nextActionOwner: "customer",
  });
}

export function getQuotePageReadinessSummary(input: {
  hasJob: boolean;
  waitingPayment: boolean;
  isApproved: boolean;
  isRejected: boolean;
  isExpired: boolean;
  commercialGateActive: boolean;
  commercialHeadline?: string | null;
}): PublicFlowReadinessSummary {
  if (input.commercialGateActive) {
    return buildSummary({
      queueKey: "commercial-gate",
      headline:
        input.commercialHeadline ||
        "ทีมงานกำลังเคลียร์ commercial gate ก่อนปล่อยงานต่อ",
      detail:
        "ขั้นนี้เป็นงานฝั่งเอกสารของทีมงาน ระบบจะยึดกติกาเงินเข้าใคร เอกสารออกชื่อนั้นก่อนเปิดงานขั้นถัดไป",
      nextActionLabel: "รอทีมงานยืนยันเอกสาร",
      nextActionOwner: "internal",
    });
  }

  if (input.hasJob) {
    return buildSummary({
      queueKey: "production-ops",
      headline: "ทีมงานรับงานนี้เข้าสู่การดำเนินการแล้ว",
      detail: "จากจุดนี้ owner หลักอยู่ที่ฝ่ายปฏิบัติการ คุณติดตามความคืบหน้าได้จากหน้า status ด้วยเลขติดตามเดิม",
      nextActionLabel: "ติดตามสถานะงาน",
      nextActionOwner: "internal",
    });
  }

  if (input.waitingPayment) {
    return buildSummary({
      queueKey: "payment-ops",
      headline: "ใบเสนอราคาอนุมัติแล้ว และกำลังรอยืนยันการชำระเงิน",
      detail: "เมื่อชำระแล้วให้ส่งหลักฐานกลับมาใน LINE แชตนี้ เพื่อให้ทีมงานตรวจสอบและปลดล็อกขั้นถัดไป",
      nextActionLabel: "ชำระเงินและส่งหลักฐาน",
      nextActionOwner: "customer",
    });
  }

  if (!input.isApproved && !input.isRejected && !input.isExpired) {
    return buildSummary({
      queueKey: "quote-decision",
      headline: "ตอนนี้คิวหลักของงานนี้คือการตัดสินใจเรื่องใบเสนอราคา",
      detail: "ตรวจราคา เงื่อนไข และรายละเอียดงานให้ครบก่อนอนุมัติหรือส่งกลับเพื่อปรับแก้",
      nextActionLabel: "ตรวจและตอบกลับใบเสนอราคา",
      nextActionOwner: "customer",
    });
  }

  return buildSummary({
    queueKey: "quote-decision",
    headline: "ทีมงานจะอัปเดตขั้นตอนถัดไปให้จากสถานะของใบเสนอราคานี้",
    detail: "หากต้องการกลับมาแก้รายละเอียดหรือขอใบเสนอราคาใหม่ สามารถติดต่อทีมงานได้จากช่องทางเดิม",
    nextActionLabel: "รออัปเดตจากทีมงาน",
    nextActionOwner: "internal",
  });
}

export function getStatusPageReadinessSummary(input: {
  waitingQuoteApproval: boolean;
  showDesignActions: boolean;
  showHoldResolution: boolean;
  commercialGateActive: boolean;
  commercialHeadline?: string | null;
  jobStatus?: string | null;
}): PublicFlowReadinessSummary {
  if (input.waitingQuoteApproval) {
    return buildSummary({
      queueKey: "quote-decision",
      headline: "งานนี้ยังรอการอนุมัติใบเสนอราคาจากคุณ",
      detail: "เปิดหน้า quote เพื่อตรวจรายละเอียดและตอบกลับก่อนที่ทีมงานจะขยับไปขั้นการชำระหรือการผลิต",
      nextActionLabel: "ไปตอบใบเสนอราคา",
      nextActionOwner: "customer",
    });
  }

  if (input.commercialGateActive) {
    return buildSummary({
      queueKey: "commercial-gate",
      headline:
        input.commercialHeadline ||
        "ทีมงานกำลังดูแลเอกสารหลังรับชำระก่อนปลดล็อกขั้นถัดไป",
      detail:
        "ขั้นนี้เป็นงานฝั่งเอกสารของทีมงาน คุณไม่ต้องกลับไปกรอกฟอร์มใหม่ ระบบจะอัปเดตจากฝั่งทีมงานให้เมื่อพร้อม",
      nextActionLabel: "รอทีมงานยืนยันเอกสาร",
      nextActionOwner: "internal",
    });
  }

  if (input.showDesignActions) {
    return buildSummary({
      queueKey: "design-ops",
      headline: "งานนี้กำลังรอคำตอบจากคุณเรื่องแบบ",
      detail: "ตรวจ preview แล้วเลือกอนุมัติแบบหรือขอแก้ไขจากหน้านี้เพื่อให้ทีมออกแบบขยับต่อได้ทันที",
      nextActionLabel: "อนุมัติแบบหรือขอแก้ไข",
      nextActionOwner: "customer",
    });
  }

  if (input.showHoldResolution) {
    return buildSummary({
      queueKey: "customer-waiting",
      headline: "ทีมงานยังรอข้อมูลเพิ่มเติมจากคุณ",
      detail: "ส่งข้อมูลหรือคำตอบที่ระบบขอจากหน้านี้ได้เลย แล้ว flow จะเดินต่อโดยไม่ต้องเริ่มคำขอใหม่",
      nextActionLabel: "ส่งข้อมูลที่ทีมงานรอ",
      nextActionOwner: "customer",
    });
  }

  return buildSummary({
    queueKey: "production-ops",
    headline: "ตอนนี้คิวหลักของงานอยู่กับทีมงานภายใน",
    detail:
      input.jobStatus === "READY_FOR_FULFILLMENT"
        ? "ทีมงานกำลังเตรียมส่งมอบหรือเข้าติดตั้ง เมื่อมี action ที่ต้องทำเพิ่ม ระบบจะแจ้งจากหน้านี้"
        : "ทีมงานกำลังขยับงานตามขั้นตอนการออกแบบ ผลิต หรือส่งมอบ คุณติดตามความคืบหน้าได้จากหน้านี้ตลอดเวลา",
    nextActionLabel: "ติดตามความคืบหน้าล่าสุด",
    nextActionOwner: "internal",
  });
}