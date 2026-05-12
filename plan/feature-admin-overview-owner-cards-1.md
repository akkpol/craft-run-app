---
goal: Refactor the /admin overview inbox from a dense table into owner-aware queue cards without changing workflow behavior
version: 1.0
date_created: 2026-05-04
owner: Delivery Engineering
status: Complete
role: scoped feature plan
tags: [admin, queue, owner-map, automation, ux]
---

# Feature: Admin Overview Owner Cards

## Packet Contract

Goal: refactor the `/admin` overview queue so the primary inbox explains who owns the work, whether the system is auto-running or blocked, why the work stopped, and what action moves it next.

In Scope:

- `/admin` overview only.
- Add a view-model helper that merges `AdminOverviewRow` with queue and workflow owner contracts.
- Add focused tests for the helper.
- Refactor `OverviewCombinedQueueTable` to consume queue-card groups instead of the table-first row layout.

Out of Scope:

- No workflow state or transition changes.
- No separate admin pages such as `/admin/follow-up`, `/admin/accounting`, or `/admin/prompts`.
- No route handler changes.
- No deploy or production mutation.

Definition of Done:

- `/admin` overview no longer depends on a dense five-column table as its primary operating layout.
- Every card can show owner, automation mode, stop reason, primary action, and evidence summary.
- Filter chips and pagination still work.
- Focused tests and narrow validation pass.

Owner: Delivery Engineering.

## Discovery Gate

Known Facts:

- Dashboard data flow is `page.tsx -> fetchBackofficeSnapshot -> buildBackofficeAutomationSnapshot -> fetchAdminOverviewPage -> AdminDashboardClient -> OverviewCombinedQueueTable`.
- Queue labels and owner taxonomy already exist in `src/lib/admin-queue-contract.ts`.
- State ownership and automation mode already exist in `src/lib/workflow-owner-map.ts`.

Unknowns:

- Whether the first UI layout should group cards by queue or by owner lane. Decision: start with queue-grouped cards while keeping owner/mode visible on each card.

Assumptions:

- Existing `AdminOverviewRow` data is sufficient for the first queue-card pass.
- Existing action components remain the mutation surface; this packet changes explanation and layout.

Out of Scope:

- No expansion into other admin pages.

Decision Owner:

- Delivery Engineering for the first queue-card packet.

## Acceptance Evidence

- Run `npm run test:node -- admin-queue-view-model`.
- Run `npm run lint` after dashboard/helper edits.
- Run `npm run test:node -- workflow-owner-map` if owner-map assumptions are extended.

## Closure Record

Packet: `feature-admin-overview-owner-cards-1.md`
Date: 2026-05-04
Owner: Delivery Engineering

Done:

- Added `src/lib/admin-queue-view-model.ts` to merge `AdminOverviewRow` data with queue metadata and workflow owner/automation contracts.
- Added `tests/admin-queue-view-model.test.ts` covering payment gate, quote decision, customer-waiting, exception, running-job, and all-filter grouping behavior.
- Refactored `OverviewCombinedQueueTable` in `src/app/admin/admin-dashboard-sections.tsx` so `/admin` overview now renders owner-aware queue cards as the primary layout while preserving filter chips and pagination.
- Removed the hidden legacy overview table after the focused card path stabilized, and deleted the dead row/table helper code tied only to that fallback path.
- Added richer Thai context chips, localized stop-reason copy, and evidence signals to the overview cards so operators can see why a card is blocked without reopening the old table mental model.
- Registered this packet in `plan/README.md`.

Validated:

- `npm run test:node -- admin-queue-view-model` passed: 6/6 node tests.
- `npm run lint -- src/app/admin/admin-dashboard-sections.tsx src/lib/admin-queue-view-model.ts tests/admin-queue-view-model.test.ts` returned no lint errors.
- Editor diagnostics reported no errors for the touched dashboard, helper, and focused test files.

Remaining:

- Separate admin subpages remain unchanged by design in this packet.

Risks:

- `design-ops` and `commercial-gate` cards still depend on inferred workflow context rather than a dedicated queue-card contract field from the server layer.
- Existing untracked `docs/PRODUCTION_OWNER_REVIEW_2026-05-04.md` remains unrelated QA-note work and was not modified by this packet.

Tool/env changed:

- No.