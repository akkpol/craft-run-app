---
goal: Universal Action Tracking — Add action_ref to every system action
version: 1.0
date_created: 2026-04-19
last_updated: 2026-04-26
owner: Delivery Engineering
status: In progress
tags: [tracking, audit-log, action_ref, traceability]
---

# Universal Action Tracking Plan

## Role In Plan Stack

This file is a supporting domain plan, not the primary execution plan.

Use it when the current task touches audit logging, action references, traceability coverage, or immutable activity history across workflow actions.

Execution priority and delivery order still come from [process-go-live-waves-1.md](process-go-live-waves-1.md).

## Objective

Every state-changing action in FOGUS — whether performed by a **human** (customer or admin), an **AI agent**, or the **system** (webhook, scheduler, auto-process) — must produce an immutable audit record with a human-readable reference number.

**Format:** `ACT-YYYYMMDD-NNNN` (e.g. `ACT-20260419-0001`)

---

## Why

- Customer and admin can quote a reference number in LINE messages or disputes
- Every workflow transition is traceable: who did it, when, and from/to which state
- AI actions (image generation, auto-reply) are distinguishable from human actions
- Required for the operations runbook (Handoff Phase 4)

---

## Architecture

### New: `action_log` table (migration 010)

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `seq_id` | BIGINT | Auto-increment from Postgres sequence |
| `action_ref` | TEXT UNIQUE | `ACT-YYYYMMDD-NNNN` — set by DB trigger |
| `entity_type` | TEXT | `conversation`, `lead`, `quote`, `job`, `production_event`, `system` |
| `entity_id` | UUID | The row affected |
| `action_type` | TEXT | Dot-namespaced, e.g. `job.status_changed` |
| `actor_type` | TEXT | `human` \| `ai` \| `system` |
| `actor_id` | TEXT | LINE user ID, admin email, or service name |
| `actor_label` | TEXT | Human-readable display name |
| `note` | TEXT | Free-text context |
| `payload` | JSONB | Structured data (from_state, to_state, etc.) — no PII |
| `created_at` | TIMESTAMPTZ | Auto-set |

### New: `src/lib/action-log.ts`

Provides `logAction()`, `logSystemAction()`, `logAiAction()`, `logHumanAction()` helpers. All failures are **non-fatal** (logged to console, never throw).

---

## Files to Update

### Wave 1 — Foundation (Done ✅)
| File | Change |
|---|---|
| `supabase/migrations/010_action_log.sql` | Create table + sequence + trigger |
| `src/lib/action-log.ts` | Helper functions |

### Current Verified Coverage

- `src/app/api/settings/route.ts` now logs `settings.updated` through `logHumanAction()` with a sanitized payload of changed field names only.
- The helper layer remains non-fatal by design; failed audit writes should not block the customer or admin path.
- Unless explicitly noted here, the wave items below should still be treated as pending verification or pending implementation.

### Current Route Coverage Audit Snapshot (2026-04-26)

Use these status labels in this table:

- `Verified in branch` - directly confirmed in the current landing work
- `Partially verified` - at least one expected action is confirmed, but ownership, missing companion logs, or side-effect coverage still needs follow-up
- `Needs route audit` - expected target route, but this plan has not yet confirmed implementation details
- `Pending library work` - gap is known to sit below the route layer and still needs dedicated implementation or confirmation

| Surface | Expected Action Types | Actor Type | Audit Status | Next Check |
|---|---|---|---|---|
| `src/app/api/settings/route.ts` | `settings.updated` | `human` | Verified in branch | Confirm DB row and sanitized payload during Wave 4 evidence capture |
| `src/app/api/webhook/route.ts` | `conversation.created`, `conversation.state_changed`, `conversation.escalated` | `system` | Needs route audit | Read route and verify whether escalation and state transitions emit action-log entries |
| `src/app/api/intake/route.ts` | `lead.created`, `quote.created`, `conversation.state_changed` | `system` | Partially verified | `lead.created` and `quote.created` are confirmed, but the main intake path still needs an explicit decision or confirmation for `conversation.state_changed` logging outside the fresh-restart cancel path |
| `src/app/api/quotes/public/[token]/route.ts` | `quote.approved`, `quote.rejected`, `conversation.state_changed` | `human` | Needs route audit | Verify public-token actions stamp actor identity safely without leaking PII |
| `src/app/api/quotes/[id]/approve/route.ts` | `quote.approved`, `job.created` | `human` | Partially verified | `quote.approved` logs at the route layer; `job.created` is emitted deeper in `src/lib/quote-workflow.ts`, so confirm whether that split ownership is the intended final pattern |
| `src/app/api/quotes/[id]/commercial/route.ts` | `quote.commercial_updated`, `conversation.state_changed` | `human` | Needs route audit | Verify commercial unlock path emits both commercial update and state transition evidence |
| `src/app/api/jobs/[id]/status/route.ts` | `job.status_changed` | `human` | Verified in branch | Confirm DB row shape during Wave 4 evidence capture; note that this route also updates conversation state as a side effect without a separate `conversation.state_changed` log |
| `src/app/api/conversations/[id]/state/route.ts` | `conversation.state_changed` | `human` | Needs route audit | Confirm route still exists and uses standardized logging helper |
| `src/app/api/leads/[id]/design-status/route.ts` | `lead.design_status_changed` | `human` | Needs route audit | Confirm route behavior against current schema and migration parity |
| `src/app/api/admin/production-events/[id]/send/route.ts` | `production.event_sent` | `human` | Needs route audit | Verify send path logs once and does not duplicate on retry |
| `src/app/api/admin/production-events/[id]/approve/route.ts` | `production.event_approved` | `human` | Needs route audit | Verify approval path stamps actor metadata correctly |
| `src/app/api/admin/production-events/[id]/reject/route.ts` | `production.event_rejected` | `human` | Needs route audit | Verify rejection note policy and payload shape |
| `src/app/api/leads/[id]/ai-preview/route.ts` | `ai.preview_generated`, `ai.preview_failed` | `ai` | Needs route audit | Confirm both success and failure paths log with `actor_type = ai` |
| `src/lib/quote-workflow.ts` | `job.created` | `system` or `human` mediated by caller | Verified in branch | `createJobForApprovedQuote()` emits `job.created` through `logSystemAction()`; keep a guard against duplicate route-level emission |
| `src/lib/production-media.ts` | `production.media_uploaded`, `production.completion_package_sent` | `human` or `system` depending on caller | Pending library work | Decide whether media logs belong in library helpers or the invoking route layer |
| `src/app/api/production/[token]/events/route.ts` | `production.event_sent` | `human` | Needs route audit | Verify token route is still active and not superseded by admin-side event routes |

#### Fastest Audit Order

1. Confirm the already-landed `settings.updated` path at the database level.
2. Audit `src/app/api/intake/route.ts`, `src/app/api/quotes/[id]/approve/route.ts`, and `src/app/api/jobs/[id]/status/route.ts` because they are closest to launch-critical workflow evidence.
3. Audit the remaining admin and AI surfaces after the launch path routes are confirmed.

### Wave 2 — System/Webhook Layer
| File | actor_type | Actions to log |
|---|---|---|
| `src/app/api/webhook/route.ts` | `system` | `conversation.created`, `conversation.state_changed` |
| `src/app/api/intake/route.ts` | `system` | `lead.created`, `quote.created`, `conversation.state_changed` |

### Wave 3 — Customer Actions
| File | actor_type | Actions to log |
|---|---|---|
| `src/app/api/quotes/public/[token]/route.ts` | `human` | `quote.approved`, `quote.rejected`, `conversation.state_changed` |
| `src/app/api/quotes/[id]/approve/route.ts` | `human` | `quote.approved`, `job.created` |

### Wave 4 — Admin Actions
| File | actor_type | Actions to log |
|---|---|---|
| `src/app/api/quotes/[id]/commercial/route.ts` | `human` | `quote.commercial_updated`, `conversation.state_changed` |
| `src/app/api/jobs/[id]/status/route.ts` | `human` | `job.status_changed` |
| `src/app/api/conversations/[id]/state/route.ts` | `human` | `conversation.state_changed` |
| `src/app/api/leads/[id]/design-status/route.ts` | `human` | `lead.design_status_changed` |
| `src/app/api/admin/production-events/[id]/send/route.ts` | `human` | `production.event_sent` |
| `src/app/api/admin/production-events/[id]/approve/route.ts` | `human` | `production.event_approved` |
| `src/app/api/admin/production-events/[id]/reject/route.ts` | `human` | `production.event_rejected` |

### Wave 5 — AI Actions
| File | actor_type | Actions to log |
|---|---|---|
| `src/app/api/leads/[id]/ai-preview/route.ts` | `ai` | `ai.preview_generated`, `ai.preview_failed` |

### Wave 6 — Library Layer
| File | Notes |
|---|---|
| `src/lib/quote-workflow.ts` | Log `job.created` when job is created from quote approval |
| `src/lib/production-media.ts` | Log `production.media_uploaded`, `production.completion_package_sent` |

### Wave 7 — Production Token Route
| File | actor_type | Actions to log |
|---|---|---|
| `src/app/api/production/[token]/events/route.ts` | `human` | `production.event_sent` |

---

## Action Type Registry

```
conversation.created
conversation.state_changed
conversation.escalated

lead.created
lead.design_status_changed
lead.hold_customer_input

quote.created
quote.sent
quote.approved
quote.rejected
quote.commercial_updated

job.created
job.status_changed
job.cancelled

ai.preview_generated
ai.preview_failed

production.event_sent
production.event_approved
production.event_rejected
production.media_uploaded
production.completion_package_sent

settings.updated
```

---

## Payload Convention

Always include `from` and `to` for state transitions:

```json
{
  "from": "WAITING_QUOTE_APPROVAL",
  "to": "WAITING_PAYMENT",
  "payment_term": "prepaid"
}
```

Never include: LINE user display names, phone numbers, or financial amounts in payload.

---

## Go/No-Go Gate

- [ ] `npm run build` passes after all wave updates
- [ ] `npm run lint` passes
- [ ] `npm run check:workflow-policy` passes
- [ ] Manual test: submit LIFF form → verify `action_log` contains `lead.created` + `quote.created` with correct `action_ref` format
- [ ] Manual test: admin changes job status → verify `job.status_changed` with `actor_type = 'human'`
- [ ] Manual test: AI preview → verify `ai.preview_generated` with `actor_type = 'ai'`
- [ ] Manual test: update runtime settings in `/admin/settings` → verify `settings.updated` with sanitized `changed_fields`
