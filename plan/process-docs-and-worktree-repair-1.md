---
goal: Repair compressed markdown and isolate the current worktree into a clean docs checkpoint before feature implementation
version: 1.0
date_created: 2026-05-02
last_updated: 2026-05-02
owner: Delivery Engineering
status: Active
role: supporting coordination plan
tags: [process, docs, worktree, repair, checkpoint]
---

# Docs And Worktree Repair

![Status: Active](https://img.shields.io/badge/status-Active-brightgreen)

This packet is the active cleanup slice after the feature completeness recovery matrix. It repairs markdown structure that was compressed during prior edits and creates a git checkpoint that keeps documentation recovery separate from feature code, tests, and runtime fixes.

## Packet Contract

Goal
- Restore readable markdown structure for the active runbook and planning docs, then save the docs slice on git for a reliable recovery point.

In Scope
- Repair frontmatter and markdown tables in runbook/planning files already modified in the current worktree.
- Register this packet in `plan/README.md`.
- Keep `plan/process-feature-completeness-recovery-1.md` as the controlling matrix for later feature work.
- Create a git checkpoint containing only the docs/worktree-repair slice when validation passes.

Out of Scope
- No application code changes.
- No test/config fixes.
- No Supabase schema changes.
- No invoice, R2, role, audit, or admin table implementation.

Definition of Done
- Markdown frontmatter is valid again in repaired files.
- Tables render as markdown tables instead of one-line compressed text.
- Launch status remains semantically unchanged: Phase 3 gates pass; `LIFF-VAL-006`, `LIFF-VAL-007`, `LIFF-VAL-008`, and sign-off remain open.
- Git checkpoint exists for this docs slice only.

Owner
- Delivery Engineering.

## Worktree Classification

Docs slice
- `docs/GO_NOGO_REVIEW.md`
- `docs/OPERATOR_RUNBOOK.md`
- `plan/README.md`
- `plan/process-go-live-waves-1.md`
- `plan/process-anti-loop-execution-1.md`
- `plan/feature-liff-ai-prompt-inputs-1.md`
- `plan/feature-admin-ai-prompt-source-visibility-1.md`
- `plan/process-runbook-launch-readiness-1.md`
- `plan/process-feature-completeness-recovery-1.md`
- `plan/process-docs-and-worktree-repair-1.md`

Deferred runtime slice
- `src/app/api/settings/route.ts`

Deferred test/config slice
- `tests/line-and-production-review.test.ts`
- `tests/workflow-transitions.test.ts`
- `vitest.config.ts`

## Execution Steps

| Task | Description | Completed | Date |
|---|---|---|---|
| TASK-001 | Create this repair packet and register it in `plan/README.md`. | Yes | 2026-05-02 |
| TASK-002 | Repair compressed frontmatter and tables in the runbook/planning docs. | Yes | 2026-05-02 |
| TASK-003 | Validate the repaired docs have no editor errors. | Yes | 2026-05-02 |
| TASK-004 | Create a git checkpoint for the docs slice only. | Yes | 2026-05-02 |

## Validation

| Check | Expected Result | Status |
|---|---|---|
| Markdown readback | Repaired docs have normal frontmatter, headings, and tables. | Pass |
| Editor diagnostics | Repaired markdown files report no editor problems. | Pass |
| Git staged set | Only docs slice files are staged for the checkpoint. | Pass |

## Risks

- Current worktree also contains runtime and test/config changes. They must not be staged into the docs checkpoint.
- `docs/GO_NOGO_REVIEW.md` contains live evidence. Repair must preserve evidence content while restoring structure.
- The branch shown by VS Code attachment may be stale; live `git status` currently reports `main`.

## Resume From Here

After this packet closes, the next implementation packet should be `feature-real-actor-audit-1`, unless launch sign-off or LIFF live checks take priority.

## Closure Record - 2026-05-02

- Checkpoint branch: `docs/worktree-repair-savepoint-20260502`
- Checkpoint commit: this docs repair savepoint commit
- Validation: repaired markdown readback passed, editor diagnostics reported no errors, and `git diff --cached --check` passed before commit.
- Deferred slices remain unstaged: `src/app/api/settings/route.ts`, `tests/line-and-production-review.test.ts`, `tests/workflow-transitions.test.ts`, and `vitest.config.ts`.
