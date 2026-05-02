---
goal: Keep non-coherent local changes out of the active feature slice until they are intentionally resumed or discarded
version: 1.0
date_created: 2026-04-30
last_updated: 2026-04-30
owner: Delivery Engineering
status: Active
tags: [process, quarantine, worktree, coordination]
---

# Worktree Quarantine - 2026-04-30

This note records which local changes are intentionally outside the active feature slice so future sessions do not mistake them for active packet work.

## Clean Slice Kept Staged

- Admin CTA and overview slice only:
  - `src/app/admin/admin-action-ui.tsx`
  - `src/app/admin/admin-dashboard-sections.tsx`
  - `src/app/admin/conversation-actions.tsx`
  - `src/app/admin/job-actions.tsx`
  - `src/app/admin/lead-ai-preview-actions.tsx`
  - `src/app/admin/lead-prompt-actions.tsx`
  - `src/app/admin/lead-send-preview-actions.tsx`
  - `src/app/admin/production-link-copy.tsx`
  - `src/app/admin/production-review-actions.tsx`
  - `src/app/admin/quote-actions.tsx`
  - `src/app/api/leads/[id]/prompt/route.ts`
  - `src/app/api/leads/[id]/send-preview/route.ts`
  - `src/lib/admin-action-labels.ts`
  - `src/lib/admin-overview.ts`
  - `src/lib/line.ts`
  - `tests/admin-action-labels.test.ts`

## Separate Local Packet

- LIFF observability slice lives in `plan/feature-liff-observability-monitor-1.md`
  - packet status is `Completed`; do not treat it as the active coding slice unless the user explicitly asks for LIFF follow-up
  - `src/app/admin/admin-sidebar.tsx`
  - `src/app/liff/intake/intake-form.tsx`
  - `src/app/api/intake/route.ts`
  - `src/app/api/customers/prefill/route.ts`
  - `src/app/api/liff/incidents/route.ts`
  - `src/app/admin/liff-monitor/page.tsx`
  - `src/lib/intake-payload.ts`
  - `src/lib/liff-observability.ts`
  - `tests/intake-payload.test.ts`

## Completed Packet Leftovers

- completed prompt-source visibility or prompt-input files that are not the active slice:
  - `src/app/admin/customers/[id]/page.tsx`
  - `src/app/admin/customers/[id]/customer-360-client.tsx`
  - `src/lib/lead-ai-prompt.ts`
  - `tests/lead-ai-prompt.test.ts`
  - `plan/feature-admin-ai-prompt-source-visibility-1.md`
  - `plan/feature-liff-ai-prompt-inputs-1.md`

## Quarantined From Current Feature Round

- recovery/process docs and notes:
  - `.github/copilot-instructions.md`
  - `.gitignore`
  - `docs/CUSTOMER_HANDOFF_PACKAGE.md`
  - `docs/GO_NOGO_REVIEW.md`
  - `docs/OPERATOR_RUNBOOK.md`
  - `docs/START_HERE_CONTEXT_RECOVERY.md`
  - `docs/AI_PREVIEW_INCIDENT_SOP_TH_DRAFT.md`
  - `docs/CUSTOMER_FLOW_AND_DELIVERY_EXPLANATION_TH.md`
  - `docs/CUSTOMER_HANDOFF_AI_PREVIEW_INCIDENT_SECTION_DRAFT.md`
  - `docs/LIFF_LIVE_VALIDATION_RUNBOOK.md`
  - `docs/OPERATOR_EVIDENCE_CAPTURE_CHECKLIST.md`
  - `docs/OPERATOR_HANDOFF_MESSAGE_TH.md`
  - `docs/OPERATOR_LAUNCH_ONE_PAGE.md`
  - `docs/PHASE2_OPERATOR_GATE_CHECKLIST.md`
  - `docs/SUPABASE_MIGRATION_HISTORY_DRIFT_RUNBOOK.md`
  - `plan/README.md`
  - `plan/process-go-live-waves-1.md`
  - `plan/process-anti-loop-execution-1.md`
  - `plan/process-ai-preview-split-drafts-1.md`
  - `plan/process-supabase-liff-active-packets-1.md`
  - `plan/2026-04-27-supabase-migration-history-repair-plan.md`
- operator/runbook docs:
  - `public/operator-launch-one-page.html`
- git split helpers:
  - `tmp/git-split/admin-slice.pathspec.txt`
  - `tmp/git-split/liff-observability.pathspec.txt`
  - `tmp/git-split/completed-leftovers.pathspec.txt`
  - `tmp/git-split/runtime-cleanup.pathspec.txt`
  - `tmp/git-split/docs-process.pathspec.txt`
  - `tmp/git-split/README-2026-04-30.md`
  - `tmp/git-split/remaining-worktree-2026-04-30.md`
- workspace/config noise:
  - `.env.vault`
  - `.vscode/settings.json`
  - `.vscode/tasks.json`
  - `.vscode/extensions.json`
- package and generated/runtime wiring churn:
  - `next-env.d.ts`
  - `package.json`
  - `package-lock.json`
- unrelated runtime cleanup or formatting changes outside the active admin slice:
  - `src/app/liff/page.tsx`
  - `src/app/admin/admin-topbar.tsx`
  - `src/app/admin/layout.tsx`
  - `src/app/admin/profile/page.tsx`
  - `src/app/admin/settings/settings-form.tsx`
  - `src/app/admin/lead-design-actions.tsx`
  - `src/app/quote/[token]/download/page.tsx`
  - `src/app/quote/[token]/page.tsx`
  - `src/app/status/[token]/page.tsx`
  - `src/app/status/[token]/copy-tracking-code-button.tsx`
  - `src/app/studio/studio-surface.tsx`
  - `src/components/nav-user.tsx`
  - `src/components/ui/chart.tsx`
  - `src/lib/asset-storage-paths.ts`
  - `src/lib/bangkok-date-time.ts`
  - `src/lib/ai-images.ts`
  - `src/lib/customer-media.ts`
  - `src/lib/factory-display.ts`
  - `src/lib/payment-routing.ts`
  - `src/lib/production-media.ts`
  - `src/lib/studio-view.ts`

## Guard

- Do not pull quarantined files into the next feature commit by default.
- Resume a quarantined group only by naming its packet or by explicit user direction.