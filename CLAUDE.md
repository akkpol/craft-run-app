# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

FOGUS is a LINE OA + LIFF + Next.js 16.2 ERP for a Thai print & signage shop. Customers interact via LINE chat and a LIFF mini-app form. Staff manage jobs through an admin dashboard. The entire lifecycle — intake → quoting → payment → production → fulfillment — is tracked as a workflow state machine.

**Stack (locked):** Next.js 16.2, React 19, Tailwind CSS v4, shadcn/ui, Supabase, Vercel, LINE Messaging API, LIFF v2.28.

---
เมื่อถามคำถามให้ใช้คำถามภาษาไทยเสมอ เว้นแต่จะระบุเป็นอย่างอื่น
## Commands

```bash
npm run dev                        # local development
npm run build                      # validate production compilation
npm test                           # stable mixed-runner test suite (node:test + Vitest)
npm run lint                       # ESLint (run after route/middleware/TS changes)
npm run check:workflow-policy      # smoke-test workflow policy consistency
```

Use `npm test` for the repository test suite. Keep validating major app changes with `npm run lint`, `npm run build`, and manual flow verification.

---

## Architecture

### Layer Boundaries

| Layer | Path | Role |
|---|---|---|
| Route layer | `src/app/` | Pages, API routes, Server Actions |
| Domain/integration | `src/lib/` | Shared business logic, LINE SDK, workflow helpers |
| Supabase boundary | `src/lib/supabase/` | `client.ts` (browser), `server.ts` (SSR), `admin.ts` (secret key — server only) |
| Auth boundary | `src/lib/middleware.ts` | Protects `/admin`; public paths: `/auth`, `/liff`, `/quote`, `/status`, `/flow`, `/api/webhook`, `/api/intake`, `/api/quotes/*` |

### Key API Routes

| Route | Purpose |
|---|---|
| `POST /api/webhook` | LINE webhook — receives messages, triggers auto-replies |
| `POST /api/intake` | LIFF form submission — creates lead + quote |
| `POST /api/quotes/[id]/approve` | Customer approves quote → routes to `WAITING_PAYMENT` or `IN_DESIGN` |
| `POST /api/quotes/[id]/commercial` | Admin adjusts payment term/status → may unlock `IN_DESIGN` |
| `POST /api/jobs/[id]/status` | Admin advances job status |
| `GET/POST /api/settings` | Runtime business, LINE, LIFF, and AI settings management |

### Public-Facing Pages

- `/liff` → registered LIFF endpoint, redirects to `/liff/intake`
- `/quote/[token]` → customer quote approval page
- `/status/[token]` → customer job status page

---

## Workflow State Machine

### Canonical Sources (in priority order)

1. `docs/workflow-policy.json` — machine-readable contract; wins over all prose
2. `src/lib/workflow-policy-core.mjs` — runtime helpers (`getWorkflowPolicy`, `validateTransition`, `getAllowedActions`, `getUiContract`)
3. `src/lib/types.ts` — TypeScript state/status enums and pricing helpers
4. `src/lib/workflow-transitions.ts` — `ALLOWED_CONVERSATION_TRANSITIONS` and `ALLOWED_JOB_TRANSITIONS` maps
5. `src/lib/quote-workflow.ts` — approval + payment gate logic
6. `src/app/api/quotes/[id]/approve/route.ts` — quote approval endpoint behavior
7. `src/app/api/jobs/[id]/status/route.ts` — job status transition enforcement
8. `supabase/migrations/006_workflow_state_model.sql` — persisted schema

**Read `AI_WORKFLOW_GUARD.md` before any workflow-sensitive changes.**

### Conversation States (linear happy path)

```
NEW_MESSAGE → COLLECTING_REQUIREMENTS → REQUIREMENTS_REVIEW → WAITING_QUOTE_APPROVAL
  → WAITING_PAYMENT → IN_DESIGN → IN_PRODUCTION → READY_FOR_FULFILLMENT → COMPLETED
```

Side branches: `ON_HOLD_CUSTOMER_INPUT`, `HUMAN_REVIEW_REQUIRED`, `CANCELLED`.

### Transition Table Snapshot

| State | Actor | Trigger | Next State |
|---|---|---|---|
| none | system (`/api/webhook`) | First inbound LINE text creates a conversation row | `NEW_MESSAGE` |
| `NEW_MESSAGE` | customer | Sends a normal LINE message and bot replies with LIFF link | `COLLECTING_REQUIREMENTS` |
| `COLLECTING_REQUIREMENTS` | customer | Submits LIFF intake form | `REQUIREMENTS_REVIEW` |
| `REQUIREMENTS_REVIEW` | system (`/api/intake`) | Missing data for automatic quoting | `ON_HOLD_CUSTOMER_INPUT` |
| `REQUIREMENTS_REVIEW` | system (`/api/intake`) | Intake is complete and quote is generated | `WAITING_QUOTE_APPROVAL` |
| `ON_HOLD_CUSTOMER_INPUT` | customer | Sends more details; webhook reopens collection loop | `COLLECTING_REQUIREMENTS` |
| `WAITING_QUOTE_APPROVAL` | customer | Approves quote, but payment still blocks production | `WAITING_PAYMENT` |
| `WAITING_QUOTE_APPROVAL` | customer | Approves quote and payment already unlocks production | `IN_DESIGN` |
| `WAITING_PAYMENT` | admin | Updates commercial status but production is still locked | `WAITING_PAYMENT` |
| `WAITING_PAYMENT` | admin | Updates commercial status so production unlocks | `IN_DESIGN` |
| `IN_DESIGN` | admin | Starts production after payment/design gates are satisfied | `IN_PRODUCTION` |
| `IN_DESIGN` | admin | Puts job on hold for customer input | `ON_HOLD_CUSTOMER_INPUT` |
| `IN_DESIGN` | admin | Escalates for manual review | `HUMAN_REVIEW_REQUIRED` |
| `IN_DESIGN` | admin | Cancels the job | `CANCELLED` |
| `ON_HOLD_CUSTOMER_INPUT` | admin | Resumes after customer responds | `IN_DESIGN` |
| `HUMAN_REVIEW_REQUIRED` | admin | Resolves review and resumes | `IN_DESIGN` |
| `IN_PRODUCTION` | admin | Production finishes | `READY_FOR_FULFILLMENT` |
| `READY_FOR_FULFILLMENT` | admin | Marks pickup or delivery complete | `COMPLETED` |
| any active conversation state | customer | Uses escalation keywords such as `คุยกับแอดมิน`, `ขอคุยกับคน`, `admin` | `HUMAN_REVIEW_REQUIRED` |

### Approval + Payment Gate

Approving a quote does **not** always create a job. The unlock matrix:

| Payment term | Unlocks production when |
|---|---|
| `credit` | immediately on approval |
| `deposit` | `payment_status` is `partial` or `paid` |
| `prepaid` | `payment_status` is `paid` |

If production is not unlocked → conversation moves to `WAITING_PAYMENT`, no job created.
If production is unlocked → job is created (or reused) and conversation moves to `IN_DESIGN`.

### Non-Negotiables

- Do not invent workflow states, shortcut transitions, or UI CTAs outside `docs/workflow-policy.json`.
- Do not reuse `COMPLETED` or `CANCELLED` conversations for new intake.
- If workflow behavior changes, update the policy JSON, runtime helpers, affected routes, and derivative docs **in the same change**.
- Run `npm run check:workflow-policy` after any workflow policy change.

---

## Coding Conventions

- **Supabase keys:** Use only `sb_publishable_*` (browser/SSR) and `sb_secret_*` (server admin). Never use legacy `anon` or `service_role` naming.
- **Next.js 16 dynamic params:** Always use `props: { params: Promise<{...}> }` with `await props.params` in route handlers and pages.
- **LIFF:** Endpoint registered at `/liff` (not `/liff/intake`). `liff/layout.tsx` must preserve `env(safe-area-inset-bottom)` padding. Call `liff.requestFriendship()` after `liff.init()`.
- **LINE webhook:** Verify signatures before processing; keep push/reply calls failure-tolerant.
- **Dimensions:** Store in mm; use the conversion and pricing helpers in `src/lib/types.ts` — don't duplicate them.
- **TypeScript:** Keep strict boundaries; avoid `any` unless a genuine boundary case requires it.
- **React Compiler:** `next.config.ts` enables `reactCompiler: true`. Do not add legacy `useMemo`/`useCallback` optimizations.
- **Server/client boundaries:** Be explicit about `"use client"` / `"use server"` when editing under `src/app`.

---

## Styling

- Tailwind CSS v4, utility-first — no CSS Modules or Styled Components.
- Tokens defined in `src/app/globals.css` via `@theme inline` (OKLCH color space).
- Merge classes with `cn()` from `src/lib/utils.ts` (`clsx` + `tailwind-merge`).
- Two major surface patterns:
  - **LIFF (customer):** `.liff-shell` + `.liff-panel` (frosted glass, `rounded-3xl`)
  - **Admin (staff):** `.admin-shell` + `.admin-panel` + `.admin-kpi-card`
- Icons from `lucide-react`; components from `src/components/ui/` (shadcn/ui + CVA variants).

---

## Database

Migrations in `supabase/migrations/` (run in order):

| File | Purpose |
|---|---|
| `001_initial.sql` | Core schema: conversations, messages, leads, quotes, jobs |
| `002_enable_rls.sql` | Row-level security policies |
| `003_quote_payment_terms.sql` | Payment term + status columns |
| `004_app_settings.sql` | Runtime settings table (LINE keys, LIFF ID, etc.) |
| `005_settings_assets_and_ai.sql` | Asset storage + AI prompt columns |
| `006_workflow_state_model.sql` | Canonical workflow state column + backfill |

Admin settings (LINE Channel Secret, Channel Access Token, LIFF ID, Base URL) can be managed at runtime via `/admin/settings` — no redeploy required.

---

## Reference Docs

| File | Purpose |
|---|---|
| `docs/CLAUDE_LESSONS.md` | **อ่านก่อนเริ่มทุก session** — บทเรียนจากความผิดพลาดของ AI ใน PR ที่ผ่านมา |
| `AI_WORKFLOW_GUARD.md` | Required read before workflow changes |
| `docs/workflow-policy.json` | Canonical machine-readable workflow contract |
| `docs/WORKFLOW_TRANSITION_TABLE.md` | Human-readable derivative (read-only reference) |
| `docs/ENV_AND_LINE_SETUP.md` | Env vars, LINE vs LIFF setup guide |
| `.env.example` | All env var names with descriptions |
| `docs/INVOICE_FLOW_PATCH.md` | Proposed invoice-first patch — **not current behavior** |
| `docs/FIGMA_DESIGN_SYSTEM_RULES.md` | Figma → code translation rules for this project |
