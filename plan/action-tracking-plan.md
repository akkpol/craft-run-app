---
goal: Universal Action Tracking — Add action_ref to every system action
version: 1.0
date_created: 2026-04-19
owner: Delivery Engineering
status: In progress
tags: [tracking, audit-log, action_ref, traceability]
---

# Universal Action Tracking Plan

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
