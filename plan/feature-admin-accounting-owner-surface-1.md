---
goal: Refactor the /admin/accounting page into an owner-aware finance surface without changing payment or export behavior
version: 1.0
date_created: 2026-05-05
owner: Delivery Engineering
status: Complete
role: scoped feature plan
tags: [admin, accounting, finance, owner-map, ux]
---

# Feature: Admin Accounting Owner Surface

## Packet Contract

Goal: turn `/admin/accounting` from a documents/export page into a finance operating surface that shows the live `payment-ops` and `commercial-gate` blockers, why they are blocked, and where the operator should go next.

In Scope:

- `/admin/accounting` page only.
- Reuse existing `fetchAdminOverviewPage()` and `buildAdminOverviewCardGroups()` logic for finance lanes.
- Preserve the existing monthly export and runtime-document behaviors.

Out of Scope:

- No workflow policy changes.
- No payment/commercial API changes.
- No `/admin/prompts` refactor in this packet.
- No deploy or production mutation.

Definition of Done:

- `/admin/accounting` exposes live `payment-ops` and `commercial-gate` lanes with owner-aware blocker cards.
- Existing export and issued-document controls still work.
- Narrow validation passes for the touched page.

Owner: Delivery Engineering.

## Discovery Gate

Known Facts:

- `fetchAdminOverviewPage(filter=payment-ops|commercial-gate)` already returns the blocker rows that finance needs.
- `buildAdminOverviewCardGroups()` already converts those rows into owner-aware cards with stop reasons, evidence, and next actions.
- `/admin/accounting` already owns monthly CSV export and runtime commercial document browsing.

Unknowns:

- Whether finance needs richer payment-record detail than the existing overview rows on the first pass. Decision: defer with fallback and use the existing overview card model first.

Assumptions:

- Reusing the overview card contract keeps finance wording aligned with `/admin` and is sufficient for the first packet.

Decision Owner:

- Delivery Engineering.

## Acceptance Evidence

- Run `npm run lint -- src/app/admin/accounting/page.tsx`.
- Check editor diagnostics for the touched page.
- Run `git diff --check` before closing.

## Closure Record

Packet: `feature-admin-accounting-owner-surface-1.md`
Date: 2026-05-05
Owner: Delivery Engineering

Done:

- Refactored `src/app/admin/accounting/page.tsx` so the page now shows live `payment-ops` and `commercial-gate` blocker lanes before the export/document tools.
- Reused `fetchAdminOverviewPage()` and `buildAdminOverviewCardGroups()` instead of duplicating finance blocker logic in the accounting page.
- Kept the monthly export form and issued-document listing in place so accounting operations still work from the same page.

Validated:

- `npm run lint -- src/app/admin/accounting/page.tsx` returned no lint errors.
- Editor diagnostics reported no errors for the touched page.
- `git diff --check` returned no output.

Remaining:

- `/admin/prompts` is deferred to the next packet and was not modified here.

Risks:

- Finance lane cards currently inherit the data richness of the overview row model; if operators need raw payment-record note/proof details inline, that requires a separate follow-up packet.

Tool/env changed:

- No.