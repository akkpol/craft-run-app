import test from "node:test";
import assert from "node:assert/strict";

import {
  getConversationActionLabel,
  getJobActionLabel,
  getQuoteActionLabel,
  quoteUnlocksProduction,
} from "../src/lib/admin-action-labels.ts";

test("payment-ops queue keeps the finance-first CTA for human-review conversations", () => {
  assert.equal(
    getConversationActionLabel("HUMAN_REVIEW_REQUIRED", "payment-ops"),
    "เคลียร์ payment gate"
  );
  assert.equal(
    getConversationActionLabel("HUMAN_REVIEW_REQUIRED", "exceptions"),
    "ตอบเคสนี้"
  );
});

test("customer-waiting queue keeps the customer-follow-up CTA", () => {
  assert.equal(
    getConversationActionLabel("ON_HOLD_CUSTOMER_INPUT", "customer-waiting"),
    "เช็กคำตอบลูกค้า"
  );
  assert.equal(
    getConversationActionLabel("ON_HOLD_CUSTOMER_INPUT", "payment-ops"),
    "เคลียร์ payment gate"
  );
});

test("quote CTA labels match approval and payment gates", () => {
  assert.equal(getQuoteActionLabel("sent", "prepaid", "unpaid", false), "ติดตามการอนุมัติ");
  assert.equal(getQuoteActionLabel("approved", "prepaid", "unpaid", false), "อัปเดตการชำระ");
  assert.equal(getQuoteActionLabel("approved", "deposit", "partial", false), "เช็กพร้อมเปิดงาน");
  assert.equal(getQuoteActionLabel("approved", "credit", "not_required", true), "ดูแล quote");
});

test("job CTA labels reflect the next operational step", () => {
  assert.equal(getJobActionLabel("IN_DESIGN"), "ขยับงานออกแบบ");
  assert.equal(getJobActionLabel("ON_HOLD_CUSTOMER_INPUT"), "ปลดล็อกงานนี้");
  assert.equal(getJobActionLabel("IN_PRODUCTION"), "อัปเดตงานผลิต");
  assert.equal(getJobActionLabel("READY_FOR_FULFILLMENT"), "ปิดงานส่งมอบ");
  assert.equal(getJobActionLabel("unknown"), "อัปเดตสถานะงาน");
});

test("production unlock rules stay aligned with payment terms", () => {
  assert.equal(quoteUnlocksProduction("credit", "not_required"), true);
  assert.equal(quoteUnlocksProduction("deposit", "partial"), true);
  assert.equal(quoteUnlocksProduction("deposit", "unpaid"), false);
  assert.equal(quoteUnlocksProduction("prepaid", "paid"), true);
  assert.equal(quoteUnlocksProduction("prepaid", "partial"), false);
});