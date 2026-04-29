---
goal: FOGUS Go-Live Execution Waves
version: 1.0
date_created: 2026-04-19
last_updated: 2026-04-27
owner: Delivery Engineering
status: In progress
tags: [process, delivery, go-live, waves, backlog]
---

# Introduction

![Status: In Progress](https://img.shields.io/badge/status-In%20Progress-yellow)

This plan converts the current FOGUS remaining work into a deterministic wave-based execution checklist. It is designed to be used as the day-by-day delivery guide after the baseline quality checks already passed.

## Plan Stack

This file is the primary execution plan for the current FOGUS delivery push.

Use the related plan files with these roles:

- `plan/process-go-live-waves-1.md` - primary wave-based delivery order and go-live execution checklist
- `plan/2026-04-25-main-landing-consolidated-plan.md` - supporting landing coordination, merge-status, and blocker reconciliation snapshot
- `plan/action-tracking-plan.md` - supporting cross-cutting traceability and audit-log plan
- `plan/process-customer-handoff-1.md` - supporting handoff/runbook preparation plan
- `plan/feature-liff-media-r2-1.md` - scoped feature plan for frequent upload/display and Cloudflare R2 work
- `plan/2026-04-26-local-supabase-cli-bump-follow-up.md` - follow-up-only tooling plan for a deferred Supabase CLI bump, not the main delivery plan

If multiple plan files are open at once and there is any question about execution order, use this file first and reconcile the other documents back to it.

Execution aids for the current pending operator work:

- [../docs/PHASE2_OPERATOR_GATE_CHECKLIST.md](../docs/PHASE2_OPERATOR_GATE_CHECKLIST.md) for `P2-G03`, `P2-G05`, `P2-G06`, `P2-G07`
- [../docs/LIFF_LIVE_VALIDATION_RUNBOOK.md](../docs/LIFF_LIVE_VALIDATION_RUNBOOK.md) for `LIFF-VAL-005` through `LIFF-VAL-008`
- [../docs/OPERATOR_HANDOFF_MESSAGE_TH.md](../docs/OPERATOR_HANDOFF_MESSAGE_TH.md) for a copy-paste operator handoff message in Thai

## Safe Path

If the goal is to get through go-live with the least confusion, follow this path only:

1. Use this file as the single execution checklist.
2. Use `docs/GO_NOGO_REVIEW.md` only when a step requires live environment evidence, gate status, or sign-off.
3. Use `plan/2026-04-25-main-landing-consolidated-plan.md` only for branch overlap, merge hygiene, and landing context.
4. If the customer LIFF intake surface is functionally ready and local validation is green, treat LIFF completion as a deploy-first launch-path item; do not hold that deploy for Wave 5 follow-up architecture such as R2, Studio, AI-provider expansion, or broader backoffice polish.
5. Do not start Wave 5 while TASK-024 is still open, except for LIFF-specific stabilization work that is explicitly required to make the customer intake path deployable.

### LIFF Deploy-First Slice

When the current priority is "finish LIFF and deploy first", use this narrower slice instead of waiting for broader Wave 5 completion:

1. Finish only the customer-facing LIFF entry and intake behavior needed for `/liff` and `/liff/intake`.
2. Re-run focused local validation for the LIFF path and intake route on the current branch.
3. Complete the live prerequisites that directly gate LIFF only: LIFF endpoint registration, base URL correctness, runtime settings sanity, and one real LINE-to-LIFF-to-intake submission check.
4. Deploy on the current stable storage/runtime path first.
5. Keep R2 rollout, Studio, accounting export, AI-provider expansion, and other post-launch refactors out of that deploy unless they are required by the LIFF path itself.

### LIFF Deploy Validation Run Sheet

Treat LIFF as complete only when all items below are complete. If any item is still pending, LIFF is not complete.

| Check ID | Scope | How to validate | Current status |
|---|---|---|---|
| LIFF-VAL-001 | Deploy env guard | `npm run check:line-liff-env` in a deploy-like env or confirm the same pass in Vercel build logs. | Complete locally on 2026-04-27; keep Vercel build evidence for launch |
| LIFF-VAL-002 | Key file health | Keep zero editor/type problems in `src/app/liff/intake/intake-form.tsx`, `src/app/liff/intake/product-type-picker.tsx`, `src/app/liff/intake/intake-page-content.tsx`, `src/app/api/intake/route.ts`, and `src/app/api/customers/prefill/route.ts`. | Complete locally on current branch |
| LIFF-VAL-003 | Helper regression set | Run `node --test tests/payment-display.test.ts tests/liff-capture.test.ts tests/lead-ai-prompt.test.ts tests/admin-overview-pagination.test.ts`. | Complete locally on 2026-04-27; still helper-only coverage |
| LIFF-VAL-004 | LIFF endpoint contract | Confirm the registered LINE MINI App endpoint is `<base-url>/liff`, not `/liff/intake`, and `LIFF_ID` matches `NEXT_PUBLIC_LIFF_ID`. | Pending live console evidence |
| LIFF-VAL-005 | First-time customer path | Run one real LINE -> LIFF -> intake submission and confirm customer, lead, and quote rows are created with product snapshot fields. | Pending live evidence |
| LIFF-VAL-006 | Returning-customer prefill path | Reopen LIFF with a customer who already has leads and confirm phone plus last document/billing defaults prefill correctly. | Pending live evidence |
| LIFF-VAL-007 | Company tax-document validation | Submit one company tax-invoice case without branch code and confirm the Thai validation error is shown, then submit the same case with branch code and confirm intake succeeds. | Pending focused run |
| LIFF-VAL-008 | Runtime catalog path | Confirm the LIFF picker loads runtime catalog items from `/api/intake/product-catalog` and that quote/status/download pages render the imported product label instead of a slug fallback. | Pending focused run |
| LIFF-VAL-009 | Local non-LIFF smoke | Use localhost or `devNoLiff=1` only for form-behavior smoke, and record it explicitly as non-production evidence. | Complete as a dev-only path, not sufficient for launch |

### Current LIFF Deploy Blocker Snapshot

Branch inspection on 2026-04-27 shows the customer LIFF implementation is functionally broader than before, but deploy evidence is still incomplete.

Complete now:

- `/liff` now acts as the registered LIFF first screen and hands off to the full intake form at `/liff/intake` without changing the endpoint contract.
- localhost and `127.0.0.1` automatically bypass `liff.init()` for non-LIFF development smoke runs.
- the strict LINE/LIFF deploy env guard passed locally on the current landing branch.
- the current landing branch has zero editor/type problems in the main LIFF intake files and intake API files.
- intake now captures runtime product snapshots, LIFF context/profile snapshots, and document/billing fields in the same submit path.
- returning-customer prefill now reaches beyond phone and product history into requested document and billing defaults.
- the focused helper regression set currently wired for LIFF/payment snapshot helpers passed on 2026-04-27.

Not complete yet:

- `docs/GO_NOGO_REVIEW.md` still shows `P2-G03`, `P2-G05`, `P2-G06`, `P2-G07`, `P3-G04`, and `P3-G05` as pending, so live LIFF readiness is not yet proven.
- the current automated test set does not cover the new LIFF-only behaviors in `/api/customers/prefill`, runtime product-catalog loading, or the new tax-document branch validation path.
- the real LINE identity path has not yet been re-run end to end after adding `liffAccessToken`, `liffContextSnapshot`, runtime product snapshots, and new document/billing intake fields.
- local success alone is not enough because localhost/dev bypass skips the production LIFF identity and console-registration path by design.

Execution rule for the current landing candidate: do not expand LIFF scope again until LIFF-VAL-003 through LIFF-VAL-008 are either completed or explicitly waived with written launch reasoning.

When in doubt, stop comparing documents and come back to this file.

## 1. Requirements & Constraints

- **REQ-001**: Preserve the canonical workflow contract in `docs/workflow-policy.json`, `src/lib/workflow-policy-core.mjs`, `src/lib/quote-workflow.ts`, and related route handlers.
- **REQ-002**: Keep the customer journey login-free. Customer access continues through LINE identity plus tokenized quote/status routes.
- **REQ-003**: Restrict backoffice access to explicit staff/admin accounts before real customer rollout.
- **REQ-004**: Keep payment gate behavior exact: quote approval may stop at `WAITING_PAYMENT` and must not create or advance work early.
- **REQ-005**: Complete environment wiring, LINE/LIFF console configuration, and end-to-end acceptance before customer handoff.
- **REQ-006**: Treat AI as optional. `Gemini` or any other provider must not become a launch blocker.
- **REQ-007**: Media-heavy customer and operator usage must preserve a stable upload and preview contract even if binary storage is optimized later.
- **SEC-001**: `SUPABASE_SECRET_KEY`, `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`, and any AI provider key remain server-side only.
- **SEC-003**: Any future Cloudflare R2 credentials or storage secrets must remain server-side only.
- **SEC-002**: Do not allow public self-service sign-up to become the production backoffice access model.
- **CON-001**: Keep the locked stack: Next.js 16.2.x, React 19, Supabase, Vercel, LINE Messaging API, LIFF v2.28.
- **CON-002**: Keep LIFF endpoint registration at `/liff` and webhook registration at `/api/webhook`.
- **CON-004**: LINE-facing LIFF changes must preserve current login, friendship, safe-area, and webhook assumptions unless the same change set carries an exact validation and rollback plan.
- **CON-003**: Baseline build/lint/workflow smoke are already known-good; this plan starts from that verified state and focuses on remaining work.
- **GUD-001**: If workflow-sensitive code changes during these waves, update policy-aligned files together and run `node scripts/workflow-policy-smoke.mjs`.
- **GUD-002**: For media backend changes, introduce an adapter layer before changing the active storage provider.
- **GUD-003**: Copilot model selection for delivery work, including trying another model such as Claude inside Copilot for a specific task, is a development workflow choice only. Do not translate that choice into product scope, schema changes, runtime AI provider settings, or admin UI changes unless the application runtime itself is explicitly being changed.
- **PAT-001**: Finish all Wave 1 tasks before starting Wave 2; finish all Wave 2 tasks before starting Wave 3.
- **PAT-002**: Do not start `/studio` polish or Gemini provider work before Waves 1 through 4 are complete.
- **PAT-003**: Treat LIFF form density and clarity as UX quality work, but treat LINE/LIFF regressions as operational risks.

## 2. Implementation Steps

### Implementation Phase 1 — Wave 1 / Access Lock

- **GOAL-001**: Make the production backoffice safe enough to expose to a real customer team.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Audit and harden backoffice auth in `src/lib/middleware.ts` so `/admin` access requires an authenticated staff/admin account, not just any authenticated user. | Yes | 2026-04-25 |
| TASK-002 | Replace production reliance on public sign-up by updating `src/app/auth/sign-up/page.tsx`, `src/components/sign-up-form.tsx`, and `src/components/login-form.tsx` to remove or clearly disable self-service admin registration. | Yes | 2026-04-25 |
| TASK-003 | Define the fastest staff access rule for v1 using an explicit allowlist such as `ADMIN_ALLOWED_EMAILS`, and document it in `.env.example`, `docs/ENV_AND_LINE_SETUP.md`, and `README.md`. | Yes | 2026-04-25 |
| TASK-004 | Verify login success, login rejection, and redirect behavior for `/auth/login`, `/admin`, and `/protected` using the current Supabase auth flow in `src/components/login-form.tsx`, `src/app/auth/login/page.tsx`, and `src/app/protected/page.tsx`. | Yes | 2026-04-26 |
| TASK-005 | Re-run `npm run build` and `npm run lint` after auth hardening to confirm the access changes did not break the app shell. | Yes | 2026-04-26 |

Wave 1 is no longer a greenfield hardening wave. The access lock, sign-up disablement, and allowlist documentation are already in place; the remaining work in this wave is validation on the current landing candidate.

#### Wave 1 Validation Matrix

| Check ID | Scope | Expected Result | Evidence To Capture | Status |
|---|---|---|---|---|
| W1-VAL-001 | Valid staff login at `/auth/login` | Allowed staff account reaches the intended protected destination without loop or error state | Screenshot or short note with staff test identity used | Pending |
| W1-VAL-002 | Unauthorized authenticated user at `/admin` | Non-allowlisted authenticated user is blocked from admin access | Screenshot or short note showing rejection behavior | Pending |
| W1-VAL-003 | Protected route continuity at `/protected` | Normal authenticated user can still reach non-admin protected content if intended by current auth model | Short note confirming route outcome | Pending |
| W1-VAL-004 | Public sign-up posture | Public sign-up is removed or clearly disabled for production use | Screenshot of current sign-up surface | Pending |
| W1-VAL-005 | App shell compile health | `npm run build` completes successfully after the auth changes | Terminal output summary or exit-code note | Done — exit 0, compiled in 60s, 22 static pages, 2026-04-26 |
| W1-VAL-006 | Lint health after auth changes | `npm run lint` completes successfully after the auth changes | Terminal output summary or exit-code note | Done — 0 errors, 1 non-blocking Node module-type advisory, 2026-04-26 |

Latest local signal: `npm run build` exited with code `0`, `npm run lint` exited with code `0`, and `node scripts/workflow-policy-smoke.mjs` exited with code `0` on 2026-04-26. TASK-005 is satisfied locally; keep the remaining Wave 1 focus on preserving evidence for login, rejection, and redirect behavior.

#### Parallel-Safe Prep While Waiting For Wave 1 Sign-Off

These items are safe to prepare in parallel because they organize later work without reopening Wave 1 auth logic:

- Prepare the handoff package skeleton in `plan/process-customer-handoff-1.md` so Wave 4 evidence has a destination before UAT begins.
- Maintain the current route-level audit snapshot in `plan/action-tracking-plan.md` so action-log verification can happen faster once environment checks begin.
- Keep landing coordination notes current in `plan/2026-04-25-main-landing-consolidated-plan.md`, but do not treat that as permission to start Wave 2 implementation early.

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

Wave 3 execution rule: execute the live run directly from `docs/GO_NOGO_REVIEW.md`. Finish Phase 2 there first, then Phase 3 there, and only afterward write the final evidence back into the task rows below.

#### Wave 3 To Live-Gate Map

| Wave 3 task | Live gate coverage in `docs/GO_NOGO_REVIEW.md` |
|------|------|
| TASK-013 | P2-G05 plus P3-G04 |
| TASK-014 | P2-G06 plus P3-G05 |
| TASK-015 | P3-G06 and the payment-dependent part of P3-G09 |
| TASK-016 | P3-G08 |
| TASK-017 | P3-G09 |
| TASK-018 | P3-G10 |
| TASK-019 | P3-G11 |

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
| TASK-020 | Verify `action_ref` generation, actor typing, and route coverage using `supabase/migrations/010_action_log.sql`, `src/lib/action-log.ts`, and the routes already wired for action logging. | Yes | 2026-04-26 |
| TASK-021 | Capture build, lint, workflow-smoke, quote PDF, and manual UAT evidence and map it to `plan/process-customer-handoff-1.md` and `plan/action-tracking-plan.md`. | Yes | 2026-04-26 |
| TASK-022 | Produce customer handoff package including deployed URL, admin URL, env ownership, rotation notes, rollback trigger, and PDF/document access notes. | Yes | 2026-04-26 |
| TASK-023 | Create operator runbook covering incident triage, redeploy steps, LINE/LIFF reconfiguration, and hypercare support window. | Yes | 2026-04-26 |
| TASK-024 | Finalize the Go/No-Go review package in `docs/GO_NOGO_REVIEW.md` and collect operator plus customer acceptance sign-off before customer launch. |  |  |

Wave 4 note: the review package document exists as of 2026-04-26, but TASK-024 stays open until Phase 2 and Phase 3 gates pass in the real environment and the sign-off section in `docs/GO_NOGO_REVIEW.md` is completed.

Wave 4 completion rule: once the live run is complete, update TASK-013 through TASK-019 first, then close TASK-024 last after the Sign-Off table in `docs/GO_NOGO_REVIEW.md` is fully recorded.

### Implementation Phase 5 — Wave 5 / Controlled Follow-Up

- **GOAL-005**: Execute post-launch improvements without putting the launch path at risk.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-025 | Add first-class staff ownership model to replace free-text `assigned_to` and `assigned_designer` across `src/lib/backoffice-snapshot.ts`, `src/lib/studio-view.ts`, and related admin surfaces. |  |  |
| TASK-026 | Implement downloadable invoice and billing document flow based on `docs/INVOICE_FLOW_PATCH.md` and `docs/COMMERCIAL_DOCUMENT_DESIGN_REFERENCE.md`, including `invoices`, `billing_slips`, token pages, payment-driven release behavior, and a shared commercial-document shell that can later extend to receipt and tax-ready document surfaces. |  |  |
| TASK-027 | Design and implement accounting export tables and downloadable export format so finance data can be handed to an external accountant at period end. |  |  |
| TASK-028 | Refactor AI image generation into a provider adapter by updating `src/lib/ai-images.ts`, `src/lib/app-settings.ts`, `src/app/api/settings/route.ts`, and related schema constraints so `gemini` can be added later without changing workflow logic. |  |  |
| TASK-029 | Implement `/studio` scene-first operations refactor in `src/app/studio/studio-surface.tsx`, `src/app/globals.css`, and `src/lib/studio-view.ts` after ownership data becomes trustworthy. |  |  |
| TASK-030 | Evaluate whether product catalog and pricing rules should move from `src/lib/types.ts` constants into an admin-managed product model. |  |  |
| TASK-031 | Only after Tasks 025-030 are stable, consider broader AI/provider rollout and non-essential presentation improvements. |  |  |
| TASK-032 | Consolidate desktop backoffice navigation so `/admin` and related staff routes share a real FOGUS sidebar shell or an explicitly documented no-sidebar pattern; do not promote the current `src/components/app-sidebar.tsx` demo directly until its placeholder labels and `#` links are replaced with actual product navigation. |  |  |
| TASK-033 | Execute the dedicated plan in `plan/feature-liff-media-r2-1.md` to design a low-risk Cloudflare R2 media path for frequent upload/display usage while preserving the current Supabase-backed metadata and workflow contracts. |  |  |
| TASK-034 | Refactor the customer LIFF intake experience so the form uses less screen space, communicates state more clearly, and keeps media upload confidence high on small LINE screens. |  |  |
| TASK-035 | Create and run a LINE/LIFF-specific regression checklist for any future intake or media change so LINE behavior is validated before rollout rather than debugged after deploy. |  |  |
| TASK-036 | Replace the current flat `pickup`/`delivery` fulfillment model with a real fulfillment handoff model that separates customer pickup, third-party platform shipment, in-house delivery, and on-site installation, plus first-class delivery/service contact data that stays separate from billing-address fields. |  |  |

Wave 5 implementation note as of 2026-04-27:

- `/studio` remains a deferred internal surface under TASK-029 and is now intentionally hidden from the main admin navigation until the ownership model and scene-first operations view are ready.
- Hiding `/studio` does not disable workflow automation. The live automation path still runs through webhook, LIFF intake, quote approval/payment gates, job routes, and the shared backoffice snapshot data layer; `/studio` is only a presentation surface on top of those records.
- The product-catalog migration path under TASK-030 is no longer theoretical. The branch already contains `product_catalog_items`, a public intake catalog route, an admin CSV import route, and a runtime fallback store; the next execution slice is wiring LIFF/admin surfaces to that runtime path and replacing remaining hardcoded product-label fallbacks with lead snapshots.
- The commercial-document prep under TASK-026 also has an active schema slice now: requested document type, billing entity, billing address, tax ID, and branch fields are being captured in intake and rendered on quote surfaces, but invoice/billing/receipt document flows remain open work.
- Current execution priority inside Wave 5 is not uniform. Finish the LIFF customer intake path first and deploy it as soon as the customer-facing flow is stable; do not bundle that release behind R2 rollout design, Studio work, accounting export planning, or broader post-launch refactors.
- Fulfillment modeling is still too coarse for real-world operations. The current branch only distinguishes `pickup` vs `delivery`, but the launch backlog now needs a richer handoff model that separates customer pickup, third-party platform shipment (for example Flash), in-house delivery, and on-site installation so pricing, scheduling, proof-of-delivery, and customer instructions do not get mixed together.
- Delivery/install data is still missing as first-class business data. A follow-up slice should add normalized shipping and service fields on the lead or a dedicated fulfillment record: recipient name, delivery phone, address lines, province/district/sub-district/postcode, delivery notes, platform/provider, tracking or booking reference, requested install date/time window, and site-contact details. Billing/document address must stay separate from delivery/install address.

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
- **DEP-006**: Cloudflare R2 bucket and server-side credentials if the media optimization plan is implemented.

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
- **RISK-006**: A rushed LIFF form or storage-path change can create hard-to-debug regressions inside the LINE webview even if desktop testing looks correct.
- **RISK-007**: Team discussion about switching the Copilot chat model for implementation work can be misread as an application AI-provider requirement and create unnecessary runtime churn.
- **ASSUMPTION-001**: Baseline quality checks from 2026-04-18 remain valid until a new code change invalidates them.
- **ASSUMPTION-002**: One deploying owner is enough for the first production rollout on Vercel Pro.
- **ASSUMPTION-003**: Staff profile and richer ownership can wait until the first production path is stable.

## 8. Related Specifications / Further Reading

- `AI_WORKFLOW_GUARD.md`
- `docs/workflow-policy.json`
- `FOGUS_FINAL_SPEC.md`
- `README.md`
- `docs/COMMERCIAL_DOCUMENT_DESIGN_REFERENCE.md`
- `plan/feature-liff-media-r2-1.md`
- `plan/process-customer-handoff-1.md`
- `plan/action-tracking-plan.md`