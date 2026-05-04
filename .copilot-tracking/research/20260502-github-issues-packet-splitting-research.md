<!-- markdownlint-disable-file -->

# Task Research Notes: GitHub Issues Packet Splitting

## Research Executed

### File Analysis

- `plan/README.md`
  - Verified that the repository already uses plan files as the canonical packet index and execution entry points. Existing registered plans include go-live waves, anti-loop execution, feature completeness recovery, build-first gates, commercial documents, and related feature/process packets.
- `plan/process-feature-completeness-recovery-1.md`
  - Verified the current product gap matrix and recommended packet order. The plan identifies missing/next packet areas: docs/worktree repair, real actor audit, staff roles and ownership, admin table/detail mode, customer profile operations, commercial documents, R2 media delivery, and AI prompt operations.
  - Noted that its baseline mentions `main` and an unstable worktree, which may be stale relative to the current branch `dev/commercial-document-core`; packet recommendations should rely on its gap matrix, not stale branch baseline text.
- `plan/process-build-first-anti-loop-gates-1.md`
  - Verified feature-lane boundary rules for multi-agent development. Lanes include `LANE-COMMERCIAL-CORE`, `LANE-ACCOUNTING-EXPORT`, `LANE-AI-PROMPT-DESIGN`, `LANE-ROLE-APPROVAL`, `LANE-UI-SURFACES`, and `LANE-SHARED-CONTRACTS`.
  - Verified guard rules: one agent owns one lane per pass, shared contracts freeze dependent lanes, UI lanes cannot implement policy decisions, API lanes must call shared service helpers, and every lane must emit audit events through declared logging.
- `plan/feature-commercial-documents-1.md`
  - Verified active packet status is `In progress` and scope is commercial document core. The packet owns the invariant `money receiver -> document issuer`, receiver lock, payment receiver entities, document model/numbering, validation, immutable snapshots, audit, and tests.
- `.github/copilot-instructions.md`
  - Verified repository-level instructions exist, but no GitHub issue templates were found under `.github/ISSUE_TEMPLATE/`.

### Code Search Results

- `feature-|packet|Next Packet|Recommended Execution Order|GitHub|issue|Issue` in `plan/**`
  - Found extensive packet and lane terminology in process plans, including packet boundaries, next-packet triggers, open issue/backlog notes, and multi-agent lane contracts.
- `.github/ISSUE_TEMPLATE/**`
  - No files found; the repository currently has no issue template forms or markdown templates.
- `labels|bug|enhancement|issue_template|Issue|Task|Feature` in `.github/**`
  - Found GitHub-related tool capability references in `.github/agents/supabase-cli-helper.agent.md`, including issue read/write, label fetch, pull request read/write, and secret scanning tools. No repository issue taxonomy was defined there.

### External Research

- #githubRepo:"akkpol/craft-run-app issues pull requests via gh CLI"
  - Current GitHub Issues state: only one open issue was returned: #9, `ปรับ UX/UI ให้ทันสมัยสไตล์ปี 2026 (modern, Apple-inspired, minimal, enterprise readable, responsive, dark mode, animation, forms)`, labeled `enhancement`, assigned to `akkpol` and `Claude`.
  - Current open PRs include #25 `[codex] liff observability tests`, #20 `fix(ci): add missing env vars to GitHub Actions build job`, #17 `Add quote payment instructions and harden webhook verify path`, #13 `Stabilize deploy checks and add GitHub Actions CI`, and #11 `[WIP] Update UX/UI to modern style inspired by 2026 design trends`.
  - Existing issue #9 maps only to UI modernization and should not be reused as the parent for commercial-core, audit, staff ownership, R2, or AI prompt operations work.
- #fetch:https://docs.github.com/en/issues/tracking-your-work-with-issues/about-issues
  - GitHub Issues can track tasks, bugs, features, and ideas; issues can have metadata such as issue types, labels, and milestones; sub-issues can break larger work into smaller issues; dependencies can represent blocking relationships; pull requests can link to and close issues.
- #fetch:https://docs.github.com/en/issues/planning-and-tracking-with-projects/learning-about-projects/about-projects
  - GitHub Projects can provide table, board, and roadmap views over issues and PRs. Projects support custom fields, grouping/filtering, charts, status updates, and automation while staying synchronized with issue/PR metadata.
- #fetch:https://docs.github.com/en/issues/tracking-your-work-with-issues/creating-an-issue
  - `gh issue create` can create issues non-interactively with title and body, and can add assignees, labels, milestones, and projects. Issues can also be created from repository UI, code, PR comments, projects, task list items, URL queries, and Copilot Chat.
- #fetch:https://docs.github.com/en/issues/using-labels-and-milestones-to-track-work/managing-labels
  - Labels classify issues, pull requests, and discussions. Default labels include `bug`, `documentation`, `duplicate`, `enhancement`, `good first issue`, `help wanted`, `invalid`, `question`, and `wontfix`. Custom labels can be created by users with write access.

### Project Conventions

- Standards referenced: `docs/workflow-policy.json`, `plan/process-go-live-waves-1.md`, `plan/process-anti-loop-execution-1.md`, `plan/process-feature-completeness-recovery-1.md`, `plan/process-build-first-anti-loop-gates-1.md`, `.github/copilot-instructions.md`.
- Instructions followed: research-only mode; no source or configuration files modified; only this research file was created under `.copilot-tracking/research/`.

## Key Discoveries

### Project Structure

The repository already has a stronger planning primitive than GitHub Issues: packet files under `plan/`. These files define scope, gates, stop rules, owner intent, validation expectations, and conflict priority. GitHub Issues should therefore become the visible backlog and assignment layer, not the source of execution truth.

### Implementation Patterns

The project uses packet and lane boundaries to prevent scope mixing. The issue structure should mirror those boundaries:

- One GitHub Issue per execution packet or lane-sized backlog unit.
- One active implementation branch per issue/packet.
- Packet file remains canonical for what can be edited and how validation is performed.
- Issue body links to the packet file and summarizes objective, scope, stop rules, dependencies, and success criteria.
- PR title/body references the issue and the packet; PR close keywords should be used only when the packet is fully complete.

### Complete Examples

```markdown
Title: packet: commercial document core

Source packet: plan/feature-commercial-documents-1.md
Lane: LANE-COMMERCIAL-CORE
Status: In progress

Objective
Implement the commercial document core invariant: money receiver -> document issuer.

Scope
- Receiver entity selection and lock behavior
- Payment receiver entity validation
- Commercial document issue validation
- Document numbering and immutable snapshots
- Audit events and targeted tests

Dependencies
- docs/COMMERCIAL_DOCUMENT_POLICY_V1.md
- supabase/migrations/20260502113000_add_commercial_document_core.sql
- docs/workflow-policy.json

Success criteria
- Selected receiver cannot change after confirmed payment
- Issued document issuer matches payment receiver
- Document numbers are transaction-safe
- Issued document snapshots are immutable
- Tests cover receiver lock, issue validation, and numbering
```

### API and Schema Documentation

GitHub Issues support labels, milestones, assignees, issue types, sub-issues, dependencies, PR references, and close keywords. GitHub Projects can add custom fields and saved views without replacing issue metadata. The repository has no issue templates today, so packet issue bodies should be generated consistently by `gh issue create --title ... --body ... --label ...` or GitHub UI until templates are intentionally added.

### Configuration Examples

```text
Recommended labels for packet tracking:
packet
packet:process
packet:feature
lane:shared-contracts
lane:commercial-core
lane:accounting-export
lane:ai-prompt-design
lane:role-approval
lane:ui-surfaces
status:blocked
status:ready
status:active
status:needs-research
```

### Technical Requirements

- Avoid using existing issue #9 as a catch-all; it should remain UI modernization only.
- Do not create issues for stale or already-merged PR history unless a remaining actionable gap is verified.
- Keep packet issues small enough that one issue maps to one plan packet or one feature lane.
- Treat `LANE-SHARED-CONTRACTS` as a prerequisite issue whenever schema/API/workflow policy changes unblock other lanes.
- Use labels to expose packet/lane classification because no repo issue templates currently exist.

## Recommended Approach

Use a packet-backed GitHub Issue system: create one issue per packet/lane from the existing recovery matrix, keep packet files as canonical execution contracts, and use labels/project fields only for visibility and sequencing.

Recommended initial issue set:

1. `packet: docs and worktree repair`
   - Source: `plan/process-feature-completeness-recovery-1.md` and docs/worktree repair trigger notes.
   - Purpose: remove stale baseline ambiguity, verify active branch/worktree state, align plan index before more feature work.
   - Labels: `packet`, `packet:process`, `status:ready`.
2. `packet: real actor audit`
   - Source: recovery matrix gap and commercial receiver route finding.
   - Purpose: replace placeholder/admin-only actor evidence with real authenticated actor audit context.
   - Labels: `packet`, `packet:feature`, `lane:shared-contracts` or `lane:role-approval` depending on final ownership.
3. `packet: staff roles and ownership`
   - Source: recovery matrix and feature lane map.
   - Purpose: define staff role permissions, ownership, approval routing, and queues without inventing workflow states.
   - Labels: `packet`, `packet:feature`, `lane:role-approval`.
4. `packet: admin table detail mode`
   - Source: recovery matrix.
   - Purpose: improve admin operational surfaces that consume APIs and show policy state without bypassing server validation.
   - Labels: `packet`, `packet:feature`, `lane:ui-surfaces`.
5. `packet: customer profile operations`
   - Source: recovery matrix.
   - Purpose: customer profile operational flows and admin/customer consumption surfaces.
   - Labels: `packet`, `packet:feature`, `lane:ui-surfaces` or `lane:shared-contracts` if schema contracts are needed.
6. `packet: commercial document core`
   - Source: `plan/feature-commercial-documents-1.md`.
   - Purpose: track current active branch `dev/commercial-document-core` and the commercial invariant work.
   - Labels: `packet`, `packet:feature`, `lane:commercial-core`, `status:active`.
7. `packet: R2 media delivery`
   - Source: recovery matrix and existing R2 deployment history.
   - Purpose: delivery, validation, and operational hardening for R2 media flow.
   - Labels: `packet`, `packet:feature`, `status:ready`.
8. `packet: AI prompt operations`
   - Source: recovery matrix and lane map.
   - Purpose: prompt snapshots, generated preview records, and design approval handoff without touching payment/document policy.
   - Labels: `packet`, `packet:feature`, `lane:ai-prompt-design`.
9. Keep existing issue #9 as `packet: UI modernization` only if it receives a packet-style body update.
   - Source: current GitHub issue #9 and PR #11.
   - Purpose: isolate visual modernization from workflow/commercial-core correctness.
   - Labels: existing `enhancement`, plus recommended `packet`, `lane:ui-surfaces` if labels are created.

## Implementation Guidance

- **Objectives**: Align GitHub Issues with the existing packet system so every work item has one visible tracker, one plan source, one branch/PR path, and one validation boundary.
- **Key Tasks**: Create packet labels, create one issue per recommended packet, link each issue to its packet file, mark the active commercial document issue as active, and optionally create a GitHub Project view grouped by lane/status.
- **Dependencies**: GitHub CLI authenticated access; repository write/triage permissions for labels and issues; decision on whether to create custom labels before issues; review of stale open PRs before linking them to new issues.
- **Success Criteria**: No packet is tracked only in chat; issue #9 remains UI-only; commercial document work has its own active issue; every packet issue states source packet, lane, dependencies, stop rules, and validation criteria; PRs reference the corresponding issue without closing it prematurely.