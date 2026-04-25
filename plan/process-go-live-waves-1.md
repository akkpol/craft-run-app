---
goal: FOGUS Go-Live Execution Waves
version: 1.0
date_created: 2026-04-19
last_updated: 2026-04-25
owner: Delivery Engineering
status: In progress
tags: [process, delivery, go-live, waves, backlog]
---

# Introduction

![Status: In Progress](https://img.shields.io/badge/status-In%20Progress-yellow)

This plan converts the current FOGUS remaining work into a deterministic wave-based execution checklist. It is designed to be used as the day-by-day delivery guide after the baseline quality checks already passed.

## 1. Requirements & Constraints

- **REQ-001**: Preserve the canonical workflow contract in `docs/workflow-policy.json`, `src/lib/workflow-policy-core.mjs`, `src/lib/quote-workflow.ts`, and related route handlers.
- **REQ-002**: Keep the customer journey login-free. Customer access continues through LINE identity plus tokenized quote/status routes.
- **REQ-003**: Restrict backoffice access to explicit staff/admin accounts before real customer rollout.
- **REQ-004**: Keep payment gate behavior exact: quote approval may stop at `WAITING_PAYMENT` and must not create or advance work early.
- **REQ-005**: Complete environment wiring, LINE/LIFF console configuration, and end-to-end acceptance before customer handoff.
- **REQ-006**: Treat AI as optional. `Gemini` or any other provider must not become a launch blocker.
- **SEC-001**: `SUPABASE_SECRET_KEY`, `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`, and any AI provider key remain server-side only.
- **SEC-002**: Do not allow public self-service sign-up to become the production backoffice access model.
- **CON-001**: Keep the locked stack: Next.js 16.2.x, React 19, Supabase, Vercel, LINE Messaging API, LIFF v2.28.
- **CON-002**: Keep LIFF endpoint registration at `/liff` and webhook registration at `/api/webhook`.
- **CON-003**: Baseline build/lint/workflow smoke are already known-good; this plan starts from that verified state and focuses on remaining work.
- **GUD-001**: If workflow-sensitive code changes during these waves, update policy-aligned files together and run `node scripts/workflow-policy-smoke.mjs`.
- **PAT-001**: Finish all Wave 1 tasks before starting Wave 2; finish all Wave 2 tasks before starting Wave 3.
- **PAT-002**: Do not start `/studio` polish or Gemini provider work before Waves 1 through 4 are complete.

## 2. Implementation Steps

### Implementation Phase 1 — Wave 1 / Access Lock

- **GOAL-001**: Make the production backoffice safe enough to expose to a real customer team.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Audit and harden backoffice auth in `src/lib/middleware.ts` so `/admin` access requires an authenticated staff/admin account, not just any authenticated user. | Yes | 2026-04-25 |
| TASK-002 | Replace production reliance on public sign-up by updating `src/app/auth/sign-up/page.tsx`, `src/components/sign-up-form.tsx`, and `src/components/login-form.tsx` to remove or clearly disable self-service admin registration. | Yes | 2026-04-25 |
| TASK-003 | Define the fastest staff access rule for v1 using an explicit allowlist such as `ADMIN_ALLOWED_EMAILS`, and document it in `.env.example`, `docs/ENV_AND_LINE_SETUP.md`, and `README.md`. | Yes | 2026-04-25 |
| TASK-004 | Verify login success, login rejection, and redirect behavior for `/auth/login`, `/admin`, and `/protected` using the current Supabase auth flow in `src/components/login-form.tsx`, `src/app/auth/login/page.tsx`, and `src/app/protected/page.tsx`. |  |  |
| TASK-005 | Re-run `npm run build` and `npm run lint` after auth hardening to confirm the access changes did not break the app shell. |  |  |

Wave 1 is no longer a greenfield hardening wave. The access lock, sign-up disablement, and allowlist documentation are already in place; the remaining work in this wave is validation on the current landing candidate.

### Implementation Phase 2 — Wave 2 / Environment Wiring

- **GOAL-002**: Make the deployed environment and console configuration deterministic.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-006 | Provision the customer Supabase project and apply migrations under `supabase/migrations/` in order, confirming schema parity with this repo. |  |  |
| TASK-007 | Configure Vercel project settings and environment variables using `.env.example`, `docs/ENV_AND_LINE_SETUP.md`, and the runtime settings contract in `src/app/api/settings/route.ts`. |  |  |
| TASK-008 | In LINE Developers Console, register webhook URL as `<base-url>/api/webhook`, verify signature handling, and enable webhook delivery. |  |  |
| TASK-009 | In LIFF Console, register endpoint as `<base-url>/liff` and verify the LIFF ID used by `src/app/liff/page.tsx` and `src/app/liff/intake/page.tsx`. |  |  |
| TASK-010 | Verify `/admin/settings` persists runtime configuration correctly through `src/app/admin/settings/settings-form.tsx`, `src/app/api/settings/route.ts`, and `src/lib/app-settings.ts`. |  |  |
| TASK-011 | Verify company runtime settings automatically derive `webhookUrl` and `liffEndpointUrl` from `base_url` via `src/lib/app-settings.ts`, and document which values are auto-derived versus manually entered. |  |  |
| TASK-012 | Add or verify `settings.updated` audit logging for runtime settings changes so configuration changes are traceable in production. | Yes | 2026-04-25 |

Wave 2 still needs real-environment verification for console wiring and deployed settings persistence, but the `settings.updated` audit event is now implemented in the landing branch.

### Implementation Phase 3 — Wave 3 / End-To-End Acceptance

- **GOAL-003**: Prove the customer-facing and operator-facing workflow works end to end in the real environment.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-013 | Validate webhook signature acceptance and rejection against `src/app/api/webhook/route.ts` using one valid request and one invalid request. |  |  |
| TASK-014 | Validate LINE message to LIFF to intake flow, confirming `src/app/api/intake/route.ts` creates lead and quote records and updates conversation state correctly. |  |  |
| TASK-015 | Validate quote approval outcomes for `credit`, `deposit`, and `prepaid` using `src/app/api/quotes/public/[token]/route.ts`, `src/app/api/quotes/[id]/approve/route.ts`, and `src/lib/quote-workflow.ts`. |  |  |
| TASK-016 | Validate quote PDF download and print flow through `src/app/quote/[token]/download/page.tsx` and `src/app/quote/[token]/download/print-toolbar.tsx`, including business logo and company settings rendering. |  |  |
| TASK-017 | Validate admin commercial unlock flow from `WAITING_PAYMENT` to `IN_DESIGN` through `src/app/api/quotes/[id]/commercial/route.ts`. |  |  |
| TASK-018 | Validate job status progression and customer status rendering using `src/app/api/jobs/[id]/status/route.ts` and `src/app/status/[token]/page.tsx`. |  |  |
| TASK-019 | Validate escalation keywords and manual-review routing through `src/app/api/webhook/route.ts`, `escalations`, and the admin view in `src/app/admin/page.tsx`. |  |  |

### Implementation Phase 4 — Wave 4 / Evidence And Handoff

- **GOAL-004**: Convert working behavior into handoff-grade evidence and operating instructions.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-020 | Verify `action_ref` generation, actor typing, and route coverage using `supabase/migrations/010_action_log.sql`, `src/lib/action-log.ts`, and the routes already wired for action logging. |  |  |
| TASK-021 | Capture build, lint, workflow-smoke, quote PDF, and manual UAT evidence and map it to `plan/process-customer-handoff-1.md` and `plan/action-tracking-plan.md`. |  |  |
| TASK-022 | Produce customer handoff package including deployed URL, admin URL, env ownership, rotation notes, rollback trigger, and PDF/document access notes. |  |  |
| TASK-023 | Create operator runbook covering incident triage, redeploy steps, LINE/LIFF reconfiguration, and hypercare support window. |  |  |
| TASK-024 | Conduct Go/No-Go review and obtain acceptance sign-off before customer launch. |  |  |

### Implementation Phase 5 — Wave 5 / Controlled Follow-Up

- **GOAL-005**: Execute post-launch improvements without putting the launch path at risk.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-025 | Add first-class staff ownership model to replace free-text `assigned_to` and `assigned_designer` across `src/lib/backoffice-snapshot.ts`, `src/lib/studio-view.ts`, and related admin surfaces. |  |  |
| TASK-026 | Implement downloadable invoice and billing document flow based on `docs/INVOICE_FLOW_PATCH.md`, including `invoices`, `billing_slips`, token pages, and payment-driven release behavior. |  |  |
| TASK-027 | Design and implement accounting export tables and downloadable export format so finance data can be handed to an external accountant at period end. |  |  |
| TASK-028 | Refactor AI image generation into a provider adapter by updating `src/lib/ai-images.ts`, `src/lib/app-settings.ts`, `src/app/api/settings/route.ts`, and related schema constraints so `gemini` can be added later without changing workflow logic. |  |  |
| TASK-029 | Implement `/studio` scene-first operations refactor in `src/app/studio/studio-surface.tsx`, `src/app/globals.css`, and `src/lib/studio-view.ts` after ownership data becomes trustworthy. |  |  |
| TASK-030 | Evaluate whether product catalog and pricing rules should move from `src/lib/types.ts` constants into an admin-managed product model. |  |  |
| TASK-031 | Only after Tasks 025-030 are stable, consider broader AI/provider rollout and non-essential presentation improvements. |  |  |

## 3. Alternatives

- **ALT-001**: Start with `/studio` or Gemini before handoff blockers are cleared. Rejected because those are not launch-critical and would delay environment and acceptance work.
- **ALT-002**: Launch with public sign-up still available for backoffice accounts. Rejected because authenticated-but-unapproved users could reach admin surfaces.
- **ALT-003**: Build a full staff directory before access hardening. Rejected because allowlist-based admin protection is the fastest safe first step.
- **ALT-004**: Treat quote PDF, invoice, billing, and accountant export as one single Wave 1 item. Rejected because quote PDF already exists, while invoice and accounting export require separate finance workflow design and new data structures.
- **ALT-005**: Keep all remaining work in a single generic backlog list. Rejected because the team needs day-by-day execution order and explicit go/no-go gates.

## 4. Dependencies

- **DEP-001**: Vercel project access with billing and environment variable permissions.
- **DEP-002**: Supabase project owner access for migrations, Auth users, and storage verification.
- **DEP-003**: LINE Developers Console access for Messaging API and LIFF configuration.
- **DEP-004**: At least one approved staff/admin email address to use for backoffice allowlisting.
- **DEP-005**: Stable public base URL before final webhook and LIFF registration.

## 5. Files

- **FILE-001**: `src/lib/middleware.ts` - backoffice access gate.
- **FILE-002**: `src/components/login-form.tsx` - login entry surface.
- **FILE-003**: `src/app/auth/sign-up/page.tsx` - current public sign-up route.
- **FILE-004**: `src/components/sign-up-form.tsx` - current sign-up form.
- **FILE-005**: `src/app/api/settings/route.ts` - runtime settings API.
- **FILE-006**: `src/app/admin/settings/settings-form.tsx` - runtime configuration UI.
- **FILE-007**: `src/app/api/webhook/route.ts` - webhook validation and state entry.
- **FILE-008**: `src/app/api/intake/route.ts` - LIFF intake to lead and quote flow.
- **FILE-009**: `src/app/api/quotes/public/[token]/route.ts` - public quote actions.
- **FILE-010**: `src/app/api/quotes/[id]/commercial/route.ts` - payment unlock flow.
- **FILE-011**: `src/app/api/jobs/[id]/status/route.ts` - production progression gate.
- **FILE-012**: `src/lib/action-log.ts` - action logging helpers.
- **FILE-013**: `plan/process-customer-handoff-1.md` - handoff plan.
- **FILE-014**: `plan/action-tracking-plan.md` - action tracking plan.
- **FILE-015**: `src/app/quote/[token]/download/page.tsx` - quote PDF/print surface.
- **FILE-016**: `docs/INVOICE_FLOW_PATCH.md` - future invoice and billing design context.
- **FILE-017**: `src/lib/ai-images.ts` - AI image provider adapter target.
- **FILE-018**: `src/app/studio/studio-surface.tsx` - deferred operations surface refactor.

## 6. Testing

- **TEST-001**: `npm run build` passes after Wave 1 auth changes.
- **TEST-002**: `npm run lint` passes after Wave 1 auth changes.
- **TEST-003**: `npm run check:workflow-policy` passes after any workflow-sensitive changes.
- **TEST-004**: Admin login allowlist accepts valid staff user and blocks unauthorized authenticated user.
- **TEST-005**: Valid webhook request succeeds and invalid signature request fails.
- **TEST-006**: LIFF intake creates lead and quote records in the target Supabase project.
- **TEST-007**: Quote approval matrix behaves correctly for `credit`, `deposit`, and `prepaid`.
- **TEST-008**: Quote download page renders a printable PDF-friendly document with correct business identity and totals.
- **TEST-009**: Admin commercial update can unlock `WAITING_PAYMENT` to `IN_DESIGN`.
- **TEST-010**: Customer status page reflects latest job timeline accurately.
- **TEST-011**: Action log contains correct `actor_type` and `action_ref` for intake, quote approval, job status, AI preview actions, and settings changes when implemented.

## 7. Risks & Assumptions

- **RISK-001**: Launch can still fail even with green local checks if LINE or LIFF console values are wrong.
- **RISK-002**: Public sign-up left in place could expose admin surfaces to unintended accounts.
- **RISK-003**: Team may jump to `/studio` or Gemini too early because they are more visible than environment and UAT work.
- **RISK-004**: Finance document scope can expand quickly if invoice, payment confirmation, and accountant export are mixed into one unbounded task.
- **RISK-005**: Action logging may appear complete in code but still fail operationally without real database verification.
- **ASSUMPTION-001**: Baseline quality checks from 2026-04-18 remain valid until a new code change invalidates them.
- **ASSUMPTION-002**: One deploying owner is enough for the first production rollout on Vercel Pro.
- **ASSUMPTION-003**: Staff profile and richer ownership can wait until the first production path is stable.

## 8. Related Specifications / Further Reading

- `AI_WORKFLOW_GUARD.md`
- `docs/workflow-policy.json`
- `FOGUS_FINAL_SPEC.md`
- `README.md`
- `plan/process-customer-handoff-1.md`
- `plan/action-tracking-plan.md`