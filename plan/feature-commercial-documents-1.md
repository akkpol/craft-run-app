---

## goal: Implement FOGUS commercial document flow from policy v1 without breaking quote/payment/workflow gates version: 1.0 date_created: 2026-05-02 last_updated: 2026-05-02 owner: Delivery Engineering status: In progress role: scoped feature plan tags: \[feature, commercial-documents, invoice, receipt, tax-ready, payment\]

# Commercial Documents

![Status: In Progress](https://img.shields.io/badge/status-In%20Progress-yellow)

This packet is the scoped implementation holder for FOGUS commercial documents. It must use [../docs/COMMERCIAL_DOCUMENT_POLICY_V1.md](../docs/COMMERCIAL_DOCUMENT_POLICY_V1.md) as the source-of-truth policy.

Do not implement this packet until the active launch gate is closed or explicitly paused, and do not mix it with R2, staff roles, admin table compaction, or AI provider work.

## Packet Contract

Goal

- Build commercial documents for quotation, billing note, invoice, receipt, and tax-ready/tax invoice behavior under the approved policy v1.

Core invariant

- `เงินเข้าใคร → เอกสารออกชื่อนั้น`
- Payment receiver entity must equal document issuer entity.
- Tax invoice can only be issued by a VAT-registered entity that is also the payment receiver.
- Issued documents are immutable; corrections require `VOID`, `CREDIT_NOTE`, or `DEBIT_NOTE` behavior.

In Scope

- Seller/payment receiver entity model.
- Customer tax profile model.
- Payment receiver selection and lock after confirmation.
- Commercial document model and document numbering by entity + document type + year.
- Billing note, invoice, receipt, tax-ready, tax invoice, and combined receipt/tax invoice validation.
- Locked snapshot JSON at issue time.
- PDF/HTML print surfaces based on locked snapshots.
- Audit events listed in the policy.
- Tests for receiver/entity mismatch, VAT restrictions, branch validation, numbering uniqueness, and issued-document immutability.

Out of Scope

- Replacing the existing quote approval/payment state machine without an explicit workflow-policy change.
- Claiming legal/e-Tax compliance beyond the approved policy and available data.
- Direct browser exposure of payment or tax secrets.
- R2 media delivery, staff role migration, or admin table UI refactor.

Definition of Done

- Policy v1 rules are represented in schema, service validation, UI copy, and tests.
- Documents cannot issue if payment receiver and issuer mismatch.
- Personal-account payments cannot create company tax invoices.
- Non-VAT entities cannot issue tax invoices.
- Issued documents use immutable snapshots and non-reused numbers.
- The customer-facing PDF/print document uses locked document data, not mutable live quote/customer records.

Owner

- Delivery Engineering implements.
- Business Owner / Akkapol owns policy confirmation and final commercial wording.
- Accounting/legal reviewer must approve any claim beyond `tax-ready`.

## Source Of Truth

SourceRole[../docs/COMMERCIAL_DOCUMENT_POLICY_V1.md](../docs/COMMERCIAL_DOCUMENT_POLICY_V1.md)Canonical commercial document policy v1[../docs/COMMERCIAL_DOCUMENT_DESIGN_REFERENCE.md](../docs/COMMERCIAL_DOCUMENT_DESIGN_REFERENCE.md)Visual/document design reference if present[../docs/INVOICE_FLOW_PATCH.md](../docs/INVOICE_FLOW_PATCH.md)Historical invoice-first patch context, not current authority[feature-payment-record-and-accounting-export-1.md](feature-payment-record-and-accounting-export-1.md)Existing payment/accounting export context[process-feature-completeness-recovery-1.md](process-feature-completeness-recovery-1.md)Execution ordering and gap matrix

## Discovery Gate

Known Facts

- Current quote/payment/job/status flow exists and is production-tested.
- Quote download exists but commercial document issuance is not implemented.
- Requested document and billing/tax fields are partially captured in intake/quote surfaces.
- Policy v1 defines vocabulary, receiver/issuer invariant, VAT rules, branch rules, numbering, payment-to-receipt behavior, schema minimums, API requirements, PDF requirements, audit events, and error codes.

Unknowns

- Whether first release issues all document types or starts with billing note + receipt while keeping tax invoice blocked until data is complete.
- Which seller entities and bank/payment channels are active for the first production rollout.

Decisions made in current slice (2026-05-02)

- `order_id` is implemented as `commercial_orders.id` with a one-to-one mapping to `quotes.id` for v1.
- `commercial_orders` is the policy anchor for receiver selection lock and customer tax profile lock.
- Existing quote/payment/job flow is unchanged; the migration is additive only.

Assumptions

- Existing workflow states remain canonical unless `docs/workflow-policy.json` is updated in the same change.
- HTML print is preferred for v1 runtime documents unless there is an explicit PDF generation requirement.
- Tax invoice remains blocked unless all policy checks pass.
- Accounting/legal claims are not made automatically by the app UI.

Out of Scope

- Any implementation that creates tax invoice documents from quote-only data without payment receiver lock.
- Any implementation that lets admin manually toggle VAT independent of seller entity registration.
- Any implementation that edits issued documents silently.

Decision Owner

- Business Owner / Akkapol for seller entities, document wording, receiver channels, and launch waiver decisions.
- Delivery Engineering for schema/API sequencing.

## Implementation Steps

### Phase 1 - Schema And Domain Contract

TaskDescriptionCompletedDateTASK-001Map policy v1 schema to existing FOGUS tables and decide whether `order_id` maps to quote, job, or a new commercial order record.Yes2026-05-02TASK-002Add migrations for seller entities, customer tax profiles, payments/receiver selection, commercial documents, and document number sequences.Partial (core schema added)2026-05-02TASK-003Add database constraints/indexes for document number uniqueness and issued-document immutability support.

### Phase 2 - Service Validation

TaskDescriptionCompletedDateTASK-004Implement receiver selection validation before payment.Partial (API route added)2026-05-02TASK-005Implement payment confirmation validation and receiver lock.TASK-006Implement document issue validation for receiver/issuer match, VAT registration, customer tax profile, branch data, and numbering.TASK-007Implement error codes from policy v1.

### Phase 3 - UI And Documents

TaskDescriptionCompletedDateTASK-008Add admin UI for receiver/entity selection and blocked tax-invoice warnings.Yes2026-05-02TASK-009Add LIFF/customer tax-document data validation aligned to policy v1.Yes2026-05-02TASK-010Add printable/downloadable commercial document surfaces using locked snapshots.

### Phase 4 - Audit And Tests

TaskDescriptionCompletedDateTASK-011Add audit events from policy v1 for receiver selection, payment confirmation, mismatch, document issue/void, numbering, VAT/branch failures, and tax invoice blocking.TASK-012Add tests for receiver mismatch, VAT restrictions, branch validation, document number uniqueness, and issued-document immutability.TASK-013Run focused tests, workflow policy smoke if workflow surfaces changed, then run build/lint before release.

## Stop Rules

Stop immediately if any proposed implementation:

- Issues a tax invoice when issuer is not VAT registered.
- Issues a company document for money received into a personal account.
- Lets payment receiver and document issuer differ.
- Reuses document numbers or edits issued documents silently.
- Claims legal tax invoice compliance without accounting/legal sign-off.
- Requires a workflow state shortcut outside `docs/workflow-policy.json`.

## Closure Record

Current slice (2026-05-02)

- Added additive core migration: `supabase/migrations/20260502113000_add_commercial_document_core.sql`
- Added tables: `commercial_entities`, `customer_tax_profiles`, `commercial_orders`, `payments`, `commercial_documents`, `document_number_sequences`
- Added receiver-selection API: `src/app/api/commercial/select-receiver/route.ts`
- Added admin receiver/entity selection UI and blocked tax-invoice warnings in quote action surfaces.
- Extended receiver selection to lazily create a `commercial_orders` anchor from `quoteId` when needed.
- Existing workflow/payment routes were intentionally left unchanged in this slice.
