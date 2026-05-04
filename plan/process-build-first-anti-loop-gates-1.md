---
goal: Build-First Anti-Loop Gates And Multi-Agent Feature Boundaries
version: 1.1
date_created: 2026-05-02
last_updated: 2026-05-02
owner: Delivery Engineering
status: 'Planned'
tags: [process, runbook, gates, anti-loop, validation, multi-agent]
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

This plan changes FOGUS execution discipline from early full-regression testing to build-first, slice-based validation. It also defines feature-lane boundaries so multiple agents can build commercial documents, accounting export, AI prompt automation, role approval, and UI surfaces without overlapping ownership.

## 1. Requirements & Constraints

- **REQ-001**: Do not run full regression before a release-freeze point is declared.
- **REQ-002**: Validate only the impacted surface after each implementation slice.
- **REQ-003**: Treat every code change after a test run as invalidating only the affected evidence, not the entire evidence bundle.
- **REQ-004**: Keep one active packet per implementation pass.
- **REQ-005**: Record each validation command, scope, result, and stale-when condition.
- **REQ-006**: Add a build-first gate before broad operator or live-device validation.
- **REQ-007**: Keep workflow policy checks mandatory only when workflow policy or transition behavior changes.
- **REQ-008**: Keep commercial document validation aligned with `docs/COMMERCIAL_DOCUMENT_POLICY_V1.md`.
- **REQ-009**: Split code work into explicit feature lanes so multiple agents can work in parallel without touching the same ownership surface.
- **REQ-010**: Every feature lane must declare owned files, shared contracts, forbidden files, validation commands, and merge prerequisites before implementation starts.
- **REQ-011**: Shared contracts must be changed before dependent feature lanes and must be versioned in a single shared file or migration.
- **CON-001**: Do not mark GO in `docs/GO_NOGO_REVIEW.md` from partial slice tests.
- **CON-002**: Do not bundle R2, Studio, AI provider architecture, commercial documents, role approval, and AI prompt automation in one validation gate.
- **CON-003**: Existing Phase 2 and Phase 3 live evidence remains historical evidence unless the touched surface invalidates it.
- **CON-004**: No agent may edit another lane's owned files unless the active packet is explicitly reassigned.
- **CON-005**: Database migrations are serialized; only one agent may create or alter migration files in a single merge window.
- **GUD-001**: Prefer fast deterministic checks before browser/live-device checks.
- **GUD-002**: Use stale-evidence labels instead of restarting all gates from zero.
- **PAT-001**: Gate order is Environment -> Scope -> Build -> Slice Test -> Integration Smoke -> Release Freeze -> Full Regression.
- **PAT-002**: One failed slice test returns to implementation for that slice only.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: Replace early full-regression behavior with a build-first gate ladder.

|Task|Description|Completed|Date|
|--------|---------------------|---------|----------|
|TASK-001|Update `plan/process-anti-loop-execution-1.md` to state that full regression is forbidden before `GATE-060 Release Freeze` unless the active packet explicitly touches cross-system behavior.|||
|TASK-002|Add `GATE-010 Worktree Drift`, `GATE-020 Packet Scope`, `GATE-030 Build Compile`, `GATE-040 Slice Validation`, `GATE-050 Integration Smoke`, `GATE-060 Release Freeze`, and `GATE-070 Full Regression` definitions to `plan/process-anti-loop-execution-1.md`.|||
|TASK-003|Add a stale-evidence rule to `plan/process-anti-loop-execution-1.md`: only tests covering files changed after the evidence was captured become stale.|||

### Implementation Phase 2

- GOAL-002: Make runbooks point to the new gate ladder without deleting existing launch evidence.

|Task|Description|Completed|Date|
|--------|---------------------|---------|----|
|TASK-004|Update `docs/START_HERE_CONTEXT_RECOVERY.md` Hard Recovery Rules so agents run worktree and packet checks first, then implementation, then impacted-surface validation.|||
|TASK-005|Update `docs/GO_NOGO_REVIEW.md` with a `Code Freeze Rule` stating that final GO evidence is captured only after no more launch-blocking code changes remain.|||
|TASK-006|Update `docs/OPERATOR_RUNBOOK.md` so live operator checks are marked `release-gate only` unless the task is an operator-only config change.|||

### Implementation Phase 3

- GOAL-003: Apply the gate ladder to the active commercial/B2B implementation packet.

|Task|Description|Completed|Date|
|--------|---------------------|---------|----|
|TASK-007|Update `plan/feature-commercial-documents-1.md` with `Validation Strategy`: build and lint after backend slices, route-level smoke after API slices, full regression only after backend core and UI surfaces stop changing.|||
|TASK-008|Add stale-evidence labels to `plan/feature-commercial-documents-1.md` for commercial schema, payment confirmation, document issue validation, accounting export, AI prompt automation, and role approval surfaces.|||
|TASK-009|Add `Release Freeze Entry Criteria` to `plan/feature-commercial-documents-1.md`: no pending schema migrations, no pending API contract changes, no pending approval-state changes, and no pending document-number changes.|||

### Implementation Phase 4

- GOAL-004: Define exact gate meanings so agents do not reinterpret validation order.

|Task|Description|Completed|Date|
|--------|---------------------|---------|----|
|TASK-010|Define `GATE-010 Worktree Drift` as `git status --porcelain` plus staged/unstaged/untracked classification before edits.|||
|TASK-011|Define `GATE-020 Packet Scope` as exactly one active packet file and one declared touched-surface set.|||
|TASK-012|Define `GATE-030 Build Compile` as TypeScript/editor problem check for touched files plus `npm run lint` when routes, TypeScript helpers, or UI surfaces change.|||
|TASK-013|Define `GATE-040 Slice Validation` as tests or API smoke that cover only changed code in the current packet.|||
|TASK-014|Define `GATE-050 Integration Smoke` as one happy-path run across directly adjacent surfaces only.|||
|TASK-015|Define `GATE-060 Release Freeze` as a written stop on further code/schema/API changes for the release candidate.|||
|TASK-016|Define `GATE-070 Full Regression` as build, lint, workflow smoke, targeted tests, live browser/LIFF/operator checks, and final GO evidence after release freeze.|||

### Implementation Phase 5

- GOAL-005: Add feature-lane boundaries for multi-agent development and maintenance.

|Task|Description|Completed|Date|
|--------|---------------------|---------|----|
|TASK-017|Define lane `LANE-COMMERCIAL-CORE` for commercial domain helpers, commercial API routes, and commercial migrations. This lane owns receiver lock, payment confirmation, document issue validation, document numbers, and immutability.|||
|TASK-018|Define lane `LANE-ACCOUNTING-EXPORT` for accounting exports and accountant handoff fields. This lane consumes commercial documents and payments but does not create or mutate them.|||
|TASK-019|Define lane `LANE-AI-PROMPT-DESIGN` for LIFF prompt capture, prompt snapshots, generated preview records, and design approval handoff. This lane must not alter payment or document issuance rules.|||
|TASK-020|Define lane `LANE-ROLE-APPROVAL` for role queues, approval steps, permission checks, and escalation routing. This lane consumes workflow/commercial/design status contracts but must not invent workflow states.|||
|TASK-021|Define lane `LANE-UI-SURFACES` for admin/customer UI shells that call existing APIs. This lane must not bypass service validation with client-side-only rules.|||
|TASK-022|Define lane `LANE-SHARED-CONTRACTS` for shared enums, database migrations, API payload types, and workflow-policy changes. This lane merges before all dependent lanes.|||
|TASK-023|Add `Feature Lane Contract` blocks to active packet files before implementation: owner, owned files, shared contracts, forbidden files, inputs, outputs, events emitted, tests, and stale evidence triggers.|||
|TASK-024|Add merge order rule: shared contracts first, service/domain lanes second, API lanes third, UI lanes fourth, full regression only after all lanes are frozen.|||

### Feature Lane Contract Template

Use this template at the top of each active feature packet before coding:

|Field|Required Content|
|--------|----------------|
|Lane ID|Stable lane identifier such as `LANE-COMMERCIAL-CORE`|
|Goal|One business outcome the lane owns|
|Owned Files|Exact file/path patterns the lane may edit|
|Shared Contracts|Types, migrations, API schemas, events, or workflow policy this lane consumes or changes|
|Forbidden Files|Files this lane must not edit in the current pass|
|Inputs|Data/events the lane reads|
|Outputs|Data/events/API responses the lane emits|
|Validation|Slice-level checks for this lane only|
|Stale Evidence Triggers|File or contract changes that invalidate this lane's evidence|
|Merge Prerequisites|Lanes or migrations that must land before this lane|

### Initial Lane Boundary Map

|Lane|Owned Surface|Must Not Own|
|--------|----------------|----------------|
|`LANE-COMMERCIAL-CORE`|commercial entities, orders, payments, document validation, document numbering, immutable snapshots|AI prompt generation, design preview UI, role dashboard presentation|
|`LANE-ACCOUNTING-EXPORT`|accountant CSV/export fields, accountant handoff summaries, export filters|payment confirmation, receiver selection, document issuance|
|`LANE-AI-PROMPT-DESIGN`|prompt inputs, prompt snapshots, generated preview metadata, design approval handoff|tax logic, receiver lock, accounting export mutation|
|`LANE-ROLE-APPROVAL`|role approval model, approval events, queues, permission gates|commercial policy math, document number generation, image generation provider|
|`LANE-UI-SURFACES`|admin/customer screens that consume APIs and show warnings|server-side policy bypass, workflow-state shortcuts, direct DB writes|
|`LANE-SHARED-CONTRACTS`|shared enums, migrations, API contracts, audit event names|feature-specific UI or business side effects|

### Multi-Agent Guard Rules

- **MAG-001**: One agent owns one lane per pass; a second agent can work only on a non-overlapping lane.
- **MAG-002**: A lane may read another lane's files but must not edit them without changing the active lane assignment.
- **MAG-003**: Shared-contract changes freeze dependent lanes until the contract is merged or explicitly versioned.
- **MAG-004**: If two lanes need the same file, move the shared part into `LANE-SHARED-CONTRACTS` first.
- **MAG-005**: UI lanes may display policy states but may not implement policy decisions outside server/domain helpers.
- **MAG-006**: API lanes must call shared service helpers instead of duplicating validation logic in route handlers.
- **MAG-007**: Every lane emits audit events through the existing action log helper or a declared shared logging helper.

## 3. Alternatives

- **ALT-001**: Keep running full GO/NO-GO after every partial implementation slice. Rejected because later code changes invalidate parts of the evidence and force repeated testing.
- **ALT-002**: Stop all testing until the very end. Rejected because slice-level bugs would accumulate and become expensive to isolate.
- **ALT-003**: Keep one large mega-packet for commercial documents, AI prompt automation, role approval, and accounting. Rejected because failures would not identify the responsible surface.

## 4. Dependencies

- **DEP-001**: `plan/process-anti-loop-execution-1.md` remains the existing anti-loop coordination plan to update.
- **DEP-002**: `docs/START_HERE_CONTEXT_RECOVERY.md` remains the recovery entry point after restart, profile switch, or worktree drift.
- **DEP-003**: `docs/GO_NOGO_REVIEW.md` remains the final launch gate and must not be used as partial-slice validation.
- **DEP-004**: `docs/OPERATOR_RUNBOOK.md` remains the operational runbook and should receive release-gate wording.
- **DEP-005**: `plan/feature-commercial-documents-1.md` is the active packet that needs the new validation strategy first.
- **DEP-006**: `docs/COMMERCIAL_DOCUMENT_POLICY_V1.md` remains the commercial document policy source.

## 5. Files

- **FILE-001**: `plan/process-build-first-anti-loop-gates-1.md` - new plan defining the build-first gate ladder and feature-lane boundaries.
- **FILE-002**: `plan/process-anti-loop-execution-1.md` - target coordination plan for gate definitions and stale-evidence rules.
- **FILE-003**: `docs/START_HERE_CONTEXT_RECOVERY.md` - target recovery entrypoint for after-restart execution order.
- **FILE-004**: `docs/GO_NOGO_REVIEW.md` - target final gate document for code-freeze wording.
- **FILE-005**: `docs/OPERATOR_RUNBOOK.md` - target operator runbook for release-gate-only live checks.
- **FILE-006**: `plan/feature-commercial-documents-1.md` - target active packet for validation strategy and release-freeze criteria.

## 6. Testing

- **TEST-001**: Verify that `plan/process-anti-loop-execution-1.md` contains all gate IDs from `GATE-010` through `GATE-070` after implementation.
- **TEST-002**: Verify that `docs/GO_NOGO_REVIEW.md` contains `Code Freeze Rule` and does not mark partial implementation evidence as GO evidence.
- **TEST-003**: Verify that `plan/feature-commercial-documents-1.md` lists slice validation before full regression.
- **TEST-004**: Verify that active packet files contain a `Feature Lane Contract` block before multi-agent work begins.
- **TEST-005**: Verify that no two active lanes list the same owned file pattern unless the shared part has moved to `LANE-SHARED-CONTRACTS`.
- **TEST-006**: Run markdown link checks or manual link inspection for every edited document path.
- **TEST-007**: Run `npm run lint` only if implementation touches route, TypeScript, or UI files; docs-only edits do not require app lint.

## 7. Risks & Assumptions

- **RISK-001**: If release freeze is declared too early, necessary B2B policy work may be rushed or hidden as hotfixes.
- **RISK-002**: If slice validation is too narrow, cross-surface breakage may escape until release freeze.
- **RISK-003**: If stale-evidence labels are not maintained, the team may trust outdated evidence.
- **RISK-004**: If lane ownership is vague, multiple agents may edit the same shared files and create merge churn.
- **ASSUMPTION-001**: Commercial documents, AI prompt automation, and role approval are still changing, so full GO validation now would be premature.
- **ASSUMPTION-002**: Existing live evidence remains useful as historical baseline unless a changed surface invalidates it.
- **ASSUMPTION-003**: Delivery Engineering can enforce a written release freeze before final operator testing.

## 8. Related Specifications / Further Reading

[process-anti-loop-execution-1.md](process-anti-loop-execution-1.md)

[../docs/START_HERE_CONTEXT_RECOVERY.md](../docs/START_HERE_CONTEXT_RECOVERY.md)

[../docs/GO_NOGO_REVIEW.md](../docs/GO_NOGO_REVIEW.md)

[../docs/OPERATOR_RUNBOOK.md](../docs/OPERATOR_RUNBOOK.md)

[feature-commercial-documents-1.md](feature-commercial-documents-1.md)

[../docs/COMMERCIAL_DOCUMENT_POLICY_V1.md](../docs/COMMERCIAL_DOCUMENT_POLICY_V1.md)
