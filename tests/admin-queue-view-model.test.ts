import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAdminOverviewCardGroups,
  buildAdminOverviewCardModel,
} from "../src/lib/admin-queue-view-model.ts";
import type { AdminOverviewRow } from "../src/lib/admin-overview.ts";

test("payment-ops conversation cards inherit finance ownership and payment gate messaging", () => {
  const row: AdminOverviewRow = {
    kind: "conversation",
    id: "conv-payment",
    filterKey: "payment-ops",
    ownerKey: "finance",
    readinessStage: "payment",
    nextActionOwner: "internal",
    sortAt: "2026-05-04T10:00:00.000Z",
    messageAt: "2026-05-04T10:00:00.000Z",
    conversationId: "conv-payment",
    conversationState: "WAITING_PAYMENT",
    customerLabel: "Payment Gate",
    productLabel: "signage",
    documentRequestType: null,
    billingEntityType: null,
    billingName: null,
    lineFriendshipStatus: null,
    liffContextType: null,
    liffAppLanguage: null,
    note: null,
    quoteStatus: "approved",
    paymentStatus: "unpaid",
    jobStatus: null,
  };

  const card = buildAdminOverviewCardModel(row);

  assert.equal(card.ownerLabel, "การเงิน");
  assert.equal(card.automationMode, "human_gate");
  assert.equal(card.primaryActionLabel, "เคลียร์ payment gate");
  assert.equal(card.stopReasonLabel, "ยังไม่ยืนยันการชำระ");
  assert.equal(card.primarySurfaceHref, "/admin/accounting");
});

test("quote-decision cards explain customer approval work and keep customer waiting mode", () => {
  const row: AdminOverviewRow = {
    kind: "quote",
    id: "quote-1",
    quoteId: "quote-1",
    filterKey: "quote-decision",
    ownerKey: "sales",
    readinessStage: "quote",
    nextActionOwner: "internal",
    sortAt: "2026-05-04T09:00:00.000Z",
    createdAt: "2026-05-04T09:00:00.000Z",
    customerLabel: "Quote Customer",
    productLabel: "signage",
    documentRequestType: null,
    billingEntityType: null,
    billingName: null,
    lineFriendshipStatus: null,
    liffContextType: null,
    liffAppLanguage: null,
    total: 2500,
    publicToken: "quote-token",
    quoteStatus: "sent",
    paymentTerms: "prepaid",
    paymentStatus: "unpaid",
    hasJob: false,
    commercialOrder: null,
  };

  const card = buildAdminOverviewCardModel(row);

  assert.equal(card.ownerLabel, "ฝ่ายขาย");
  assert.equal(card.automationMode, "customer_waiting");
  assert.equal(card.primaryActionLabel, "ติดตามการอนุมัติ");
  assert.equal(card.stopReasonLabel, "รอลูกค้าตัดสินใจ quote");
  assert.equal(card.workflowLabel, "รออนุมัติใบเสนอราคา");
  assert.equal(card.primarySurfaceHref, "/quote/quote-token");
});

test("customer-waiting cards preserve the customer note as the stop reason", () => {
  const row: AdminOverviewRow = {
    kind: "conversation",
    id: "conv-hold",
    filterKey: "customer-waiting",
    ownerKey: "crm",
    readinessStage: "customer",
    nextActionOwner: "customer",
    sortAt: "2026-05-04T10:30:00.000Z",
    messageAt: "2026-05-04T10:30:00.000Z",
    conversationId: "conv-hold",
    conversationState: "ON_HOLD_CUSTOMER_INPUT",
    customerLabel: "Waiting Customer",
    productLabel: "signage",
    documentRequestType: null,
    billingEntityType: null,
    billingName: null,
    lineFriendshipStatus: null,
    liffContextType: null,
    liffAppLanguage: null,
    note: "รอไฟล์โลโก้เวอร์ชันสุดท้าย",
    quoteStatus: null,
    paymentStatus: null,
    jobStatus: null,
  };

  const card = buildAdminOverviewCardModel(row);

  assert.equal(card.automationMode, "customer_waiting");
  assert.equal(card.stopReasonLabel, "รอไฟล์โลโก้เวอร์ชันสุดท้าย");
  assert.equal(card.primaryActionLabel, "เช็กคำตอบลูกค้า");
});

test("exception cards prioritize the escalation reason and reviewer ownership", () => {
  const row: AdminOverviewRow = {
    kind: "escalation",
    id: "esc-1",
    filterKey: "exceptions",
    ownerKey: "owner",
    readinessStage: "exception",
    nextActionOwner: "internal",
    sortAt: "2026-05-04T11:00:00.000Z",
    createdAt: "2026-05-04T11:00:00.000Z",
    customerLabel: "Escalated Customer",
    productLabel: "signage",
    documentRequestType: null,
    billingEntityType: null,
    billingName: null,
    lineFriendshipStatus: null,
    liffContextType: null,
    liffAppLanguage: null,
    reason: "ลูกค้าขอคุยกับแอดมิน",
    conversationId: "conv-esc",
    conversationState: "HUMAN_REVIEW_REQUIRED",
    quoteStatus: null,
    paymentStatus: null,
  };

  const card = buildAdminOverviewCardModel(row);

  assert.equal(card.ownerLabel, "เจ้าของ / ตรวจสอบ");
  assert.equal(card.automationMode, "human_gate");
  assert.equal(card.stopReasonLabel, "ลูกค้าขอคุยกับแอดมิน");
  assert.equal(card.primaryActionLabel, "ตอบเคสนี้");
});

test("running-job cards keep production ownership and summarize proof pressure", () => {
  const row: AdminOverviewRow = {
    kind: "running-job",
    id: "job-1",
    filterKey: "production-ops",
    ownerKey: "production",
    readinessStage: "production",
    nextActionOwner: "internal",
    sortAt: "2026-05-04T12:00:00.000Z",
    createdAt: "2026-05-04T12:00:00.000Z",
    customerLabel: "Production Customer",
    productLabel: "signage",
    documentRequestType: null,
    billingEntityType: null,
    billingName: null,
    lineFriendshipStatus: null,
    liffContextType: null,
    liffAppLanguage: null,
    jobId: "job-1",
    leadId: "lead-1",
    publicToken: "status-token",
    pendingReviewCount: 2,
    assignedTo: "factory-1",
    uploadedReferenceCount: 1,
    previewImageCount: 1,
    previewImageUrl: "https://example.com/preview.png",
    promptText: "Design prompt",
    promptRoutingLabel: "AI prompt พร้อมใช้",
    aiImageStatus: "generated",
    jobStatus: "IN_PRODUCTION",
    productionStatus: "qc",
    productionLinkUrl: "https://example.com/link",
  };

  const card = buildAdminOverviewCardModel(row);

  assert.equal(card.ownerLabel, "ผลิต / จัดส่ง");
  assert.equal(card.automationMode, "human_gate");
  assert.equal(card.primaryActionLabel, "อัปเดตงานผลิต");
  assert.equal(card.stopReasonLabel, "มีหลักฐานรอตรวจ 2 รายการ");
  assert.deepEqual(card.evidenceSummary, [
    "รอตรวจ 2 รายการ",
    "ผู้รับผิดชอบ factory-1",
    "มี preview 1 แบบ",
    "หน้างาน qc",
  ]);
});

test("all-filter grouping preserves queue order and excludes empty queues", () => {
  const quoteRow: AdminOverviewRow = {
    kind: "quote",
    id: "quote-1",
    quoteId: "quote-1",
    filterKey: "quote-decision",
    ownerKey: "sales",
    readinessStage: "quote",
    nextActionOwner: "internal",
    sortAt: "2026-05-04T09:00:00.000Z",
    createdAt: "2026-05-04T09:00:00.000Z",
    customerLabel: "Quote Customer",
    productLabel: "signage",
    documentRequestType: null,
    billingEntityType: null,
    billingName: null,
    lineFriendshipStatus: null,
    liffContextType: null,
    liffAppLanguage: null,
    total: 2500,
    publicToken: "quote-token",
    quoteStatus: "sent",
    paymentTerms: "prepaid",
    paymentStatus: "unpaid",
    hasJob: false,
    commercialOrder: null,
  };
  const jobRow: AdminOverviewRow = {
    kind: "running-job",
    id: "job-1",
    filterKey: "production-ops",
    ownerKey: "production",
    readinessStage: "production",
    nextActionOwner: "internal",
    sortAt: "2026-05-04T12:00:00.000Z",
    createdAt: "2026-05-04T12:00:00.000Z",
    customerLabel: "Production Customer",
    productLabel: "signage",
    documentRequestType: null,
    billingEntityType: null,
    billingName: null,
    lineFriendshipStatus: null,
    liffContextType: null,
    liffAppLanguage: null,
    jobId: "job-1",
    leadId: "lead-1",
    publicToken: "status-token",
    pendingReviewCount: 0,
    assignedTo: null,
    uploadedReferenceCount: 0,
    previewImageCount: 0,
    previewImageUrl: null,
    promptText: "",
    promptRoutingLabel: null,
    aiImageStatus: null,
    jobStatus: "IN_PRODUCTION",
    productionStatus: "in_progress",
    productionLinkUrl: null,
  };

  const groups = buildAdminOverviewCardGroups({
    filter: "all",
    rows: [jobRow, quoteRow],
  });

  assert.deepEqual(groups.map((group) => group.key), [
    "quote-decision",
    "production-ops",
  ]);
  assert.equal(groups[0].cards[0].title, "Quote Customer");
  assert.equal(groups[1].cards[0].title, "Production Customer");
});