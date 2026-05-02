---
goal: Map the missing FOGUS post-runbook feature gaps into one governed recovery path without mixing implementation packets
version: 1.0
date_created: 2026-05-02
last_updated: 2026-05-02
owner: Delivery Engineering
status: Active
role: supporting coordination plan
tags: [process, feature-completeness, recovery, admin, documents, audit]
---

# Feature Completeness Recovery

![Status: Active](https://img.shields.io/badge/status-Active-brightgreen)

This packet records the current product-completeness gap after the live runbook work and turns the latest operator feedback into a controlled execution path. It exists because the current worktree is unstable and the requested scope spans commercial documents, media storage, AI prompt operations, admin UX, customer profile, audit identity, and role/auth behavior.

Do not implement broad feature work from this file directly. Use it to select exactly one scoped packet, then execute that packet under `plan/process-anti-loop-execution-1.md`.

## Packet Contract

Goal
- Create one source of truth for the missing feature coverage so later work can finish without repeatedly renegotiating scope.

In Scope
- Classify the current repo/tool/env/git baseline.
- Map each missing area to current implementation status, source files, and the next packet.
- Define the safe execution order and acceptance evidence for each packet.

Out of Scope
- No schema migration, runtime route, UI, or workflow-state implementation in this coordination packet.
- No broad cleanup of existing dirty files in this packet.
- No invoice, tax invoice, or e-Tax compliance claim until schema and numbering rules exist.

Definition of Done
- Every user-raised gap is represented in the matrix below.
- Each gap has a packet boundary, impacted files, validation, and stop rule.
- `plan/README.md` links this coordination packet.

Owner
- Delivery Engineering owns execution sequencing.
- Product/operator owns legal/commercial wording and final role names.

## Baseline Checked On 2026-05-02

Git
- Branch: `main`.
- HEAD: `f549c4d` (`origin/main`) / `Merge pull request #27 from akkpol/fix/ci-node24-tailwind-cleanup`.
- Remote: `https://github.com/akkpol/craft-run-app.git`.
- Worktree: unstable. Current changes span runbook docs, process plans, `src/app/api/settings/route.ts`, test import/config residue, and an untracked runbook plan.

Tools
- Node: `v24.15.0`.
- npm: `11.12.1`.
- ripgrep: `15.1.0`.
- Vercel CLI: `53.1.0`.
- GitHub CLI: `2.90.0`.
- Supabase CLI: global command missing; `npx supabase --version` works and reports `2.95.6`.

Environment
- Local `.env.local` is incomplete for full local production-like development.
- Backup env source has more keys but is still missing R2/cron/customer upload values.
- Vercel production is linked to project `craft-run` and contains core Supabase, LINE, LIFF, R2, and admin values.
- Vercel production is missing `CRON_SECRET`, `NEXT_PUBLIC_CUSTOMER_UPLOAD_LABEL`, and `NEXT_PUBLIC_CUSTOMER_UPLOAD_URL` relative to `.env.example`.

Local State Decision
- Do not start code work until one implementation packet is selected.
- First safe move is documentation/packet alignment, because the existing markdown plan/runbook files are compressed and can mislead future execution.

## Product Completeness Matrix

| Gap | Current Status | Existing Evidence | Next Packet | Primary Files | Acceptance Evidence | Stop Rule |
|---|---|---|---|---|---|---|
| Missing document coverage: quotation vs billing note, invoice, receipt, tax invoice | Partial. Quote download exists; requested document type is captured; invoice/billing/tax invoice runtime issuance is not implemented. | `src/app/quote/[token]/download/page.tsx`, `src/lib/types.ts`, `docs/INVOICE_FLOW_PATCH.md`, `plan/feature-payment-record-and-accounting-export-1.md` | `feature-commercial-documents-1` | `supabase/migrations/*`, `src/lib/types.ts`, `src/lib/quote-workflow.ts`, `src/app/quote/[token]/download/page.tsx`, new invoice/billing routes | Runtime can issue/download quote and invoice/billing documents from quote data; tax invoice is clearly labeled tax-ready unless legal fields/numbering are implemented. | Stop if product cannot decide numbering, seller tax identity, branch rules, or payment-to-receipt behavior. |
| R2 / one image / media path | Planned, not complete. Supabase metadata exists; R2 env exists in production; final customer-facing R2 delivery path is not proven. | `plan/feature-liff-media-r2-1.md`, `plan/process-drive-to-r2-rollout-1.md`, `supabase/migrations/014_customer_media_assets.sql`, `src/lib/customer-media*`, production R2 env present | `feature-r2-media-delivery-1` | `src/lib/customer-media.ts`, `src/lib/customer-media-storage.ts`, `src/lib/production-media.ts`, `src/app/api/*media*`, `src/app/liff/intake/*` | One customer upload and one production proof image can be stored, previewed, and safely opened through signed/server-controlled access. | Stop if direct browser-to-R2 upload is required in v1 or if R2 secret exposure would be needed. |
| Prompt management system | Partial. Prompt fields are captured and visible; operational prompt management is not first-class. | `plan/feature-liff-ai-prompt-inputs-1.md`, `plan/feature-admin-ai-prompt-source-visibility-1.md`, `src/app/admin/lead-prompt-actions.tsx`, `src/app/admin/lead-ai-preview-actions.tsx` | `feature-ai-prompt-operations-1` | `src/app/admin/lead-prompt-actions.tsx`, `src/app/admin/customers/[id]/customer-360-client.tsx`, `src/lib/ai-images.ts`, `src/app/api/leads/[id]/prompt/route.ts` | Staff can see source prompt, edit prepared prompt, copy/local handoff command, and trace who changed prompt without changing provider architecture. | Stop if implementation would replace deployed OpenAI/server provider with local `gpt-image-2`; local workflow must remain handoff-only unless explicitly requested. |
| Admin table should be one-line rows with detail modal/page | Partial. Dashboard table exists but rows are card-like and dense; desktop scan mode is overloaded. | `src/app/admin/admin-dashboard-sections.tsx` / `OverviewCombinedQueueTable`, `AdminOperationalTable` | `feature-admin-table-detail-mode-1` | `src/app/admin/admin-dashboard-sections.tsx`, possible detail modal component or row detail page | Desktop shows compact one-line rows with essential columns; detail opens in a modal or dedicated page; mobile shows a reduced subset without losing primary action path. | Stop if adding modal/page requires mixing customer profile, role model, and commercial document implementation in the same pass. |
| Customer profile page | Exists but needs to become the main detail surface and reduce table overload elsewhere. | `src/app/admin/customers/[id]/page.tsx`, `src/app/admin/customers/[id]/customer-360-client.tsx` | `feature-customer-profile-ops-1` | Customer 360 page/client, admin overview links, `/api/admin/customers/[id]/route.ts` | Staff can open a customer profile from operational surfaces and see identity, leads, quotes, payments, documents, prompts, media, and action history in one place. | Stop if profile depends on a missing staff role/audit migration; execute identity packet first. |
| Who did what, linked to real user | Partial. `action_log` exists; several routes still log static `Admin` or `admin-dashboard`. | `supabase/migrations/010_action_log.sql`, `src/lib/action-log.ts`, grep results across admin routes | `feature-real-actor-audit-1` | `src/lib/action-log.ts`, new admin actor helper, admin API routes calling `logHumanAction`, tests | Every admin state-changing route records real Supabase Auth user id/email/display label when available, with system/factory/customer actors clearly separated. | Stop if a route has no authenticated context; log it as system/factory with explicit reason rather than fabricating a human actor. |
| Separate admin / owner / production roles and login certainty | Not first-class. Current access is allowlisted admin email only; ownership fields are free text. | `src/lib/admin-access.ts`, `src/app/admin/profile/page.tsx`, `supabase/migrations/001_initial.sql`, `006_workflow_state_model.sql` | `feature-staff-roles-ownership-1` | New migration for staff roles/assignments, `src/lib/admin-access.ts`, admin profile/nav, backoffice snapshot/studio view | Roles are explicit for owner/admin/production; job ownership is assigned to real staff records; login remains fail-closed. | Stop if role names/permissions are not approved; keep existing allowlist as fallback gate. |

## Recommended Execution Order

1. `process-docs-and-worktree-repair-1`
   - Repair compressed markdown in existing runbook/plan files without changing product behavior.
   - Register new packets in `plan/README.md`.
   - Separate runbook evidence changes from test/config residue.

2. `feature-real-actor-audit-1`
   - Add a shared authenticated-admin actor helper.
   - Replace static admin audit calls route-by-route.
   - Keep current allowlist auth behavior intact.

3. `feature-staff-roles-ownership-1`
   - Add first-class staff roles and job ownership only after real actor audit is reliable.
   - Map owner/admin/production semantics without inventing workflow states.

4. `feature-admin-table-detail-mode-1`
   - Convert admin dashboard to compact desktop rows.
   - Move details into modal/page, preferably linking to Customer 360 for durable detail.

5. `feature-customer-profile-ops-1`
   - Strengthen Customer 360 as the detail surface for customer, documents, prompts, media, payments, and action history.

6. `feature-commercial-documents-1`
   - Implement invoice/billing document flow from `docs/INVOICE_FLOW_PATCH.md` and the document-design skill guardrails.
   - Keep tax invoice as tax-ready until legal requirements are complete.

7. `feature-r2-media-delivery-1`
   - Deliver the safe R2 media path using Supabase metadata as canonical registry.

8. `feature-ai-prompt-operations-1`
   - Promote prompt handling to a controlled staff operation surface without replacing deployed provider architecture.

## Discovery Gate For The Next Implementation Packet

Known Facts
- The current worktree is unstable and spans multiple surfaces.
- The latest user request spans at least seven domains, not one feature.
- Workflow states must remain controlled by `docs/workflow-policy.json`.
- Current auth is fail-closed by allowlist but roles are not first-class.
- Current audit logging exists but does not consistently use real admin identity.

Unknowns
- Final legal document names and numbering policy for invoice, billing note, receipt, and tax invoice.
- Exact role names and permission split for owner/admin/production.
- Whether dashboard row detail should be modal-first, page-first, or profile-link-first.
- Whether R2 upload is staff-only first or customer upload first.

Assumptions
- Desktop backoffice scan speed is higher priority than mobile completeness for admin tables.
- Mobile admin can show reduced queue fields and link to detail.
- Tax invoice should not be claimed legally compliant until seller tax identity, branch, numbering, receipt, and VAT fields are complete.
- Local `gpt-image-2` remains a Studio/local design-assist path, not a runtime provider.

Out of Scope
- No workflow state invention.
- No broad refactor while docs and worktree are unstable.
- No production secret exposure in local diagnostics.

Decision Owner
- Delivery Engineering chooses packet sequencing.
- Product/operator decides legal/commercial document policy and role names before schema work.

## Validation Strategy

Documentation Packet
- Read changed markdown files after repair.
- Confirm `plan/README.md` links this file and any new scoped packet files.
- No app tests required for docs-only edits.

UI Packets
- Run focused TypeScript/lint validation for touched files.
- Use browser/manual verification for desktop and mobile breakpoints when changing admin surfaces.

Route/Audit Packets
- Add or update focused route/helper tests.
- Run `npm test` for audit/auth helper changes if route coverage is touched.
- Sample `action_log` payloads after any real-user audit change.

Schema Packets
- Use Supabase migration discipline.
- Do not replay production drift blindly.
- Validate with local or branch database before deployment.

## Current Done / Remaining / Risks

Done
- Tool, env, local, and git baseline checked.
- Each reported gap is mapped to an implementation packet and acceptance evidence.
- First execution action selected: docs/worktree repair before feature coding.
- This coordination packet is registered in `plan/README.md`.

Remaining
- Create the first scoped repair packet if continuing implementation immediately.
- Repair compressed markdown so future gates are readable.

Risks
- Current dirty files can cause accidental mixed commits if implementation starts now.
- Legal/commercial document work can overclaim tax-invoice readiness unless explicitly constrained.
- Audit and role work must preserve current fail-closed admin access while adding richer semantics.

## Related Specifications / Further Reading

- `plan/process-go-live-waves-1.md`
- `plan/process-anti-loop-execution-1.md`
- `plan/action-tracking-plan.md`
- `plan/feature-liff-media-r2-1.md`
- `plan/process-drive-to-r2-rollout-1.md`
- `plan/feature-payment-record-and-accounting-export-1.md`
- `docs/INVOICE_FLOW_PATCH.md`
- `docs/START_HERE_CONTEXT_RECOVERY.md`
