# FOGUS Workflow Transition Table

เอกสารนี้เป็น human-facing derivative ของ `docs/workflow-policy.json` สำหรับสรุป flow ปัจจุบันให้อ่านง่ายขึ้น ไม่ใช่ source of truth แยกอีกชุด

## Canonical Sources

- `docs/workflow-policy.json`
- `src/lib/workflow-policy.ts`
- `src/lib/types.ts`
- `src/lib/quote-workflow.ts`
- `src/app/api/webhook/route.ts`
- `src/app/api/intake/route.ts`
- `src/app/api/quotes/[id]/approve/route.ts`
- `src/app/api/quotes/[id]/commercial/route.ts`
- `src/app/api/jobs/[id]/status/route.ts`
- `supabase/migrations/006_workflow_state_model.sql`

## Main Path

`NEW_MESSAGE → COLLECTING_REQUIREMENTS → REQUIREMENTS_REVIEW → QUOTE_PENDING_APPROVAL → PAYMENT_PENDING / IN_DESIGN → IN_PRODUCTION → READY_FOR_FULFILLMENT → COMPLETED`

Side branches: `ON_HOLD`, `HUMAN_REVIEW_REQUIRED`, `CANCELLED`

## Transition Table

| State | Actor | Trigger | Next State |
|---|---|---|---|
| none | system (`/api/webhook`) | First inbound LINE text creates a conversation row | `NEW_MESSAGE` |
| `NEW_MESSAGE` | customer | Sends a normal LINE message and bot replies with LIFF link | `COLLECTING_REQUIREMENTS` |
| `COLLECTING_REQUIREMENTS` | customer | Submits LIFF intake form | `REQUIREMENTS_REVIEW` |
| `REQUIREMENTS_REVIEW` | system (`/api/intake`) | Intake has missing data for automatic quote generation | `ON_HOLD_CUSTOMER_INPUT` |
| `REQUIREMENTS_REVIEW` | system (`/api/intake`) | Intake is complete and quote is generated | `WAITING_QUOTE_APPROVAL` |
| `ON_HOLD_CUSTOMER_INPUT` | customer | Sends more details in LINE; webhook reopens collection loop | `COLLECTING_REQUIREMENTS` |
| `WAITING_QUOTE_APPROVAL` | customer | Approves quote, but payment terms do not unlock production yet | `WAITING_PAYMENT` |
| `WAITING_QUOTE_APPROVAL` | customer | Approves quote and payment terms already unlock production | `IN_DESIGN` |
| `WAITING_PAYMENT` | admin | Updates payment terms or payment status, but production is still locked | `WAITING_PAYMENT` |
| `WAITING_PAYMENT` | admin | Updates payment terms or payment status so production becomes unlocked | `IN_DESIGN` |
| `IN_DESIGN` | admin | Moves job to production; payment is cleared and design is approved or not required | `IN_PRODUCTION` |
| `IN_DESIGN` | admin | Puts job on hold waiting for more customer input | `ON_HOLD_CUSTOMER_INPUT` |
| `IN_DESIGN` | admin | Escalates job for manual review | `HUMAN_REVIEW_REQUIRED` |
| `IN_DESIGN` | admin | Cancels the job | `CANCELLED` |
| `ON_HOLD_CUSTOMER_INPUT` | admin | Resumes job after customer provides required input | `IN_DESIGN` |
| `ON_HOLD_CUSTOMER_INPUT` | admin | Cancels the job | `CANCELLED` |
| `HUMAN_REVIEW_REQUIRED` | admin | Resolves review and resumes job | `IN_DESIGN` |
| `HUMAN_REVIEW_REQUIRED` | admin | Cancels the job | `CANCELLED` |
| `IN_PRODUCTION` | admin | Production finishes and item is ready for pickup or delivery | `READY_FOR_FULFILLMENT` |
| `IN_PRODUCTION` | admin | Cancels the job | `CANCELLED` |
| `READY_FOR_FULFILLMENT` | admin | Marks delivery or pickup complete | `COMPLETED` |
| `READY_FOR_FULFILLMENT` | admin | Cancels the job | `CANCELLED` |
| any active conversation state | customer | Sends escalation keywords such as `คุยกับแอดมิน`, `ขอคุยกับคน`, `admin` | `HUMAN_REVIEW_REQUIRED` |

## Returning Customer LINE Reply Routing

When a customer messages the bot while a conversation already exists, the webhook selects a reply type based on the conversation state:

| State(s) | Reply Type | Behaviour |
|---|---|---|
| `IN_DESIGN`, `IN_PRODUCTION`, `READY_FOR_FULFILLMENT` | `production_status` | Shows current production state and a link to the status page |
| `WAITING_QUOTE_APPROVAL` | `quote_approval_context` | Shows the pending quote and a direct link to approve — **must not offer resume/fresh** |
| `WAITING_PAYMENT` | `payment_context` | Shows the payment gate status and a link to the status page — **must not offer resume/fresh** |
| `COLLECTING_REQUIREMENTS`, `REQUIREMENTS_REVIEW`, `ON_HOLD_CUSTOMER_INPUT` (reused conv.) | `resume_or_fresh` | Offers two paths: continue the existing intake or start a fresh request |
| Previous conv. was `COMPLETED` or `CANCELLED` | `terminal_fresh_intake` | Acknowledges the prior outcome and invites a new intake |
| All other cases | `intake_link` | Sends the standard LIFF intake link |

The `resume_or_fresh` offer is **only valid for early collection states**. Choosing the fresh path creates a new conversation and intake record; the previous conversation row is not reused.

Pure-function source of truth: `src/lib/webhook-returning-customer.ts` → `getReturningCustomerReplyType`.

## Trigger Notes

- When a returning customer is still in an early collection state (`COLLECTING_REQUIREMENTS`, `REQUIREMENTS_REVIEW`, `ON_HOLD_CUSTOMER_INPUT`) and the conversation is reusable, the LINE reply offers two paths: continue the existing intake flow or start a fresh request from the beginning.
- Choosing the fresh path creates a new conversation and intake record set; it does not reuse the previous conversation row.
- Quote approval does not always create a job. The job is created or reused only when `paymentUnlocksProduction()` returns true.
- `credit` unlocks immediately.
- `deposit` unlocks when payment becomes `partial` or `paid`.
- `prepaid` unlocks only when payment becomes `paid`.
- Transition from `IN_DESIGN` to `IN_PRODUCTION` is blocked unless payment is cleared and the design is approved, except when no AI design prompt is required.
- `CANCELLED` and `COMPLETED` are terminal states in the current server-side transition logic.

## Interpretation Rules

- `docs/workflow-policy.json` is the canonical workflow policy for agents and local MCP consumers.
- If this table conflicts with `docs/workflow-policy.json`, update this file so it remains a readable derivative.
- If the policy file conflicts with runtime route logic, fix the policy file and the affected code together rather than letting them drift.
- `docs/INVOICE_FLOW_PATCH.md` is future-state design context only and is not read as the v1 runtime truth.
