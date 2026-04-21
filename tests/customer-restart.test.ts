import test from "node:test";
import assert from "node:assert/strict";

const {
  getConversationsToCancelForFreshRestart,
  getLeadsToSupersedeForFreshRestart,
}: typeof import("../src/lib/customer-restart") = await import(
  new URL("../src/lib/customer-restart.ts", import.meta.url).href
);

test("fresh restart cancels reusable pre-job conversations even without an old lead", () => {
  assert.deepEqual(
    getConversationsToCancelForFreshRestart(
      [
        { id: "old-message", state: "COLLECTING_REQUIREMENTS" },
        { id: "old-quote", state: "WAITING_PAYMENT" },
        { id: "active-job", state: "IN_DESIGN" },
        { id: "done", state: "COMPLETED" },
      ],
      "new-conversation"
    ),
    [
      { id: "old-message", fromState: "COLLECTING_REQUIREMENTS" },
      { id: "old-quote", fromState: "WAITING_PAYMENT" },
    ]
  );
});

test("fresh restart only supersedes pre-job leads and leaves job-backed history intact", () => {
  const candidates = [
    {
      id: "lead-no-quote",
      conversation_id: "conversation-a",
      status: "new",
      superseded_at: null,
      quotes: [],
    },
    {
      id: "lead-awaiting-approval",
      conversation_id: "conversation-b",
      status: "quoted",
      superseded_at: null,
      quotes: [{ id: "quote-1", status: "sent", jobs: [] }],
    },
    {
      id: "lead-has-job",
      conversation_id: "conversation-c",
      status: "approved",
      superseded_at: null,
      quotes: [
        {
          id: "quote-2",
          status: "approved",
          jobs: [{ id: "job-1", status: "IN_DESIGN" }],
        },
      ],
    },
    {
      id: "lead-already-superseded",
      conversation_id: "conversation-d",
      status: "superseded",
      superseded_at: "2026-04-20T10:00:00.000Z",
      quotes: [],
    },
  ];

  assert.deepEqual(
    getLeadsToSupersedeForFreshRestart(candidates, "replacement-lead").map(
      (lead) => lead.id
    ),
    ["lead-no-quote", "lead-awaiting-approval"]
  );
});
