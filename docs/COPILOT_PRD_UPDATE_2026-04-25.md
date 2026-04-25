# Copilot PRD Update Brief

Date: 2026-04-25
Repo: `D:\craft-run\craft-run\craft-run-backup-20260415`
Source branch: `fix/quote-payment-instructions`
Baseline: `origin/main` at `3139b9f55a6905aab6fdcb92077250cbaa9c7043`
Branch head: `1dd570782916abbb26b53c6d398f5ea84a293959`

## Outcome

Update the PRD so it reflects the committed product/runtime scope currently present on `fix/quote-payment-instructions` and not yet in `origin/main`.

Do not rewrite the whole product. Fold the confirmed branch work into the existing ERP/customer-flow narrative.

## Scope

Only include the 8 committed branch-only commits below:

1. `e8755477edddfb97399c2044940d4bd60eb70980` Refresh quote surfaces and harden missing-lead flows
2. `17e8c94bf1ba4708132e019316b8fb42a65acd65` feat(admin): add hybrid table/card triage queues
3. `44820f6653d7eb0a1459ec073a7c27b95dc75af1` feat(payments): add configurable payment instructions and quote surfaces
4. `5b35c0312956f856f77cf4cde5b92ae1a97aa878` feat(intake): support customer reference uploads with admin preview
5. `8e9f2022d2a77b9598eaf8f1d1f36c85e7537add` fix(webhook): validate LINE events payload before processing
6. `6bb8003bdca47fea39ef545f1018b29119aeb356` feat: tracking code visibility + customer self-service lookup page
7. `056b69966b9631ca33f128442885a0637236c1be` feat(studio): add architecture map and design queue helper
8. `1dd570782916abbb26b53c6d398f5ea84a293959` fix(intake): harden customer media handling

Explicitly exclude current uncommitted working-tree changes from the PRD update.

## Decision Authority

Copilot may:

- update PRD wording, structure, feature lists, actor flows, rollout notes, and acceptance criteria
- reorganize sections so the customer flow, admin ops flow, and studio/design flow are easier to follow
- call out runtime prerequisites when a feature depends on migration or storage setup

Copilot must not:

- invent new business states or approval rules not present in code
- describe uncommitted local edits as shipped scope
- collapse customer intake upload and production evidence upload into one workflow

## Definition Of Done

The updated PRD should:

1. reflect the actual committed scope on this branch
2. separate shipped branch scope from pending local edits
3. describe the customer journey, admin workflow, and studio/design visibility additions coherently
4. mention required migrations and operational prerequisites where relevant
5. stay aligned with the repo workflow canon rather than replacing it

## What Changed Versus `origin/main`

### 1. Customer quote/status surfaces are now richer and more defensive

- public quote flow was refreshed across `src/app/quote/[token]/page.tsx`, `src/app/quote/[token]/approve-button.tsx`, and `src/app/quote/[token]/download/page.tsx`
- missing-lead and invalid-route handling was hardened in `src/app/api/leads/[id]/design-status/route.ts` and `src/app/api/quotes/public/[token]/route.ts`
- customer-facing status now has:
  - token page: `src/app/status/[token]/page.tsx`
  - tracking lookup page: `src/app/status/page.tsx`
- PRD should now describe customer self-service order lookup by tracking code, not only direct token links

### 2. Admin triage moved toward queue-first operations

- `src/app/admin/admin-dashboard-client.tsx` now supports hybrid table/card triage queues
- `src/lib/admin-dashboard-queues.ts` and `tests/admin-dashboard-workflow-queues.test.ts` formalize queue grouping logic
- PRD should describe the admin surface as an operational triage workspace, not just a static dashboard

### 3. Payment instructions became configurable application settings

- settings and quote surfaces now support configurable payment instructions:
  - `src/app/admin/settings/settings-form.tsx`
  - `src/app/api/settings/route.ts`
  - `src/lib/app-settings.ts`
  - `src/app/quote/[token]/page.tsx`
  - `src/app/quote/[token]/download/page.tsx`
  - `supabase/migrations/013_payment_instruction_settings.sql`
- PRD should mention that payment instructions are admin-configurable and surfaced on both interactive quote and downloadable/print quote views

### 4. Customer intake now supports inline file uploads with admin preview

- intake form accepts customer reference media directly in `src/app/liff/intake/intake-form.tsx`
- backend upload handling is implemented in `src/app/api/intake/route.ts` and `src/lib/customer-media.ts`
- preview/read-side integration touches `src/lib/backoffice-snapshot.ts`
- required schema/storage setup lives in `supabase/migrations/014_customer_media_assets.sql`
- operational runbooks were added:
  - `docs/PRODUCTION_UPLOAD_GO_LIVE_CHECKLIST.md`
  - `docs/SUPABASE_CLI_UNAUTHORIZED_RECOVERY.md`
- PRD should treat this as a real workflow expansion, not just UI polish

### 5. Intake/media handling was hardened after the initial upload feature

- stricter guards and follow-up fixes landed in:
  - `src/app/api/intake/route.ts`
  - `src/app/liff/intake/intake-form.tsx`
  - `src/lib/customer-media.ts`
  - `tests/customer-media.test.ts`
  - `scripts/check-line-liff-env.mjs`
- PRD should mention validation and operational-readiness constraints:
  - storage bucket must exist
  - schema cache may need reload
  - LIFF/LINE env must be configured correctly

### 6. LINE webhook handling became more defensive

- `src/app/api/webhook/route.ts` now validates event payload shape before processing
- PRD should mention webhook resilience as a reliability requirement, not just assume well-formed provider payloads

### 7. Tracking code visibility is now part of both customer and admin experience

- admin quote cards expose tracking visibility updates in `src/app/admin/admin-dashboard-client.tsx`
- customer quote and status surfaces expose tracking context in:
  - `src/app/quote/[token]/page.tsx`
  - `src/app/status/[token]/page.tsx`
  - `src/app/status/page.tsx`
- PRD should present tracking code as a cross-surface retrieval handle for customer follow-up and support ops

### 8. `/studio` now has an architecture-map layer and queue helper

- `src/app/studio/studio-architecture-map.tsx` was added
- `src/app/studio/studio-surface.tsx` was expanded
- admin/studio queue mapping logic is shared through `src/lib/admin-dashboard-queues.ts`
- PRD should frame `/studio` as a design/ops visibility companion surface, not the source of business-rule authority

## PRD Sections To Update

Update or add these sections in the PRD:

1. Product overview
2. Customer journey
3. Admin operations / queue management
4. Quote approval and payment communication
5. Customer file intake and reference handling
6. Tracking and self-service status lookup
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

## Source Files Copilot Should Read First

- `README.md`
- `docs/WORKFLOW_TRANSITION_TABLE.md`
- `docs/INVOICE_FLOW_PATCH.md`
- `docs/PRODUCTION_UPLOAD_GO_LIVE_CHECKLIST.md`
- `src/app/admin/admin-dashboard-client.tsx`
- `src/app/liff/intake/intake-form.tsx`
- `src/app/api/intake/route.ts`
- `src/app/quote/[token]/page.tsx`
- `src/app/quote/[token]/download/page.tsx`
- `src/app/status/page.tsx`
- `src/app/status/[token]/page.tsx`
- `src/app/studio/studio-surface.tsx`
- `src/app/studio/studio-architecture-map.tsx`
- `src/lib/customer-media.ts`
- `src/lib/admin-dashboard-queues.ts`
- `src/app/api/webhook/route.ts`
- `supabase/migrations/013_payment_instruction_settings.sql`
- `supabase/migrations/014_customer_media_assets.sql`

## Verification Commands

Use these to verify the source scope before finalizing PRD wording:

```powershell
git log --oneline origin/main..fix/quote-payment-instructions
git diff --name-only origin/main...fix/quote-payment-instructions
git status --short --branch
```

If you need a short acceptance summary for the PRD, use this wording:

- Adds admin triage queues, configurable payment instructions, inline customer media upload, tracking-based customer self-service lookup, and studio architecture-map visibility.
- Hardens missing-lead handling, intake/media validation, and webhook payload validation.
- Requires migration-backed setup for payment-instruction settings and customer-media storage before production rollout.
