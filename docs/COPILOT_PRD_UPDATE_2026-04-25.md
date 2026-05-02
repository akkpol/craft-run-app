# Copilot PRD Update Brief

Date: 2026-04-30
Repo: `D:\craft-run\craft-run\craft-run-quote-payment-instructions`
Source branch: `fix/quote-payment-instructions`
Baseline: `3139b9f55a6905aab6fdcb92077250cbaa9c7043`
Branch head: `96c8edb4531b2fffc20958f05f4393df0ac6cd9b`

## Context

This brief is for the clean `fix/quote-payment-instructions` worktree.
Do not mix in unrelated WIP from the dirty `main` checkout at `D:\craft-run\craft-run\craft-run-backup-20260415`.

The branch now contains later product/runtime work beyond the original payment-instruction slice, so Copilot should read the full `origin/main..HEAD` scope, not the older 8-commit snapshot.

## Outcome

Update the PRD so it reflects the committed product/runtime scope currently present on `fix/quote-payment-instructions` and not yet in `origin/main`.

Do not rewrite the whole product. Fold the confirmed branch work into the existing ERP/customer-flow narrative.

## Scope

Only include committed branch-only work that exists in `git log --oneline origin/main..HEAD` for this branch.

Group the scope by product truth rather than by a narrow commit list:

1. Quote surfaces, payment instructions, and payment record export
2. Admin triage queues and workflow action surfaces
3. LIFF intake, customer media, and storage/runtime hardening
4. Tracking code, self-service lookup, and customer prompt-source visibility
5. Studio architecture map, prompt snapshot preview, and AI preview routing
6. Go-live, recovery, and observability documentation
7. Schema parity and typecheck/build fixups that keep the above deployable

Explicitly exclude unrelated edits from other worktrees and any uncommitted local WIP.

## Decision Authority

Copilot may:

- update PRD wording, structure, feature lists, actor flows, rollout notes, and acceptance criteria
- reorganize sections so customer flow, admin ops, export flow, and studio visibility are easier to follow
- call out runtime prerequisites when a feature depends on migration, schema cache refresh, or storage setup

Copilot must not:

- invent new business states or approval rules not present in code
- describe uncommitted local edits as shipped scope
- collapse customer intake upload, production evidence upload, and quote/payment export into one workflow
- treat `/studio` as workflow authority instead of a visibility surface

## Definition Of Done

The updated PRD should:

1. reflect the actual committed scope on this branch
2. separate shipped branch scope from pending local edits
3. describe the customer journey, admin workflow, export flow, and studio/design visibility coherently
4. mention required migrations and operational prerequisites where relevant
5. stay aligned with the repo workflow canon rather than replacing it

## What Changed Versus `origin/main`

### 1. Quote surfaces now include payment record sync and accounting export

- payment state and record sync now live in `src/app/api/quotes/[id]/commercial/route.ts`
- payment record logic is centralized in `src/lib/quote-payment-records.ts`
- monthly accounting export lives in `src/app/api/admin/accounting/monthly/route.ts`
- the admin accounting surface is in `src/app/admin/accounting/page.tsx`
- the supporting migration is `supabase/migrations/20260430034644_add_quote_payment_records.sql`
- PRD should describe this as a real accounting/export capability, not just a quote UI tweak

### 2. Admin triage moved toward queue-first operations

- `src/app/admin/admin-dashboard-client.tsx` supports hybrid table/card triage queues
- `src/lib/admin-dashboard-queues.ts` and `tests/admin-dashboard-workflow-queues.test.ts` formalize queue grouping logic
- admin action surfaces expanded in:
  - `src/app/admin/admin-action-ui.tsx`
  - `src/app/admin/quote-actions.tsx`
  - `src/app/admin/lead-ai-preview-actions.tsx`
  - `src/app/admin/lead-prompt-actions.tsx`
  - `src/app/admin/lead-send-preview-actions.tsx`
  - `src/app/admin/production-review-actions.tsx`
- PRD should describe the admin surface as an operational triage workspace, not just a static dashboard

### 3. Customer intake now supports richer LIFF capture and media handling

- intake form and product metadata capture live in `src/app/liff/intake/intake-form.tsx`
- backend intake handling is in `src/app/api/intake/route.ts`
- customer media handling is in `src/lib/customer-media.ts` and `src/lib/customer-media-storage.ts`
- preview/read-side integration touches `src/lib/backoffice-snapshot.ts`
- the supporting storage/runtime migrations live in:
  - `supabase/migrations/20260426174619_lead_media_storage_provider_r2.sql`
  - `supabase/migrations/20260426221716_capture_liff_customer_context.sql`
  - `supabase/migrations/20260427043005_add_fulfillment_location_capture.sql`
- PRD should treat this as a real workflow expansion, not just UI polish

### 4. Tracking code visibility and prompt-source visibility are now cross-surface

- customer self-service lookup now spans:
  - `src/app/status/page.tsx`
  - `src/app/status/[token]/page.tsx`
- customer and quote surfaces expose tracking context in:
  - `src/app/quote/[token]/page.tsx`
  - `src/app/quote/[token]/download/page.tsx`
  - `src/app/admin/admin-dashboard-client.tsx`
- prompt-source visibility is surfaced through:
  - `src/app/admin/customers/[id]/customer-360-client.tsx`
  - `src/app/api/leads/[id]/prompt/route.ts`
  - `src/app/api/leads/[id]/ai-preview/route.ts`
- PRD should present tracking code as a cross-surface retrieval handle and prompt-source visibility as an admin inspection aid

### 5. `/studio` now has architecture-map and AI-preview routing support

- `src/app/studio/studio-architecture-map.tsx` was added
- `src/app/studio/studio-surface.tsx` was expanded
- AI preview prompt composition is centralized in `src/lib/lead-ai-prompt.ts`
- studio visibility gating uses shared logic in `src/lib/studio-view.ts`
- production status routing uses the same prompt-context helper in `src/app/api/jobs/[id]/status/route.ts`
- PRD should frame `/studio` as a design/ops visibility companion surface, not the source of business-rule authority

### 6. Go-live, recovery, and observability docs were expanded

- operational runbooks were added or expanded in:
  - `docs/OPERATOR_RUNBOOK.md`
  - `docs/OPERATOR_HANDOFF_MESSAGE_TH.md`
  - `docs/GO_NOGO_REVIEW.md`
  - `docs/PRODUCTION_UPLOAD_GO_LIVE_CHECKLIST.md`
  - `docs/SUPABASE_CLI_UNAUTHORIZED_RECOVERY.md`
  - `docs/LIFF_LIVE_VALIDATION_RUNBOOK.md`
  - `docs/OPERATOR_EVIDENCE_CAPTURE_CHECKLIST.md`
- LIFF observability is now modeled in:
  - `src/app/admin/liff-monitor/page.tsx`
  - `src/app/api/liff/incidents/route.ts`
  - `src/lib/liff-observability.ts`
- PRD should mention operational readiness and incident visibility as explicit rollout concerns

### 7. Schema parity and typecheck/build fixups keep the branch deployable

- hosted schema parity and migration drift are covered by:
  - `supabase/migrations/20260427041916_repair_hosted_document_product_and_liff_gap.sql`
  - `supabase/migrations/20260427213500_add_billing_branch_fields.sql`
  - `supabase/migrations/20260427224500_create_product_catalog_runtime.sql`
- prompt snapshot support is in `supabase/migrations/20260427060747_add_ai_prompt_snapshot_to_leads.sql`
- payment instruction settings still live in `supabase/migrations/013_payment_instruction_settings.sql`
- production typecheck/build blockers should be called out if they affect release readiness

## PRD Sections To Update

Update or add these sections in the PRD:

1. Product overview
2. Customer journey
3. Admin operations / queue management
4. Quote approval, payment instructions, and payment record export
5. Customer file intake, media handling, and LIFF observability
6. Tracking, prompt-source visibility, and self-service status lookup
7. Studio/design visibility layer
8. Runtime prerequisites and rollout dependencies
9. Risks / non-goals

## Required Product Truths

Keep these truths intact while updating the PRD:

- workflow/state rules come from runtime and policy sources, not from prose alone
- customer intake upload is separate from production evidence upload
- payment gate remains business-critical and should not be diluted by studio/UX additions
- `/studio` is a companion visibility surface, not the canonical workflow engine
- admin settings are a safety/config surface, not the place where primary workflow actions should live
- quote/payment export is an accounting/runtime concern, not a presentation-only change

## Risks / Non-Goals

- Do not merge LIFF intake changes into the production evidence flow
- Do not present pending local edits from the dirty `main` checkout as part of this branch
- Do not assume production is updated just because the branch compiles locally
- Current build readiness still depends on fixing any type errors in `src/app/api/quotes/[id]/commercial/route.ts` if they appear in CI or Vercel

## Source Files Copilot Should Read First

- `README.md`
- `docs/WORKFLOW_TRANSITION_TABLE.md`
- `docs/INVOICE_FLOW_PATCH.md`
- `docs/PRODUCTION_UPLOAD_GO_LIVE_CHECKLIST.md`
- `docs/GO_NOGO_REVIEW.md`
- `docs/OPERATOR_RUNBOOK.md`
- `src/app/api/quotes/[id]/commercial/route.ts`
- `src/lib/quote-payment-records.ts`
- `src/app/api/admin/accounting/monthly/route.ts`
- `src/app/admin/accounting/page.tsx`
- `src/app/admin/admin-dashboard-client.tsx`
- `src/app/admin/admin-action-ui.tsx`
- `src/app/admin/quote-actions.tsx`
- `src/app/admin/lead-ai-preview-actions.tsx`
- `src/app/admin/lead-prompt-actions.tsx`
- `src/app/admin/production-review-actions.tsx`
- `src/app/liff/intake/intake-form.tsx`
- `src/app/api/intake/route.ts`
- `src/app/api/customers/prefill/route.ts`
- `src/app/api/liff/incidents/route.ts`
- `src/app/admin/liff-monitor/page.tsx`
- `src/lib/customer-media.ts`
- `src/lib/customer-media-storage.ts`
- `src/lib/liff-observability.ts`
- `src/app/quote/[token]/page.tsx`
- `src/app/quote/[token]/download/page.tsx`
- `src/app/status/page.tsx`
- `src/app/status/[token]/page.tsx`
- `src/app/studio/studio-surface.tsx`
- `src/app/studio/studio-architecture-map.tsx`
- `src/lib/lead-ai-prompt.ts`
- `src/lib/studio-view.ts`
- `src/app/api/jobs/[id]/status/route.ts`
- `src/app/api/leads/[id]/prompt/route.ts`
- `src/app/api/leads/[id]/ai-preview/route.ts`
- `src/app/api/webhook/route.ts`
- `supabase/migrations/013_payment_instruction_settings.sql`
- `supabase/migrations/20260426174619_lead_media_storage_provider_r2.sql`
- `supabase/migrations/20260426221716_capture_liff_customer_context.sql`
- `supabase/migrations/20260427060747_add_ai_prompt_snapshot_to_leads.sql`
- `supabase/migrations/20260430034644_add_quote_payment_records.sql`

## Verification Commands

Use these to verify the source scope before finalizing PRD wording:

```powershell
git log --oneline origin/main..HEAD
git diff --name-only origin/main...HEAD
git status --short --branch
git merge-base origin/main HEAD
```

If you need a short acceptance summary for the PRD, use this wording:

- Adds queue-first admin triage, configurable payment instructions, payment record export, richer LIFF intake/media capture, tracking-based customer self-service lookup, prompt-source visibility, and studio architecture-map visibility.
- Hardens missing-lead handling, intake/media validation, LIFF observability, and webhook payload validation.
- Requires migration-backed setup for payment-instruction settings, customer-media storage, AI prompt snapshot storage, and quote-payment record export before production rollout.
