---
goal: Prevent repeated restart loops caused by context drift, cross-packet scope bleed, and full regression retesting after partial changes
version: 1.0
date_created: 2026-04-27
last_updated: 2026-04-30
owner: Delivery Engineering
status: Active
tags: [process, execution, coordination, anti-loop, quality]
---

# Introduction

![Status: Active](https://img.shields.io/badge/status-Active-brightgreen)

This plan defines an anti-loop execution protocol for current FOGUS work so the team does not repeatedly return to the same scope, restart tests from zero, and lose time as packets multiply.

## Role In Plan Stack

This file is a supporting coordination plan.

Use it before starting any scoped packet related to AI preview, LIFF intake, admin visibility, migration follow-up, or handoff documentation.

If this file conflicts with a packet file, keep packet technical scope but enforce this file's execution gates and closure rules.

## One-Page Operating Contract

Use this contract as the default execution mode for every packet.

1. Work one packet at a time. Do not cross packet scope.
2. Pass Discovery Gate before implementation starts.
3. Do not add new work mid-packet. If needed, stop and split to a new packet.
4. Run impacted-surface tests first. Do not jump to full regression unless release gate requires it.
5. Report in one-page delta format only: done, remaining, risks.

When session context may have drifted due to profile switch, checkout, worktree split, or machine restart, read `docs/START_HERE_CONTEXT_RECOVERY.md` before selecting the active packet.

### Worktree Drift Gate

Before selecting or resuming any packet:

1. Inspect the current git worktree and classify `staged`, `unstaged`, and `untracked` changes.
2. If the worktree touches more than one packet or surface area, declare `unstable worktree`.
3. In an unstable worktree, do not start new implementation until one coherent slice is chosen and the other slices are explicitly deferred, quarantined, or cleaned up.
4. Do not reopen a completed packet just because related files still have local changes.
5. If a packet status and the live worktree disagree, fix the packet status first and only then continue coding.

### One-Page Delta Report Template

Use this exact format for each progress report:

```md
Packet: <packet-file-name>
Date: YYYY-MM-DD
Owner: <name>

Done
- <what was completed>
- <what was validated>

Remaining
- <next concrete task>
- <blocking dependency if any>

Risks
- <active risk>
- <fallback or mitigation>
```

### Packet Start Checklist

Before writing code, all items must be true:

- Discovery Gate fields are filled and unknowns are labeled `decide now`, `defer with fallback`, or `block and escalate`.
- Packet In Scope and Out of Scope are explicit.
- Impacted files and impacted tests are listed.

### Packet Stop Rules

Stop immediately and split work into a new packet when one of these happens:

- A new requirement changes scope beyond the current packet objective.
- A new dependency requires touching unrelated domains.
- Validation requires a broader test matrix than the packet declared.

## 1. Requirements & Constraints

- **REQ-001**: Every work packet must start with one explicit packet contract: objective, files in scope, out-of-scope, and acceptance evidence.
- **REQ-000**: Every implementation pass must begin with a worktree drift check so only one coherent slice is active.
- **REQ-002**: No packet may expand scope after coding starts without creating a new packet or updating this coordination file first.
- **REQ-003**: Each packet must produce a deterministic closure record: changed files, tests run, unresolved risks, and next owner.
- **REQ-004**: Retesting must follow impacted-surface strategy first; full regression is only required at release gate.
- **REQ-005**: Docs status must not be ahead of execution status.
- **REQ-006**: Every packet must pass a Discovery Gate before coding when business/domain detail is incomplete.
- **CON-001**: Canonical workflow policy remains `docs/workflow-policy.json`; this file does not allow state-machine shortcuts.
- **CON-002**: Plan execution order still starts from `plan/process-go-live-waves-1.md`.
- **CON-003**: Follow-up migration work must obey `docs/SUPABASE_MIGRATION_HISTORY_DRIFT_RUNBOOK.md`; no blind replay.
- **GUD-001**: Keep packet size small enough to complete in one execution window with verifiable output.
- **GUD-002**: Preserve Thai-first operator clarity in docs and admin labels.
- **PAT-001**: Use packet boundaries plus handoff checkpoints to avoid context drift.
- **PAT-002**: Use "evidence before status" for all plan/doc updates.

## 2. Implementation Steps

### Implementation Phase 0

- **GOAL-000**: Convert unknown business detail into explicit implementation constraints before coding starts.

| Task | Description | Completed | Date |
|---|---|---|---|
| TASK-000D | Run a mandatory worktree drift check before packet selection. If more than one slice is present, stop and isolate one slice before coding. | Yes | 2026-04-30 |
| TASK-000 | Create a Discovery Gate note for the packet with 5 required fields: `Known Facts`, `Unknowns`, `Assumptions`, `Out of Scope`, `Decision Owner`. |  |  |
| TASK-000A | Define acceptance in user language first: what must be true in UI/ops when the packet is done, and what failure is acceptable fallback. |  |  |
| TASK-000B | For each unknown, choose one action: `decide now`, `defer with fallback`, or `block and escalate`. Do not start coding while unknowns are unlabeled. |  |  |
| TASK-000C | If user/domain owner is unsure, default to non-destructive behavior and observability-first output (clear status, error capture, and manual fallback). |  |  |

### Implementation Phase 1

- **GOAL-001**: Enforce packet contract before implementation starts.

| Task | Description | Completed | Date |
|---|---|---|---|
| TASK-001 | Add a mandatory Packet Contract block at the top of every active packet file: `Goal`, `In Scope`, `Out of Scope`, `Definition of Done`, `Owner`. |  |  |
| TASK-002 | For AI preview scope, require packet references to `plan/feature-liff-ai-prompt-inputs-1.md` and `plan/feature-admin-ai-prompt-source-visibility-1.md` before edits begin. |  |  |
| TASK-003 | Require one-line decision log for every mid-packet scope change. If the change crosses packet boundaries, stop and create a new packet instead of silently extending the current one. |  |  |

### Implementation Phase 2

- **GOAL-002**: Replace full restart behavior with impacted-surface validation.

| Task | Description | Completed | Date |
|---|---|---|---|
| TASK-004 | Define packet test tiers: Tier A (unit/logic for touched helpers), Tier B (route/UI slice checks), Tier C (release-gate full suite). |  |  |
| TASK-005 | Require each packet to record exact commands run and reason for each command. No generic "tested" statement allowed. |  |  |
| TASK-006 | Block "start over" behavior unless Tier A and Tier B both fail with incompatible root causes. Otherwise continue from latest stable commit point. |  |  |

### Implementation Phase 3

- **GOAL-003**: Synchronize plan status and operational docs with real execution state.

| Task | Description | Completed | Date |
|---|---|---|---|
| TASK-007 | Add a status consistency pass at packet close: check packet status, `plan/README.md`, and related docs for mismatch (`Ready` vs unfinished tasks). |  |  |
| TASK-008 | For AI incident materials, keep `docs/OPERATOR_RUNBOOK.md`, SOP draft, and handoff package section in lock-step with one source-of-truth delta note per update. |  |  |
| TASK-009 | Do not mark any handoff artifact as final if acceptance gates in go/no-go are still open. |  |  |

### Implementation Phase 4

- **GOAL-004**: Add closure and handoff rules that preserve context for the next executor.

| Task | Description | Completed | Date |
|---|---|---|---|
| TASK-010 | At packet completion, add a Closure Record section containing: changed files, tests executed, blocked items, and next packet trigger. |  |  |
| TASK-011 | Add a "Resume From Here" section with last known good commit/working tree assumptions and unresolved decisions. |  |  |
| TASK-012 | If unresolved blockers remain, create exactly one follow-up packet and register it in `plan/README.md`; do not scatter blockers across multiple notes. |  |  |

## 3. Alternatives

- **ALT-001**: Keep using ad-hoc chat summaries as the primary continuity mechanism. Rejected because summaries do not enforce execution gates.
- **ALT-002**: Force full regression tests after each packet. Rejected because it increases cycle time and causes avoidable restart loops.
- **ALT-003**: Merge all AI/doc/admin work into one mega-plan. Rejected because it reintroduces scope bleed and context overload.

## 4. Dependencies

- **DEP-001**: `plan/process-go-live-waves-1.md`
- **DEP-002**: `plan/process-customer-handoff-1.md`
- **DEP-003**: `plan/process-ai-preview-split-drafts-1.md`
- **DEP-004**: `plan/feature-liff-ai-prompt-inputs-1.md`
- **DEP-005**: `plan/feature-admin-ai-prompt-source-visibility-1.md`
- **DEP-006**: `docs/GO_NOGO_REVIEW.md`
- **DEP-007**: `docs/SUPABASE_MIGRATION_HISTORY_DRIFT_RUNBOOK.md`

## 5. Files

- **FILE-001**: `plan/process-anti-loop-execution-1.md` - this anti-loop coordination protocol.
- **FILE-002**: `plan/README.md` - plan stack registration and discoverability.
- **FILE-003**: `plan/process-ai-preview-split-drafts-1.md` - source packet set requiring execution discipline.
- **FILE-004**: `plan/feature-liff-ai-prompt-inputs-1.md` - packet for LIFF prompt-source path.
- **FILE-005**: `plan/feature-admin-ai-prompt-source-visibility-1.md` - packet for admin prompt-source visibility.

## 6. Testing

- **TEST-001**: Dry-run one packet kickoff and verify Packet Contract fields are fully populated before implementation.
- **TEST-002**: Execute one packet closure and verify Closure Record plus Resume From Here are present and complete.
- **TEST-003**: Validate that packet validation commands are recorded as exact commands, not summaries.
- **TEST-004**: Verify status consistency across packet file, plan index, and related handoff/go-no-go docs.

## 7. Risks & Assumptions

- **RISK-001**: If owners skip Packet Contract discipline, context drift will continue even with this protocol file present.
- **RISK-002**: If docs are updated out of sequence, false-ready signals will still cause repeated backtracking.
- **ASSUMPTION-001**: Team members will treat this plan as mandatory coordination policy for active AI and handoff packets.

## 8. Related Specifications / Further Reading

- `plan/process-go-live-waves-1.md`
- `plan/process-customer-handoff-1.md`
- `plan/process-ai-preview-split-drafts-1.md`
- `plan/feature-liff-ai-prompt-inputs-1.md`
- `plan/feature-admin-ai-prompt-source-visibility-1.md`
- `docs/GO_NOGO_REVIEW.md`
- `docs/OPERATOR_RUNBOOK.md`
- `docs/SUPABASE_MIGRATION_HISTORY_DRIFT_RUNBOOK.md`