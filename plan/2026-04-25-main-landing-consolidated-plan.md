---
goal: Main Landing Consolidated Plan
version: 1.0
date_created: 2026-04-25
owner: Delivery Engineering
status: In progress
tags: [merge, landing, triage, go-live, context]
---

# Main Landing Consolidated Plan

This is the durable consolidation point for the current landing effort. It bridges the repo plans, the active implementation branch, the open pull requests, and the blockers already resolved during the current session.

## Current Baseline

- Current branch: `fix/quote-payment-instructions`
- Default branch: `main`
- Confirmed open PRs relevant to landing triage:
  - PR 20: `copilot/fix-ci-failure-admin-allowlist` - CI/env branch
  - PR 19: `fix/quote-payment-instructions` - product workflow/UI branch
  - PR 17: `fix/quote-payment-instructions-mainbase` - older overlapping product branch
  - PR 16: `chore/add-fogus-ui-ux-skill` - older public quote/missing-lead branch
  - PR 13: `codex_des/stabilize-deploy-checks` - older CI branch
  - PR 11: `claude/redesign-ux-ui-modern-2026` - WIP design branch

## What Was Already True In Code

- Wave 1 auth hardening is largely implemented already through the middleware allowlist path.
- Public self-sign-up is already disabled in UI.
- Action logging is much further along than the older written plan suggests.
- The admin snapshot fallback for missing `lead_media_assets` is already present.
- Customer media validation and rollback tests already exist.

## What Was Implemented In This Session

### 1. Intake upload contract

- `src/app/api/intake/route.ts` now returns a non-fatal warning payload when lead creation succeeds but reference file upload fails.
- This keeps the lead/quote path intact while making attachment loss explicit.

### 2. LIFF intake feedback alignment

- `src/app/liff/intake/intake-form.tsx` now displays the upload warning on the success screen.
- The LIFF window close delay is extended when the warning is present so the customer can read it.

### 3. Settings audit logging

- `src/app/api/settings/route.ts` now logs `settings.updated` through `src/lib/action-log.ts`.
- The payload is sanitized to changed field names only; secrets are not echoed into the audit payload.

### 4. Explicit CI env gating

- `scripts/check-line-liff-env.mjs` no longer treats any generic `CI=true` environment as an automatic strict deploy gate.
- `.github/workflows/ci.yml` now opts into strict validation explicitly through `CHECK_LINE_LIFF_ENV=1`.
- The current branch already contains the CI/env additions that overlap with PR 20, so PR 20 should be treated as an overlap check before landing rather than an automatic separate merge.

## Remaining Merge Blockers

### 1. Merge-scope classification

- PR 20 has been checked against GitHub directly and only contains `.github/workflows/ci.yml` plus `docs/ENV_AND_LINE_SETUP.md`, both of which are already present on this branch.
- Treat PR 20 as fully overlapped by the current landing branch; it should not land as a separate merge unless GitHub-side metadata needs to be closed out.
- PRs 17 and 16 are fully represented in the current landing candidate file set and should be treated as historical overlap, not independent merge inputs.
- PR 13 is also fully represented in the current landing candidate once the working-tree CI changes are included.
- PR 11 does not add a remaining landing-critical delta: its only non-overlapped file from the PR file list is `src/components/ui/theme-toggle.tsx`, which already matches `main` and is not referenced by the app.
- The remaining work in this area is GitHub hygiene and close-out, not code absorption.

### 2. Local-only and unsafe files

- `.vscode/mcp.json` has been removed from tracked scope on this branch; rotate the exposed key outside git.
- `.vscode/settings.json` has been removed from tracked scope because it only contained local terminal auto-approve rules.
- `.vscode/extensions.json` and `.vscode/tasks.json` have been removed from tracked scope because they were editor convenience files, not application behavior.
- `site/public/index.html` has been removed from tracked scope because it was an unreferenced duplicate of the Stitch design export.
- `mcp.json.example` is a safe placeholder template and does not block landing.
- `.stitch/SITE.md`, `.stitch/metadata.json`, `.stitch/next-prompt.md`, and `.stitch/designs/index.html` have been removed from tracked scope because they were unreferenced Stitch project sidecars, not application behavior.
- `.stitch/DESIGN.md` and `stitch/DESIGN.md` have also been removed from the landing candidate so the design-system work stays out of the product merge and can be handled in a dedicated design branch later.

### 3. Written-plan reconciliation

- Update `plan/process-go-live-waves-1.md` to reflect that Wave 1 access lock is largely implemented and that `settings.updated` is now covered.
- Update `plan/action-tracking-plan.md` to reflect current implementation coverage and remaining library-level gaps.

### 4. Final landing validation

- Run `npm run lint`
- Run `npm run build`
- Run `npm run check:workflow-policy`
- Run focused tests for changed slices, especially `tests/customer-media.test.ts` and queue-related admin tests
- Perform manual checks for:
  - LIFF intake with and without files
  - quote approval/payment gate behavior
  - admin triage queue behavior
  - customer `/status` continuity

## Recommended Landing Order

1. Freeze the product-scope file list for the landing branch.
2. Remove or exclude the remaining local-only and unsafe files.
3. Run final validation on the classified landing candidate.
4. Land main.
5. Continue external go-live work: Supabase migrations, Vercel envs, LINE webhook wiring, LIFF endpoint wiring, bucket verification, UAT evidence, and sign-off.
6. Run the detailed UX/UI audit only after the above is stable.

## Relationship To Existing Plans

- `plan/process-go-live-waves-1.md` remains the wave-based delivery plan.
- `plan/process-customer-handoff-1.md` remains the handoff/UAT plan.
- `plan/action-tracking-plan.md` remains the audit-log implementation plan.
- This file is the cross-cutting coordination layer that explains where those plans meet the actual open branches and current implementation state.

## Validation Completed In This Session

- ESLint passed for:
  - `src/app/api/intake/route.ts`
  - `src/app/api/settings/route.ts`
  - `src/app/liff/intake/intake-form.tsx`
- `node scripts/check-line-liff-env.mjs` correctly skips outside explicit strict mode.
- `CHECK_LINE_LIFF_ENV=1 node scripts/check-line-liff-env.mjs` passes.
- `gh pr list --state all --limit 30 --json number,title,state,url,headRefName` confirmed PR 19 and PR 20 are both open simultaneously.
- `gh pr view 20 --repo akkpol/craft-run-app --json number,title,headRefName,baseRefName,files,url` confirmed PR 20 only changes `.github/workflows/ci.yml` and `docs/ENV_AND_LINE_SETUP.md`, which are already absorbed here.
- `gh pr view` plus landing-candidate file-set comparison confirmed PRs 17, 16, and 13 are fully absorbed, and PR 11 has no remaining landing-critical delta.