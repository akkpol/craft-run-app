# Plan Index

This folder contains the active execution plan, supporting coordination plans, scoped feature plans, and research notes for the current FOGUS delivery work.

## Usage Order

1. Start with [process-go-live-waves-1.md](process-go-live-waves-1.md).
2. Use supporting plans only to deepen one area of work.
3. Use scoped feature or follow-up plans only when that task is explicitly being executed.
4. Treat notes and research files as context, not as the source of execution order.

If two documents appear to conflict on immediate next steps, follow [process-go-live-waves-1.md](process-go-live-waves-1.md) and reconcile the other file back to it.

## Plan Stack

| File | Role | Use when |
|------|------|----------|
| [process-go-live-waves-1.md](process-go-live-waves-1.md) | Primary execution plan | You need the current delivery order, go-live sequence, or next implementation wave |
| [2026-04-25-main-landing-consolidated-plan.md](2026-04-25-main-landing-consolidated-plan.md) | Supporting coordination plan | You need branch, PR, overlap, merge-status, or landing blocker context |
| [action-tracking-plan.md](action-tracking-plan.md) | Supporting cross-cutting plan | You are working on audit logging, action references, or traceability coverage |
| [process-customer-handoff-1.md](process-customer-handoff-1.md) | Supporting handoff plan | You are preparing customer delivery evidence, runbook steps, or release gates |
| [feature-liff-media-r2-1.md](feature-liff-media-r2-1.md) | Scoped feature plan | You are executing the frequent media upload/display and LIFF form hardening track |
| [2026-04-26-local-supabase-cli-bump-follow-up.md](2026-04-26-local-supabase-cli-bump-follow-up.md) | Follow-up-only tooling plan | The delivery branch is stable and you are ready to evaluate the deferred Supabase CLI bump |
| [2026-04-20-flow-and-api-brainstorm-note.md](2026-04-20-flow-and-api-brainstorm-note.md) | Research note | You need historical findings, earlier runtime concerns, or pre-merge investigation context |
| [solution architecture Gimine.md](solution%20architecture%20Gimine.md) | Idea checklist / architecture note | You are discussing AI-driven design pipeline scope and need architecture prompts rather than execution order |

## Maintenance Rule

When a new plan is added to this folder, give it one explicit role from the start:

- primary execution plan
- supporting coordination plan
- supporting domain plan
- scoped feature plan
- follow-up-only plan
- research note

That role should also be written near the top of the file so it is obvious when opened directly.