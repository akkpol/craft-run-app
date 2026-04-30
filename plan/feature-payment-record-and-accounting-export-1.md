---
goal: Add manual payment records and monthly accounting export
version: 1.0
date_created: 2026-04-30
last_updated: 2026-04-30
owner: Delivery Engineering
status: Completed
tags: [feature, payment, accounting, export, backoffice]
---

# Introduction

![Status: Completed](https://img.shields.io/badge/status-Completed-brightgreen)

This packet adds the first explicit payment-record layer for FOGUS without changing the canonical quote approval workflow. The runtime remains manual-payment confirmation, but the system will stop relying on `quotes.payment_status` alone by storing a per-quote payment record that can also drive a monthly accounting export.

## Packet Contract

Goal

- Add a minimal manual payment-record flow and a monthly accounting export surface using the billing fields already captured during intake.

In Scope

- `supabase/migrations/*` for the new payment record table
- `src/lib/quote-workflow.ts`
- `src/app/api/quotes/[id]/commercial/route.ts`
- `src/app/api/quotes/[id]/approve/route.ts`
- `src/app/api/quotes/public/[token]/route.ts`
- `src/app/admin/admin-sidebar.tsx`
- `src/app/admin/accounting/page.tsx`
- `src/app/api/admin/accounting/monthly/route.ts`
- focused tests for payment-record behavior and export formatting

Out of Scope

- payment gateway integration
- invoice / receipt / tax-invoice runtime document issuance
- changing canonical workflow states or unlock rules
- automated accounting sync to third-party systems

Definition of Done

- A manual payment record exists for quotes that are approved but still payment-gated.
- Admin commercial updates keep the payment record aligned with quote payment status.
- Admin can download a monthly accounting CSV built from quote, lead, customer, and payment-record data.
- Focused validation is recorded for helper logic and export formatting.

## Discovery Gate

| Field | Required content |
|------|------------------|
| Known Facts | The repo already stores billing identity fields on `leads`, stores payment terms/status on `quotes`, and has no `payments` table or accounting export route. |
| Unknowns | Whether one quote should ever have multiple payment records in v1, and which export columns are mandatory for the monthly accountant handoff. |
| Assumptions | v1 uses one active manual payment record per quote and exports the current quote/payment/billing snapshot as a monthly CSV. |
| Out of Scope | Gateway callbacks, invoice numbering, receipt issuance, tax document generation, and ERP sync. |
| Decision Owner | Product owner for export column scope, Delivery Engineering for schema and route design. |

Unknown handling rule:

- `Multiple payment records per quote` -> defer with fallback: keep one active record per quote in v1.
- `Extended accountant columns` -> defer with fallback: export the verified billing/payment fields already stored in runtime tables.

## 1. Requirements & Constraints

- **REQ-001**: Do not change canonical quote approval states or payment unlock rules.
- **REQ-002**: Keep manual confirmation as the payment operating model for v1.
- **REQ-003**: Persist enough payment metadata to avoid relying only on `quotes.payment_status` for monthly accounting follow-up.
- **REQ-004**: Export monthly accounting data from runtime records without inventing invoice or receipt entities that do not exist yet.
- **CON-001**: `WAITING_PAYMENT` remains a workflow gate, not a new workflow branch.
- **CON-002**: Payment records must align with `quotes.payment_terms`, `quotes.payment_status`, and `quotes.payment_profile_snapshot`.
- **CON-003**: The export must remain admin-only.

## 2. Validation Plan

- **TEST-001**: Focused helper test for payment record initialization and status transitions.
- **TEST-002**: Focused helper test for monthly accounting CSV row generation.
- **TEST-003**: Editor/type validation for the touched route and page files.

## 3. Closure Record

- Changed files: `supabase/migrations/20260430034644_add_quote_payment_records.sql`, `src/lib/types.ts`, `src/lib/quote-payment-records.ts`, `src/lib/quote-workflow.ts`, `src/app/api/quotes/[id]/commercial/route.ts`, `src/app/api/quotes/public/[token]/route.ts`, `src/app/admin/admin-sidebar.tsx`, `src/app/admin/accounting/page.tsx`, `src/app/api/admin/accounting/monthly/route.ts`, `tests/quote-payment-records.test.ts`, `plan/README.md`
- Validation commands:
	- `node --test tests/quote-payment-records.test.ts`
	- `node scripts/workflow-policy-smoke.mjs`
	- editor/type diagnostics on touched route, page, helper, and test files
- Remaining risks:
	- migration still needs to be applied on the target Supabase environment before runtime writes to `quote_payment_records` will succeed
	- monthly export is CSV-only in this packet; invoice, receipt, tax-invoice issuance, and third-party accounting sync remain follow-up work

## Execution Update - 2026-04-30

- Added `quote_payment_records` as the first explicit manual payment-tracking table keyed one-to-one to quotes.
- Synchronized payment records from quote approval and admin commercial updates without changing workflow states or unlock rules.
- Added `/admin/accounting` and `/api/admin/accounting/monthly` for monthly CSV export using quote, payment, billing, and customer data already stored in runtime tables.
- Added focused helper tests for payment record mutation logic and CSV export formatting.
