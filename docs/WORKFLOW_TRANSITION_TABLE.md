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

`NEW_MESSAGE → COLLECTING_REQUIREMENTS → REQUIREMENTS_REVIEW → WAITING_QUOTE_APPROVAL → WAITING_PAYMENT / IN_DESIGN → IN_PRODUCTION → READY_FOR_FULFILLMENT → COMPLETED`

Side branches: `ON_HOLD_CUSTOMER_INPUT`, `HUMAN_REVIEW_REQUIRED`, `CANCELLED`

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

## Trigger Notes

- When a returning customer still has an active pre-job conversation, the LINE reply can offer two paths: continue the existing intake flow or start a fresh request from the beginning.
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
