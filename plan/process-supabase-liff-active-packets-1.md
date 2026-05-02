---
goal: Execute Priority Items 1-3: Supabase Drift Validation, Active Packet Delivery, and LIFF Live Evidence Closure
version: 1.0
date_created: 2026-04-27
last_updated: 2026-04-27
owner: Delivery Engineering
status: 'In progress'
tags: [process, supabase, liff, go-live, validation]
---

# Introduction

![Status: In progress](https://img.shields.io/badge/status-In%20progress-yellow)

This plan executes the selected priority items 1-3 in deterministic order: validate Supabase migration-history drift safely off production, complete active packet implementation work, and close LIFF live evidence gates required for launch readiness.

## 1. Requirements & Constraints

- **REQ-001**: Use [docs/SUPABASE_MIGRATION_HISTORY_DRIFT_RUNBOOK.md](../docs/SUPABASE_MIGRATION_HISTORY_DRIFT_RUNBOOK.md) as the single incident reference for this drift case.
- **REQ-002**: Execute only one active packet implementation stream at a time from [docs/START_HERE_CONTEXT_RECOVERY.md](../docs/START_HERE_CONTEXT_RECOVERY.md).
- **REQ-003**: Close LIFF live evidence using gate mapping in [plan/process-go-live-waves-1.md](process-go-live-waves-1.md) and sign-off document [docs/GO_NOGO_REVIEW.md](../docs/GO_NOGO_REVIEW.md).
- **SEC-001**: Do not expose production secrets in logs, notes, or command outputs.
- **SEC-002**: Do not mutate production migration history records ad hoc.
- **OPS-001**: Treat hosted schema as operational truth unless disposable-environment validation proves a blocker.
- **CON-001**: Do not replay local-only migrations directly on hosted production while drift is unresolved.
- **CON-002**: Keep workflow behavior aligned with [docs/workflow-policy.json](../docs/workflow-policy.json).
- **GUD-001**: Record completion evidence per task as command output summary, screenshot reference, or DB verification note.
- **GUD-002**: Mark tasks complete only after measurable validation criteria are satisfied.
- **PAT-001**: Phase dependency is strict: Phase 1 must complete before Phase 2, and Phase 2 before Phase 3.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: Validate Supabase migration-history drift behavior in disposable infrastructure without touching production history.

| Task | Description | Completed | Date |
| -------- | --------------------- | --------- | ---------- |
| TASK-001 | Create a disposable Supabase target (clone project or temporary database) and document identifier in execution notes linked to [plan/2026-04-27-supabase-migration-history-repair-plan.md](2026-04-27-supabase-migration-history-repair-plan.md). | Yes (`urfhisyagxmtsmeyvokg`) | 2026-04-29 |
| TASK-002 | Run schema presence verification queries from [docs/SUPABASE_MIGRATION_HISTORY_DRIFT_RUNBOOK.md](../docs/SUPABASE_MIGRATION_HISTORY_DRIFT_RUNBOOK.md) section 6 against disposable target and store result summary with pass/fail per object. |  |  |
| TASK-003 | Run Supabase tooling path (`migration list`, `db push` dry workflow) against disposable target and classify result as `works-with-drift` or `blocked-by-history`. | Yes (`works-with-drift`) | 2026-04-29 |
| TASK-004 | If blocked, document exact blocker command, error signature, and affected migration IDs in [plan/2026-04-27-supabase-migration-history-repair-plan.md](2026-04-27-supabase-migration-history-repair-plan.md) under a new validation subsection. |  |  |
| TASK-005 | Publish Phase 1 decision outcome as one of two explicit states: `Forward-only continues` or `Repair strategy required`, with rationale and rollback-safe note. | Yes (`Forward-only continues`) | 2026-04-29 |

Phase 1 no-Docker rule on this machine (2026-04-27):

- Docker daemon is unavailable (`Docker Desktop is unable to start`), so local disposable DB path cannot be executed here.
- Continue Phase 1 with remote-only, non-production evidence path until Docker-capable runner is available.
- Keep production history immutable while this constraint exists.

### Implementation Phase 2

- GOAL-002: Execute active packet delivery work in single-stream order with explicit Done/Remaining/Risks updates.

| Task | Description | Completed | Date |
| -------- | --------------------- | --------- | ---- |
| TASK-006 | Execute [plan/feature-liff-ai-prompt-inputs-1.md](feature-liff-ai-prompt-inputs-1.md) tasks in defined order and update each task row with completion state and date. | Yes | 2026-04-29 |
| TASK-007 | Validate LIFF input capture path end-to-end for `design_brief` and advanced `aiImagePrompt` payload storage through [src/app/liff/intake/intake-form.tsx](../src/app/liff/intake/intake-form.tsx) and [src/app/api/intake/route.ts](../src/app/api/intake/route.ts). | Yes (code-path + focused tests) | 2026-04-27 |
| TASK-008 | Execute [plan/feature-admin-ai-prompt-source-visibility-1.md](feature-admin-ai-prompt-source-visibility-1.md) tasks after TASK-006 and TASK-007 complete. | Yes | 2026-04-27 |
| TASK-009 | Validate admin raw prompt-source visibility in [src/app/admin/customers/[id]/customer-360-client.tsx](../src/app/admin/customers/[id]/customer-360-client.tsx) with non-empty and empty-state lead samples. | Yes (UI + diagnostics) | 2026-04-27 |
| TASK-010 | Append packet-scoped update in [docs/START_HERE_CONTEXT_RECOVERY.md](../docs/START_HERE_CONTEXT_RECOVERY.md) format containing `Done`, `Remaining`, and `Risks` for each packet. | Yes (captured in packet files) | 2026-04-27 |

### Implementation Phase 3

- GOAL-003: Close remaining LIFF live evidence gates and finalize Go/No-Go readiness inputs.

| Task | Description | Completed | Date |
| -------- | --------------------- | --------- | ---- |
| TASK-011 | Execute LIFF live checks LIFF-VAL-004 to LIFF-VAL-008 from [plan/process-go-live-waves-1.md](process-go-live-waves-1.md) and capture evidence references for each check. |  |  |
| TASK-012 | Update pending gate items in [docs/GO_NOGO_REVIEW.md](../docs/GO_NOGO_REVIEW.md) that map to Wave 2 and Wave 3 checks (`P2-G03`, `P2-G05`, `P2-G06`, `P2-G07`, `P3-G04`, `P3-G05`). |  |  |
| TASK-013 | Execute one real LINE -> LIFF -> intake run and verify creation of customer, lead, and quote records plus product/document/billing snapshots. |  |  |
| TASK-014 | Execute returning-customer LIFF prefill run and verify phone, document type, and billing defaults are prefilled correctly. |  |  |
| TASK-015 | Record gate closure evidence and explicit launch-readiness delta in [docs/GO_NOGO_REVIEW.md](../docs/GO_NOGO_REVIEW.md) without marking final sign-off complete unless all required gates are closed. |  |  |

## Execution Update - 2026-04-27 (Attempt 1)

### Done

- Confirmed CLI path works through `npx supabase` (`2.92.1`) even when global `supabase` command is unavailable.
- Captured Phase 1 blocker signatures needed for incident traceability:
	- local migration path blocked because local DB is not running (`127.0.0.1:54322 refused`).
	- linked remote path blocked because project is not linked (`Cannot find project ref. Have you run supabase link?`).
	- disposable local stack bootstrap blocked because Docker Desktop engine pipe is unavailable.

### Remaining

- Start Docker Desktop and re-run `npx supabase start` to create disposable local target.
- Run `npx supabase migration list --local` and `npx supabase db push --dry-run` against the disposable target.
- Link a non-production project using `npx supabase link --project-ref <ref>` and classify remote path behavior for drift.
- Complete TASK-001 to TASK-005 with explicit `Forward-only continues` or `Repair strategy required` outcome.

### Risks

- Without Docker or linked project ref, Phase 1 cannot complete and any drift decision remains preliminary.
- Running `supabase link` against production by mistake can create unsafe command context; enforce non-production ref only.

## 3. Alternatives

- **ALT-001**: Repair production migration history immediately. Rejected because risk is high and disposable validation is not yet complete.
- **ALT-002**: Run active packets in parallel. Rejected because recovery rules require single active packet execution to prevent context drift.
- **ALT-003**: Declare LIFF ready from local-only checks. Rejected because live console and real identity path evidence is still required.

## 4. Dependencies

- **DEP-001**: Access to disposable Supabase environment for safe drift tooling tests.
- **DEP-002**: Access to LINE Developers and LIFF console for endpoint and runtime verification.
- **DEP-003**: Access to deployed environment where real LINE identity path can be tested.
- **DEP-004**: Maintainer access to update planning and go/no-go documents.

## 5. Files

- **FILE-001**: [docs/SUPABASE_MIGRATION_HISTORY_DRIFT_RUNBOOK.md](../docs/SUPABASE_MIGRATION_HISTORY_DRIFT_RUNBOOK.md) - incident-safe verification and operator rules.
- **FILE-002**: [plan/2026-04-27-supabase-migration-history-repair-plan.md](2026-04-27-supabase-migration-history-repair-plan.md) - drift repair decision flow and validation outcomes.
- **FILE-003**: [docs/START_HERE_CONTEXT_RECOVERY.md](../docs/START_HERE_CONTEXT_RECOVERY.md) - packet execution rules and status format.
- **FILE-004**: [plan/feature-liff-ai-prompt-inputs-1.md](feature-liff-ai-prompt-inputs-1.md) - active LIFF packet.
- **FILE-005**: [plan/feature-admin-ai-prompt-source-visibility-1.md](feature-admin-ai-prompt-source-visibility-1.md) - active admin packet.
- **FILE-006**: [plan/process-go-live-waves-1.md](process-go-live-waves-1.md) - primary execution and LIFF validation gates.
- **FILE-007**: [docs/GO_NOGO_REVIEW.md](../docs/GO_NOGO_REVIEW.md) - live gate evidence and acceptance status.

## 6. Testing

- **TEST-001**: Disposable-environment schema verification queries return expected presence for all required columns/tables/constraints.
- **TEST-002**: Disposable-environment Supabase migration workflow classification is documented with reproducible command evidence.
- **TEST-003**: LIFF packet regression checks pass for intake parsing and lead persistence behavior.
- **TEST-004**: Admin packet checks pass for raw prompt-source visibility and empty-state behavior.
- **TEST-005**: Live LIFF first-time and returning-customer runs complete with expected data snapshots and gate evidence.

## 7. Risks & Assumptions

- **RISK-001**: Disposable environment may not mirror hosted behavior perfectly, requiring one additional controlled rehearsal.
- **RISK-002**: Live LIFF checks can fail due to console misconfiguration even if code path is correct.
- **RISK-003**: Parallel packet execution can reintroduce context drift and false completion signals.
- **ASSUMPTION-001**: Current hosted schema remains complete for known drifted objects during this execution window.
- **ASSUMPTION-002**: Required operator access for LINE, LIFF, and Vercel settings is available during execution.

## 8. Related Specifications / Further Reading

- [docs/SUPABASE_MIGRATION_HISTORY_DRIFT_RUNBOOK.md](../docs/SUPABASE_MIGRATION_HISTORY_DRIFT_RUNBOOK.md)
- [plan/2026-04-27-supabase-migration-history-repair-plan.md](2026-04-27-supabase-migration-history-repair-plan.md)
- [docs/START_HERE_CONTEXT_RECOVERY.md](../docs/START_HERE_CONTEXT_RECOVERY.md)
- [plan/process-go-live-waves-1.md](process-go-live-waves-1.md)
- [docs/GO_NOGO_REVIEW.md](../docs/GO_NOGO_REVIEW.md)
- [docs/workflow-policy.json](../docs/workflow-policy.json)

## Execution Delta - 2026-04-27 (No Docker Path)

### Done

- Implemented LIFF capture and API persistence path for `designBrief` and `aiImagePrompt`.
- Implemented Customer 360 raw prompt-source visibility for `design_brief`, `ai_image_prompt`, and `ai_prompt_snapshot`.
- Focused diagnostics for changed files reported no editor/type errors.

### Remaining

- Phase 1 classification (`works-with-drift` vs `blocked-by-history`) still needs a Docker-capable or disposable remote runner.
- Live LIFF evidence tasks in Phase 3 remain pending because they require real LINE/LIFF environment runs.

### Risks

- Without Docker-capable validation, Supabase drift decision remains partially evidenced.
- One targeted test in baseline suite (`tests/payment-display.test.ts`) fails due to unrelated existing module resolution issue.

## Execution Delta - 2026-04-29 (Supabase MCP Connected)

### Done

- Confirmed Supabase MCP connectivity and enumerated current branches.
- Identified existing preview branch `fix/quote-payment-instructions-mainbase` with project ref `urfhisyagxmtsmeyvokg` as the current disposable-target candidate.
- Pulled remote migration history through MCP and confirmed hosted history still differs from several local migration filenames while newer repair migrations exist remotely.
- Re-ran safe verification queries on the connected hosted project and confirmed sample drift-sensitive objects remain present:
	- `lead_media_assets.storage_provider`
	- `lead_media_assets.storage_bucket`
	- `leads.design_brief`
	- `leads.ai_prompt_snapshot`
	- `quotes.payment_profile_snapshot`
	- `product_catalog_items`
- Closed Phase 2 packet gap by adding focused intake payload coverage in `tests/intake-payload.test.ts` and validating the new helper-backed path successfully.

### Remaining

- Phase 1 still needs a disposable-target migration workflow check (`migration list` or equivalent dry-run behavior) against the preview branch or another non-production target.
- Phase 3 LIFF live evidence tasks remain pending because they require real LINE and LIFF runtime execution.

### Risks

- CLI auth is still unauthorized even though Supabase MCP is connected, so CLI-only rehearsal commands remain blocked.
- Current MCP SQL tools appear scoped to the connected hosted project; without switching the connection to the preview branch, disposable-target verification is still incomplete.

## Execution Delta - 2026-04-29 (Preview Branch CLI Validation)

### Done

- Loaded a working Supabase PAT into the local CLI shell.
- Linked the repo to preview branch project ref `urfhisyagxmtsmeyvokg`.
- Ran `npx supabase migration list` successfully against the preview branch.
- Ran `npx supabase db push --dry-run` successfully against the preview branch.
- Classified the disposable-target tooling path as `works-with-drift` and published the Phase 1 decision as `Forward-only continues`.

### Remaining

- Optional strengthening evidence only: run the runbook schema presence queries directly against the preview branch once a local SQL client or branch-scoped MCP SQL path is available.
- Phase 3 LIFF live evidence tasks remain pending because they require real LINE and LIFF runtime execution.

### Risks

- Preview validation proves the tooling path is not blocked by drift, but it does not by itself verify every expected preview-branch column without a direct SQL query path.
- The workspace is now linked to preview ref `urfhisyagxmtsmeyvokg` under `supabase/.temp/project-ref`; future CLI commands from this repo will target that branch until re-linked.
