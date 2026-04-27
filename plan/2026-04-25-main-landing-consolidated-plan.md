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

## Role In Plan Stack

This file is a supporting coordination document, not the primary execution plan.

Use it to understand landing status, branch overlap, merge hygiene, and blocker reconciliation, then execute day-to-day delivery from `plan/process-go-live-waves-1.md`.

If this file and the main execution plan ever drift on task order or immediate next steps, update this file to match the main execution plan rather than treating it as a second source of truth.

## No-Confusion Rule

If the goal is to pass go-live smoothly with the least possible ambiguity, use only this decision rule:

1. Run day-to-day delivery from `plan/process-go-live-waves-1.md`.
2. Open this file only when the question is about merge scope, PR overlap, landing hygiene, or why a branch-level blocker still exists.
3. Open `docs/GO_NOGO_REVIEW.md` only when executing live environment gates, collecting sign-off, or deciding whether launch is GO or NO-GO.

If there is ever doubt about which file to trust, use `plan/process-go-live-waves-1.md` for execution order and `docs/GO_NOGO_REVIEW.md` for live launch gates.

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

## Current Launch Gate Status

- Wave 4 documentation is now in place:
  - `docs/CUSTOMER_HANDOFF_PACKAGE.md`
  - `docs/OPERATOR_RUNBOOK.md`
  - `docs/GO_NOGO_REVIEW.md`
- Phase 1 local/code gates are complete as of 2026-04-26:
  - `npm run build` passed
  - `npm run lint` passed
  - `node scripts/workflow-policy-smoke.mjs` passed
- `plan/process-go-live-waves-1.md` keeps TASK-024 open intentionally.
- The remaining launch-critical work is no longer plan drafting; it is Phase 2 environment setup plus Phase 3 live end-to-end verification in the real deployment.
- Current overall launch verdict remains **NO-GO** until Phase 2 and Phase 3 are completed and sign-off is recorded in `docs/GO_NOGO_REVIEW.md`.

The practical meaning is simple: do not spend more time reorganizing plans. The safe path from here is Phase 2 setup, then Phase 3 verification, then sign-off.

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
- Keep this consolidated plan aligned with the live gate state in `docs/GO_NOGO_REVIEW.md` so TASK-024 is not marked complete before operator and customer sign-off exist.

### 4. Final landing validation

- Local validation now has current green evidence for `npm run lint`, `npm run build`, and `node scripts/workflow-policy-smoke.mjs`.
- Remaining launch validation is operational rather than code-local:
  - execute Phase 2 environment gates from `docs/GO_NOGO_REVIEW.md`
  - execute Phase 3 behavioral gates from `docs/GO_NOGO_REVIEW.md`
  - capture evidence into the Wave 4 handoff package and sign-off flow
- If code changes are made before launch, rerun focused tests for changed slices, especially `tests/customer-media.test.ts` and queue-related admin tests.

## Recommended Landing Order

1. Freeze the product-scope file list for the landing branch.
2. Remove or exclude the remaining local-only and unsafe files.
3. Run final validation on the classified landing candidate.
4. Land main.
5. Execute Phase 2 environment setup using the operator run sheet in `docs/GO_NOGO_REVIEW.md` and the ownership table in `docs/CUSTOMER_HANDOFF_PACKAGE.md`.
6. Execute Phase 3 live behavioral checks gate by gate from `docs/GO_NOGO_REVIEW.md` and keep TASK-024 open until sign-off is recorded.
7. Run the detailed UX/UI audit only after the above is stable.

## Relationship To Existing Plans

- `plan/process-go-live-waves-1.md` remains the wave-based delivery plan.
- `plan/process-customer-handoff-1.md` remains the handoff/UAT plan.
- `plan/action-tracking-plan.md` remains the audit-log implementation plan.
- `docs/GO_NOGO_REVIEW.md` is the authoritative live launch gate once local code validation is complete.
- This file is the cross-cutting coordination layer that explains where those plans meet the actual open branches and current implementation state.

## Validation Completed In This Session

- `npm run build` passed for the landing candidate on 2026-04-26.
- `npm run lint` passed for the landing candidate on 2026-04-26.
- `node scripts/workflow-policy-smoke.mjs` passed on 2026-04-26.
- ESLint passed for:
  - `src/app/api/intake/route.ts`
  - `src/app/api/settings/route.ts`
  - `src/app/liff/intake/intake-form.tsx`
- `node scripts/check-line-liff-env.mjs` correctly skips outside explicit strict mode.
- `CHECK_LINE_LIFF_ENV=1 node scripts/check-line-liff-env.mjs` passes.
- `gh pr list --state all --limit 30 --json number,title,state,url,headRefName` confirmed PR 19 and PR 20 are both open simultaneously.
- `gh pr view 20 --repo akkpol/craft-run-app --json number,title,headRefName,baseRefName,files,url` confirmed PR 20 only changes `.github/workflows/ci.yml` and `docs/ENV_AND_LINE_SETUP.md`, which are already absorbed here.
- `gh pr view` plus landing-candidate file-set comparison confirmed PRs 17, 16, and 13 are fully absorbed, and PR 11 has no remaining landing-critical delta.