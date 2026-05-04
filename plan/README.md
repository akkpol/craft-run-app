# Plan Index

This folder contains the active execution plan, supporting coordination plans, scoped feature plans, and research notes for the current FOGUS delivery work.

## Usage Order

1. If context may have drifted, start with [../docs/START_HERE_CONTEXT_RECOVERY.md](../docs/START_HERE_CONTEXT_RECOVERY.md).
2. Start with [process-go-live-waves-1.md](process-go-live-waves-1.md).
3. Use supporting plans only to deepen one area of work.
4. Use scoped feature or follow-up plans only when that task is explicitly being executed.
5. Treat notes and research files as context, not as the source of execution order.

If two documents appear to conflict on immediate next steps, follow [process-go-live-waves-1.md](process-go-live-waves-1.md) and reconcile the other file back to it.

## Plan Stack

|File|Role|Use when|
|------|------|----------|
|[process-go-live-waves-1.md](process-go-live-waves-1.md)|Primary execution plan|You need the current delivery order, go-live sequence, or next implementation wave|
|[CORE_EXECUTION_TOOLKIT.md](CORE_EXECUTION_TOOLKIT.md)|Supporting coordination plan|You need the mandatory minimum operating contract (main plan, main rules, anti-loop, and root-cause flow) for single-operator plus AI-agent execution|
|[../docs/START_HERE_CONTEXT_RECOVERY.md](../docs/START_HERE_CONTEXT_RECOVERY.md)|Session recovery anchor|You just switched profile, branch, worktree, or machine and need deterministic restart context|
|[2026-04-25-main-landing-consolidated-plan.md](2026-04-25-main-landing-consolidated-plan.md)|Supporting coordination plan|You need branch, PR, overlap, merge-status, or landing blocker context|
|[action-tracking-plan.md](action-tracking-plan.md)|Supporting cross-cutting plan|You are working on audit logging, action references, or traceability coverage|
|[process-customer-handoff-1.md](process-customer-handoff-1.md)|Supporting handoff plan|You are preparing customer delivery evidence, runbook steps, or release gates|
|[process-anti-loop-execution-1.md](process-anti-loop-execution-1.md)|Supporting coordination plan|You want to prevent context drift, repeated rework, and full re-test loops by enforcing packet boundaries and mandatory execution gates|
|[process-build-first-anti-loop-gates-1.md](process-build-first-anti-loop-gates-1.md)|Supporting coordination plan|You need the build-first gate ladder, release-freeze rule, feature-lane boundaries, or multi-agent ownership rules|
|[process-feature-completeness-recovery-1.md](process-feature-completeness-recovery-1.md)|Supporting coordination plan|You need the current post-runbook feature gap matrix for documents, R2/media, prompt operations, admin table UX, Customer 360, audit identity, or staff roles|
|[process-docs-and-worktree-repair-1.md](process-docs-and-worktree-repair-1.md)|Supporting coordination plan|You need to repair compressed markdown and create a docs-only checkpoint before starting feature implementation|
|[feature-liff-media-r2-1.md](feature-liff-media-r2-1.md)|Scoped feature plan|You are executing the frequent media upload/display and LIFF form hardening track|
|[2026-04-26-local-supabase-cli-bump-follow-up.md](2026-04-26-local-supabase-cli-bump-follow-up.md)|Follow-up-only tooling plan|The delivery branch is stable and you are ready to evaluate the deferred Supabase CLI bump|
|[2026-04-27-supabase-migration-history-repair-plan.md](2026-04-27-supabase-migration-history-repair-plan.md)|Follow-up-only plan|You need the validated next step for Supabase migration history drift without replaying production schema changes|
|[process-ai-preview-split-drafts-1.md](process-ai-preview-split-drafts-1.md)|Supporting coordination plan|You need the AI preview follow-up work split into independent draft packets with enough context for separate execution|
|[feature-liff-ai-prompt-inputs-1.md](feature-liff-ai-prompt-inputs-1.md)|Scoped feature plan|You are implementing customer-facing `designBrief` capture and advanced `aiImagePrompt` payload support in the LIFF intake flow|
|[feature-admin-ai-prompt-source-visibility-1.md](feature-admin-ai-prompt-source-visibility-1.md)|Scoped feature plan|You are exposing raw AI prompt source fields separately in Customer 360 or another admin detail surface|
|[feature-commercial-documents-1.md](feature-commercial-documents-1.md)|Scoped feature plan|You are implementing the policy-backed quotation, billing note, invoice, receipt, tax-ready, or tax-invoice document flow|
|[feature-liff-observability-monitor-1.md](feature-liff-observability-monitor-1.md)|Scoped feature plan|You are isolating LIFF incident logging, server-side LIFF error capture, and the `/admin/liff-monitor` surface as one coherent packet|
|[feature-payment-record-and-accounting-export-1.md](feature-payment-record-and-accounting-export-1.md)|Scoped feature plan|You are implementing manual payment records and a monthly accounting export without changing the workflow contract|
|[worktree-quarantine-2026-04-30.md](worktree-quarantine-2026-04-30.md)|Supporting coordination plan|You need the current quarantine list for files that must stay out of the active feature slice|
|[INCIDENT_ANALYSIS_TEMPLATE.md](INCIDENT_ANALYSIS_TEMPLATE.md)|Supporting coordination plan|You need a deterministic incident analysis and fix record template before patching|
|[2026-04-20-flow-and-api-brainstorm-note.md](2026-04-20-flow-and-api-brainstorm-note.md)|Research note|You need historical findings, earlier runtime concerns, or pre-merge investigation context|
|[solution architecture Gimine.md](solution%20architecture%20Gimine.md)|Idea checklist / architecture note|You are discussing AI-driven design pipeline scope and need architecture prompts rather than execution order|

## Maintenance Rule

When a new plan is added to this folder, give it one explicit role from the start:

- primary execution plan
- supporting coordination plan
- supporting domain plan
- scoped feature plan
- follow-up-only plan
- research note

That role should also be written near the top of the file so it is obvious when opened directly.
