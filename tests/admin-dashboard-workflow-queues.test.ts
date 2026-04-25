import test from "node:test";
import assert from "node:assert/strict";

import { getDesignQueueLeads } from "../src/lib/admin-dashboard-queues";
import type { BackofficeSnapshot } from "../src/lib/backoffice-snapshot";

function makeSnapshot(): BackofficeSnapshot {
  return {
    leads: [
      {
        id: "lead-waiting-quote-approval",
        conversation_id: "conv-waiting-quote-approval",
        product_type: "signage",
        width_mm: 900,
        height_mm: 450,
        qty: 1,
        status: "approved",
        created_at: "2026-04-25T09:58:00.000Z",
        design_status: "not_started",
        customers: { display_name: "Quote Gate", phone: null },
      },
      {
        id: "lead-waiting-payment",
        conversation_id: "conv-waiting-payment",
        product_type: "signage",
        width_mm: 1000,
        height_mm: 500,
        qty: 1,
        status: "approved",
        created_at: "2026-04-25T10:00:00.000Z",
        design_status: "not_started",
        customers: { display_name: "Payment Gate", phone: null },
      },
      {
        id: "lead-in-design",
        conversation_id: "conv-in-design",
        product_type: "signage",
        width_mm: 1200,
        height_mm: 600,
        qty: 1,
        status: "in_progress",
        created_at: "2026-04-25T10:05:00.000Z",
        design_status: "drafting",
        customers: { display_name: "Design Queue", phone: null },
      },
    ],
    quotes: [],
    jobs: [],
    productionReviewQueue: [],
    escalations: [],
    recentConversations: [],
    conversations: [
      {
        id: "conv-waiting-quote-approval",
        line_user_id: "line-user-0",
        state: "WAITING_QUOTE_APPROVAL",
        last_message_at: "2026-04-25T09:58:00.000Z",
        created_at: "2026-04-25T09:50:00.000Z",
      },
      {
        id: "conv-waiting-payment",
        line_user_id: "line-user-1",
        state: "WAITING_PAYMENT",
        last_message_at: "2026-04-25T10:00:00.000Z",
        created_at: "2026-04-25T09:55:00.000Z",
      },
      {
        id: "conv-in-design",
        line_user_id: "line-user-2",
        state: "IN_DESIGN",
        last_message_at: "2026-04-25T10:05:00.000Z",
        created_at: "2026-04-25T10:00:00.000Z",
      },
    ],
  };
}

test("quote/payment-gated leads do not leak into the design queue", () => {
  const designQueueLeadIds = getDesignQueueLeads(makeSnapshot()).map(
    (lead) => lead.id
  );

  assert.deepEqual(designQueueLeadIds, ["lead-in-design"]);
  assert.equal(designQueueLeadIds.includes("lead-waiting-quote-approval"), false);
  assert.equal(designQueueLeadIds.includes("lead-waiting-payment"), false);
});
