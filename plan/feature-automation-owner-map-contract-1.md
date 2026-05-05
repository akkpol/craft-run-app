---
goal: Lock a workflow owner map and automation contract before refactoring admin action surfaces
version: 1.0
date_created: 2026-05-04
owner: Delivery Engineering
status: Complete
role: scoped feature plan
tags: [workflow, automation, owner-map, admin-ux]
---

# Feature: Automation Owner Map Contract

## Packet Contract

Goal: add a code-backed owner map for every canonical workflow state so later admin UI and automation work can answer who owns the state, where the action happens, and whether the system should auto-run, wait for the customer, stop for a human, or terminate.

In Scope:

- Add a runtime owner-map helper under `src/lib/`.
- Add focused tests proving every `WorkflowState` has one contract.
- Align queue references with the current admin queue contract.
- Keep this packet documentation-only plus helper/test; no route, database, or production behavior changes.

Out of Scope:

- No workflow state renames or transition changes.
- No admin dashboard table/card refactor yet.
- No settings tab refactor yet.
- No event queue, worker, or migration yet.
- No deploy or production data mutation.

Definition of Done:

- Every canonical workflow state has exactly one owner-map contract.
- Every non-terminal state declares a primary surface and current/target action ownership.
- Customer-waiting, human-gate, auto-run, and terminal classifications are test-covered.
- Focused test and workflow policy smoke pass.

Owner: Delivery Engineering.

## Discovery Gate

Known Facts:

- Canonical states live in `src/lib/workflow-state.ts` and `docs/workflow-policy.json`.
- Admin queue taxonomy exists in `src/lib/admin-queue-contract.ts`.
- Customer quote/status actions already route through `/quote/[token]` and `/status/[token]`.
- Admin actions currently exist across dashboard queues, accounting, prompts, follow-up, and job status routes.

Unknowns:

- Which future automation runner will execute events. Decision: defer with fallback to a pure contract helper first.
- Whether payment confirmation will become webhook-driven. Decision: defer; classify current `WAITING_PAYMENT` as human-gated.
- Whether AI generation should be fully automatic. Decision: defer; keep `IN_DESIGN` human-gated because prompt quality and visual QA remain subjective.

Assumptions:

- Auto-run means routine routing is system-owned by default; humans own approvals, exceptions, and subjective review.
- The owner map should not change state transitions; it should make current and target responsibility explicit.
- Tables are acceptable for reporting/audit, but primary action queues should later consume this owner contract.

Out of Scope:

- UI refactors, settings IA, database migrations, and production deploys.

Decision Owner:

- Product owner for automation policy expansion.
- Delivery Engineering for helper/test implementation.

## Acceptance Evidence

- Run `npm run test:node -- workflow-owner-map`.
- Run `npm run check:workflow-policy`.
- Run `npm run lint` if TypeScript or lint-sensitive files change.

## Closure Record

Packet: `feature-automation-owner-map-contract-1.md`
Date: 2026-05-04
Owner: Delivery Engineering

Done:

- Added `src/lib/workflow-owner-map.ts` with one owner/automation contract per canonical workflow state.
- Added `tests/workflow-owner-map.test.ts` covering state coverage, valid admin queue keys, customer-waiting ownership, human-gate stop reasons, terminal states, and critical owner/mode decisions.
- Registered this scoped feature plan in `plan/README.md`.

Validated:

- `npm run test:node -- workflow-owner-map` passed: 6/6 node tests.
- `npm run check:workflow-policy` passed.
- `npm run lint` returned no lint errors.
- `git diff --check` returned no whitespace errors.
- Editor diagnostics reported no errors for `src/lib/workflow-owner-map.ts` or `tests/workflow-owner-map.test.ts`.

Remaining:

- Next packet should consume the owner map in admin dashboard queues so action cards can explain owner, automation mode, and stop reason.
- Settings IA/tab split and product catalog route extraction remain out of scope for this packet.
- Event processor/idempotency work remains a future automation packet.

Risks:

- `WAITING_PAYMENT` remains classified as `human_gate` until payment confirmation becomes webhook/event-driven.
- `IN_DESIGN` remains `human_gate` because prompt quality and visual QA are still subjective.
- Existing untracked `docs/PRODUCTION_OWNER_REVIEW_2026-05-04.md` is unrelated QA note work and was not modified by this packet.

Tool/env changed:

- No.
