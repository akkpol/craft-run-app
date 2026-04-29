export function quoteUnlocksProduction(paymentTerms: string, paymentStatus: string) {
  if (paymentTerms === "credit") {
    return paymentStatus === "not_required" || paymentStatus === "paid";
  }

  if (paymentTerms === "deposit") {
    return paymentStatus === "partial" || paymentStatus === "paid";
  }

  return paymentStatus === "paid";
}

export function getConversationActionLabel(
  currentState: string,
  context: "escalation" | "blocked" | "waiting-customer"
) {
  if (context === "escalation") {
    return "ตอบเคสนี้";
  }

  if (context === "blocked") {
    return "ปลดล็อก workflow";
  }

  if (context === "waiting-customer" || currentState === "ON_HOLD_CUSTOMER_INPUT") {
    return "เช็กคำตอบลูกค้า";
  }

  if (currentState === "HUMAN_REVIEW_REQUIRED") {
    return "ตอบเคสนี้";
  }

  return "อัปเดต workflow";
}

export function getQuoteActionLabel(
  quoteStatus: string,
  paymentTerms: string,
  paymentStatus: string,
  hasJob: boolean
) {
  if (quoteStatus === "sent") {
    return "ติดตามการอนุมัติ";
  }

  if (quoteStatus === "approved" && !hasJob) {
    return quoteUnlocksProduction(paymentTerms, paymentStatus)
      ? "เช็กพร้อมเปิดงาน"
      : "อัปเดตการชำระ";
  }

  return "ดูแล quote";
}

export function getJobActionLabel(currentStatus: string) {
  switch (currentStatus) {
    case "IN_DESIGN":
      return "ขยับงานออกแบบ";
    case "ON_HOLD_CUSTOMER_INPUT":
      return "ปลดล็อกงานนี้";
    case "IN_PRODUCTION":
      return "อัปเดตงานผลิต";
    case "READY_FOR_FULFILLMENT":
      return "ปิดงานส่งมอบ";
    case "HUMAN_REVIEW_REQUIRED":
      return "เคลียร์เคสหน้างาน";
    default:
      return "อัปเดตสถานะงาน";
  }
}