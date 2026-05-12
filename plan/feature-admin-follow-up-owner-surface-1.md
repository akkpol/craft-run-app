---
goal: Refactor the /admin/follow-up page into an owner-aware follow-up surface without changing the follow-up API behavior
version: 1.0
date_created: 2026-05-05
owner: Delivery Engineering
status: Complete
role: scoped feature plan
tags: [admin, follow-up, owner-map, automation, ux]
---

# Feature: Admin Follow-up Owner Surface

## Packet Contract

Goal: refactor `/admin/follow-up` so the recipient preview explains which owner lane each follow-up belongs to, why that conversation is still waiting, and who must act next before the operator confirms the send.

In Scope:

- `/admin/follow-up` page only.
- Preserve the existing `GET/POST /api/admin/follow-up` behavior.
- Replace the preview/result table-first presentation with queue-grouped cards that reuse owner and workflow contract language.

Out of Scope:

- No workflow state or transition changes.
- No API payload changes.
- No `/admin/accounting` or `/admin/prompts` refactor in this packet.
- No deploy or production mutation.

Definition of Done:

- Recipient preview is grouped by follow-up lane instead of a flat table.
- Each preview card shows queue ownership, automation mode, stop reason, and next action owner.
- Result feedback after sending is still visible without falling back to dense tables.
- Narrow validation passes for the touched admin surfaces.

Owner: Delivery Engineering.

## Discovery Gate

Known Facts:

- The page already has enough data from `GET /api/admin/follow-up` to render queue-grouped recipient cards.
- `src/lib/admin-queue-contract.ts` and `src/lib/workflow-owner-map.ts` already define the owner lane and automation semantics for `WAITING_QUOTE_APPROVAL` and `ON_HOLD_CUSTOMER_INPUT`.
- The current page behavior is UI-only; mutation still happens through the existing bulk send button.

Unknowns:

- Whether the preview needs richer recipient metadata than `lineUserId`, state, and last activity. Decision: keep the packet scoped to the existing payload and surface the contract explanation around it.

Assumptions:

- The current API route remains the right boundary for this packet.
- Queue-grouped cards are sufficient to align this page with the owner-aware admin model introduced on `/admin` overview.

Decision Owner:

- Delivery Engineering.

## Acceptance Evidence

- Run `npm run lint -- src/app/admin/follow-up/page.tsx src/app/admin/admin-dashboard-sections.tsx src/lib/admin-queue-view-model.ts tests/admin-queue-view-model.test.ts`.
- Check editor diagnostics for the touched admin files.
- Run `git diff --check` before closing the packet.

## Closure Record

Packet: `feature-admin-follow-up-owner-surface-1.md`
Date: 2026-05-05
Owner: Delivery Engineering

Done:

- Refactored `src/app/admin/follow-up/page.tsx` from a flat preview table into queue-grouped follow-up cards.
- Added owner lane, automation mode, next action owner, and stop-reason copy derived from the workflow owner contract for `WAITING_QUOTE_APPROVAL` and `ON_HOLD_CUSTOMER_INPUT`.
- Replaced the post-send result table with lightweight result cards so the page keeps the same operating model before and after dispatch.

Validated:

- `npm run lint -- src/app/admin/follow-up/page.tsx src/app/admin/admin-dashboard-sections.tsx src/lib/admin-queue-view-model.ts tests/admin-queue-view-model.test.ts` returned no lint errors.
- Editor diagnostics reported no errors for the touched follow-up, overview, helper, and focused test files.

Remaining:

- `/admin/accounting` and `/admin/prompts` still use their own page-specific layouts and remain separate follow-up packets.

Risks:

- Recipient cards still only know `lineUserId`, state, and last activity because the API payload does not include richer customer/job context.
- Bulk send remains a page-level action, so per-recipient retry controls are intentionally out of scope.

Tool/env changed:

- No.