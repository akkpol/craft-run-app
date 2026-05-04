---
goal: Customer Handoff Plan for FOGUS ERP Production Delivery
version: 1.0
date_created: 2026-04-18
last_updated: 2026-04-26
owner: Delivery Engineering
status: In progress
tags: [process, release, handoff, deployment, verification]
---

# Introduction

![Status: In progress](https://img.shields.io/badge/status-In%20progress-yellow)

This plan defines a deterministic production handoff process for delivering the FOGUS application to a customer with verifiable quality gates, environment correctness, and operational readiness.

## Role In Plan Stack

This file is a supporting handoff and release-readiness plan, not the primary execution plan.

Use it when the work is about release evidence, go/no-go verification, deployment readiness, or customer handoff procedure.

For day-to-day implementation order and current backlog sequencing, use [process-go-live-waves-1.md](process-go-live-waves-1.md) first.

## 1. Requirements & Constraints

- **REQ-001**: Delivery must preserve the canonical workflow policy in `docs/workflow-policy.json` and runtime behavior in `src/lib/workflow-policy-core.mjs`.
- **REQ-002**: Deployment target is Vercel with Supabase as the system-of-record database.
- **REQ-003**: LINE Messaging API and LIFF setup must be configured with correct endpoint separation (`/api/webhook` vs `/liff`).
- **REQ-004**: Build, lint, and workflow smoke checks must complete successfully before customer handoff.
- **SEC-001**: `SUPABASE_SECRET_KEY`, `LINE_CHANNEL_SECRET`, and `LINE_CHANNEL_ACCESS_TOKEN` must remain server-side only.
- **SEC-002**: No production secrets may be committed into repository files.
- **OPS-001**: Customer-facing flows (LINE message to LIFF to intake to quote to approval to production) must pass end-to-end checks.
- **CON-001**: Locked stack versions and contracts in repository docs must be respected (Next.js 16.2.x, React 19, Supabase, LINE, LIFF).
- **CON-002**: Quote approval must follow payment gate rules; job creation is conditional and not always immediate.
- **GUD-001**: Workflow transitions must not be changed outside policy-aligned files and associated derivative updates.
- **PAT-001**: Use explicit Go/No-Go gates after each implementation phase and capture evidence in release notes.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: Verify codebase release readiness and baseline quality.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Run lint check using `npm run lint` and record warnings/errors. | ✅ | 2026-04-18 |
| TASK-002 | Run workflow smoke check using `npm run check:workflow-policy`. | ✅ | 2026-04-18 |
| TASK-003 | Run production build using `npm run build` on clean generated artifacts (`.next` removed first). | ✅ | 2026-04-18 |
| TASK-004 | Record known non-blocking warnings and map to post-handoff backlog. | ✅ | 2026-04-18 |

### Implementation Phase 2

- GOAL-002: Prepare customer environment and integration configuration.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-005 | Provision customer Supabase project and apply SQL migrations under `supabase/migrations/`. |  |  |
| TASK-006 | Configure Vercel environment variables from `.env.example` and `docs/ENV_AND_LINE_SETUP.md`. |  |  |
| TASK-007 | Configure LINE Messaging API webhook URL to `<base-url>/api/webhook`. |  |  |
| TASK-008 | Configure LIFF endpoint URL to `<base-url>/liff` and verify LIFF ID mapping. |  |  |
| TASK-009 | Verify admin runtime settings path `/admin/settings` updates base URL and LINE/LIFF settings correctly. |  |  |
| TASK-010 | Verify company runtime settings auto-derive `webhookUrl` and `liffEndpointUrl` from `base_url`, and confirm which configuration values are manually entered versus computed. |  |  |

### Implementation Phase 3

- GOAL-003: Execute customer-journey acceptance tests with evidence.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-011 | Validate webhook signature behavior (valid request returns success, invalid signature returns unauthorized). |  |  |
| TASK-012 | Validate LINE chat to LIFF flow and intake submission creates lead + quote records. |  |  |
| TASK-013 | Validate quote approval outcomes for `credit`, `deposit`, and `prepaid` payment terms. |  |  |
| TASK-014 | Validate downloadable quote PDF flow and confirm company branding appears correctly on the printable document. |  |  |
| TASK-015 | Validate status timeline updates and customer status page rendering. |  |  |
| TASK-016 | Validate admin status updates trigger expected LINE push notifications. |  |  |
| TASK-017 | Validate escalation keyword flow creates escalation records and routing behavior. |  |  |

### Implementation Phase 4

- GOAL-004: Final handoff packaging and operational transfer.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-018 | Prepare handoff dossier: deployed URL, admin URL, required env key list, rotation instructions, and document/PDF access notes, including the commercial document policy boundary. |  |  |
| TASK-019 | Deliver customer operations runbook (incident triage, restart/redeploy, key rotation, rollback trigger). |  |  |
| TASK-020 | Record release evidence: command outputs, screenshots, quote PDF output, and test outcomes mapped to requirements IDs. |  |  |
| TASK-021 | Conduct Go/No-Go review using section 7 risks and assumptions. |  |  |
| TASK-022 | Obtain customer acceptance sign-off, record whether commercial documents are deferred or required before GO, and schedule hypercare window (48-72 hours). |  |  |

#### Handoff Package Skeleton

Use this skeleton as the fill-in structure for TASK-018 through TASK-022.

| Section | Required Fields | Status |
|---|---|---|
| Release Identity | deployed URL, admin URL, active branch, landing commit or tag, handoff date | Pending |
| Ownership Map | Vercel owner, Supabase owner, LINE console owner, LIFF owner, primary technical contact | Pending |
| Environment Ownership | env key owner, where each secret is stored, rotation owner, last rotation note | Pending |
| Access Rules | approved admin/staff emails, sign-in path, escalation contact if access fails | Pending |
| Evidence Bundle | build result, lint result, workflow smoke result, manual UAT notes, quote PDF sample, screenshots | Pending |
| Commercial Document Boundary | policy source, quote-PDF limitation, deferred implementation packet, defer-or-block decision | Pending |
| Runtime Configuration | base URL, derived webhook URL, derived LIFF endpoint URL, company settings owner | Pending |
| Rollback Trigger | exact conditions that trigger rollback, rollback owner, fastest rollback step | Pending |
| Hypercare Window | start time, end time, primary responder, backup responder, support channel | Pending |
| Acceptance Record | decision owner, sign-off date, open issues accepted into backlog, next review checkpoint | Pending |

#### Current Pre-Filled Snapshot (2026-04-26)

| Field | Current Known Value |
|---|---|
| Repository | `akkpol/craft-run-app` |
| Active branch | `fix/quote-payment-instructions` |
| Default branch | `main` |
| Local build signal | `npm run build` exited with code `0` |
| Local lint signal | `npm run lint` exited with code `0` |
| Local workflow signal | `node scripts/workflow-policy-smoke.mjs` exited with code `0` |
| Still missing before handoff package is complete | deployed URL, admin URL, env ownership map, console ownership map, rollback owner, decision-owner sign-off |

#### Handoff Evidence Intake Checklist

- Build and lint results must be attached as summaries, not just marked verbally complete.
- Workflow smoke evidence must reference the exact command and date run.
- At least one printable quote sample should be attached or linked for the handoff dossier, and it must be labeled as quotation-only evidence.
- Manual LINE and LIFF checks should record who executed them and against which environment.
- Open known issues must be explicitly moved into backlog instead of staying implied.
- Commercial documents must be recorded as either `Deferred after launch` or `Required before GO` using [../docs/COMMERCIAL_DOCUMENT_POLICY_V1.md](../docs/COMMERCIAL_DOCUMENT_POLICY_V1.md).

### Implementation Phase 5

- GOAL-005: Define the finance-ready extension after the initial customer handoff path is stable.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-023 | Design commercial document flow using `docs/COMMERCIAL_DOCUMENT_POLICY_V1.md` and `plan/feature-commercial-documents-1.md`, without silently changing the canonical runtime workflow first. |  |  |
| TASK-024 | Define accounting export requirements, table structure, and period-end export format so records can be handed to an outsourced accountant. |  |  |
| TASK-025 | Decide whether finance-ready handoff is a hard pre-launch requirement or a controlled post-launch phase for this customer. |  |  |

## 3. Alternatives

- **ALT-001**: Skip workflow smoke verification to reduce time. Rejected because this repo treats workflow policy as canonical and requires enforcement checks.
- **ALT-002**: Perform handoff before full LINE/LIFF E2E test completion. Rejected because integration misconfiguration is the highest-likelihood production failure mode.
- **ALT-003**: Treat build failure caused by generated artifacts as source defect immediately. Rejected because clean build validated source integrity.
- **ALT-004**: Assume invoice, receipt, tax invoice, and accountant export already exist because quote PDF exists. Rejected because quote PDF is implemented as quotation-only evidence, while commercial documents and accountant export remain separate requirements.

## 4. Dependencies

- **DEP-001**: Vercel project access with permission to set production environment variables.
- **DEP-002**: Supabase project owner access for migrations and API keys.
- **DEP-003**: LINE Developers Console access for Messaging API and LIFF app setup.
- **DEP-004**: Customer decision owner availability for UAT sign-off.
- **DEP-005**: Stable public base URL for webhook and LIFF endpoint registration.
- **DEP-006**: Finance stakeholder decision on whether commercial documents and accountant export are launch blockers or post-launch additions.
- **DEP-007**: `docs/COMMERCIAL_DOCUMENT_POLICY_V1.md` for the commercial document policy and defer-or-block sign-off boundary.

## 5. Files

- **FILE-001**: `README.md` - deployment flow, smoke checklist, route summary.
- **FILE-002**: `docs/ENV_AND_LINE_SETUP.md` - environment variable ownership and endpoint mapping.
- **FILE-003**: `docs/VERCEL_SANDBOX.md` - isolated execution guidance for untrusted workloads.
- **FILE-004**: `docs/workflow-policy.json` - canonical workflow states and transitions.
- **FILE-005**: `AI_WORKFLOW_GUARD.md` - required policy enforcement process.
- **FILE-006**: `scripts/workflow-policy-smoke.mjs` - workflow consistency smoke test entry point.
- **FILE-007**: `package.json` - quality/build scripts and runtime metadata.
- **FILE-008**: `src/app/quote/[token]/download/page.tsx` - printable quote document.
- **FILE-009**: `docs/INVOICE_FLOW_PATCH.md` - invoice future-state design context.
- **FILE-010**: `docs/COMMERCIAL_DOCUMENT_POLICY_V1.md` - canonical policy for billing note, invoice, receipt, tax-ready, and tax-invoice behavior.
- **FILE-011**: `plan/feature-commercial-documents-1.md` - implementation packet for commercial documents.

## 6. Testing

- **TEST-001**: `npm run lint` must finish with zero errors (warnings are documented and accepted explicitly).
- **TEST-002**: `npm run check:workflow-policy` must report smoke checks passed.
- **TEST-003**: `npm run build` on clean `.next` must complete successfully.
- **TEST-004**: Webhook endpoint verification test for valid and invalid signature cases.
- **TEST-005**: LINE to LIFF to intake to quote creation end-to-end scenario.
- **TEST-006**: Quote approval and payment-gate matrix test across payment term combinations.
- **TEST-007**: Quote PDF renders correctly with company branding and totals.
- **TEST-008**: Admin job status change to LINE push notification delivery test.

## 7. Risks & Assumptions

- **RISK-001**: Environment variable mismatch between Vercel and customer LINE/Supabase settings can break webhook/LIFF flows.
- **RISK-002**: Customer may register LIFF endpoint incorrectly (`/liff/intake` instead of `/liff`).
- **RISK-003**: Stale local build artifacts may produce false-negative build outcomes during validation.
- **RISK-004**: Existing lint warnings from raw `<img>` usage can evolve into stricter policy failures if CI rules change.
- **RISK-005**: Finance requirements can expand significantly if commercial document policy, payment confirmation, and accountant export are combined without a separate decision gate.
- **RISK-006**: Quote PDF evidence can be misread as invoice/receipt/tax-invoice readiness. Mitigation: record the commercial document boundary in the handoff package and Go/No-Go sign-off.
- **ASSUMPTION-001**: Customer will provide full console access (Vercel, Supabase, LINE) before UAT window.
- **ASSUMPTION-002**: Production domain and TLS are available before final webhook/LIFF registration.
- **ASSUMPTION-003**: Workflow policy JSON remains unchanged during handoff window.

## 8. Related Specifications / Further Reading

- `AI_WORKFLOW_GUARD.md`
- `docs/workflow-policy.json`
- `docs/WORKFLOW_TRANSITION_TABLE.md`
- `docs/ENV_AND_LINE_SETUP.md`
- `docs/COMMERCIAL_DOCUMENT_POLICY_V1.md`
- `plan/feature-commercial-documents-1.md`
- `README.md`
