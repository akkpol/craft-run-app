---
title: FOGUS Go / No-Go Review
version: 1.0
date: 2026-04-26
owner: Delivery Engineering
status: Gate open - all Phase 3 gates pass; remaining blockers are LIFF-VAL-006/007/008, commercial document decision, and final sign-off
plan_ref: plan/process-go-live-waves-1.md (TASK-024), plan/action-tracking-plan.md
---

# FOGUS — Go / No-Go Review

This document is the official gate for proceeding from pre-production validation to production launch.

A launch is **GO** only when ALL mandatory gates are cleared. Any single **NO** or **PENDING** in a mandatory gate is a **NO-GO**.

## Fastest Safe Execution Order

If the goal is to get through launch readiness with the least confusion, execute this file in exactly this order:

1. Confirm Phase 1 is still green and unchanged.
2. Complete Phase 2 gates from `P2-G01` through `P2-G07` in order.
3. Do not start Phase 3 until every Phase 2 gate is marked PASS.
4. Complete Phase 3 gates from `P3-G01` through `P3-G13` in order.
5. Confirm the Commercial Document Policy Guard below before sign-off.
6. If any gate fails, stop the run, record evidence, and resolve the failure before continuing.
7. Only after all gates PASS and required policy deferrals are recorded, fill the Sign-Off table and update the overall verdict to **GO**.

This document is the live run sheet. Do not split the same verification run across multiple plan files while executing.

Operator aids:

- Use [OPERATOR_LAUNCH_ONE_PAGE.md](OPERATOR_LAUNCH_ONE_PAGE.md) when you want a single-file operator handoff and a single reply format.
- Use [PHASE2_OPERATOR_GATE_CHECKLIST.md](PHASE2_OPERATOR_GATE_CHECKLIST.md) to close `P2-G03`, `P2-G05`, `P2-G06`, and `P2-G07`.
- Use [LIFF_LIVE_VALIDATION_RUNBOOK.md](LIFF_LIVE_VALIDATION_RUNBOOK.md) to execute live LIFF checks after Phase 2 passes.
- Use [OPERATOR_HANDOFF_MESSAGE_TH.md](OPERATOR_HANDOFF_MESSAGE_TH.md) when you need a copy-paste Thai handoff message for the operator.
- Use [OPERATOR_EVIDENCE_CAPTURE_CHECKLIST.md](OPERATOR_EVIDENCE_CAPTURE_CHECKLIST.md) when the operator needs exact screenshot/log capture points per gate.
- Use [COMMERCIAL_DOCUMENT_POLICY_V1.md](COMMERCIAL_DOCUMENT_POLICY_V1.md) before interpreting quote PDFs, payment unlocks, billing notes, invoices, receipts, tax-ready labels, or tax invoices.

## Plan Linkback

- Phase 2 and Phase 3 here are the live-environment execution layer for Wave 2, Wave 3, and TASK-024 in `plan/process-go-live-waves-1.md`.
- When a gate passes here, copy the final evidence outcome back into the related Wave task record after the run ends.
- If this document and a planning file disagree during live execution, trust this document for gate order and `plan/process-go-live-waves-1.md` for backlog priority afterward.

---

## Phase 1 — Code Quality Gates (Static, Local)

| Gate | Check | Result | Evidence | Date |
|---|---|---|---|---|
| P1-G01 | `npm run build` exits 0, no errors | ✅ **PASS** | Exit 0. Compiled in 60s. 22 static pages generated. | 2026-04-26 |
| P1-G02 | `npm run lint` has 0 ESLint errors | ✅ **PASS** | 0 errors. No Node MODULE_TYPELESS_PACKAGE_JSON advisory after adding `"type": "module"` to `package.json`. | 2026-04-30 |
| P1-G03 | `npm run check:workflow-policy` smoke passes | ✅ **PASS** | `workflow-policy smoke checks passed` | 2026-04-26 |
| P1-G04 | Auth middleware: unauthenticated user redirects to `/auth/login` | ✅ **PASS** | Code-confirmed in `src/middleware.ts`: session check redirects on missing session. | 2026-04-25 |
| P1-G05 | Auth middleware: non-allowlisted email is denied | ✅ **PASS** | Code-confirmed: `ADMIN_ALLOWED_EMAILS` check in auth flow, fail-closed if env is not set. | 2026-04-25 |
| P1-G06 | `action_log` schema exists in migrations | ✅ **PASS** | `supabase/migrations/010_action_log.sql` audited: immutable, realtime enabled, 5 indexes. | 2026-04-26 |
| P1-G07 | Workflow routes call `logAction` | ✅ **PASS** | 14 confirmed callers audited across all route handlers and action types. | 2026-04-26 |

**Phase 1 verdict: ✅ ALL PASS**

**Phase 1 re-verification 2026-05-14:** `npm run check:release` at HEAD `90c97d7` passed lint, TypeScript, scenario runner (19/19: `webhook-event-processor`, `fake-line-gateway`, `scenario-runner`), workflow-policy, and build. Phase 1 gates remain green. Scenario runner is the primary regression gate; real LINE device is required only for LIFF-VAL-006/007/008 final launch evidence.

---

## Phase 2 — Environment Configuration Gates (Requires Real Environment)

| Gate | Check | Result | Who verifies | Notes |
|---|---|---|---|---|
| P2-G01 | Supabase migrations applied successfully | ✅ **PASS** | Delivery Engineering | Supabase MCP confirmed migrations through `014_customer_media_assets` plus later repair migrations; `lead_media_assets` table, index, bucket, and RLS surface were checked on 2026-04-27. |
| P2-G02 | All 11 env vars set in Vercel | ✅ **PASS** | Delivery Engineering | 10 project env vars confirmed in Vercel production and `VERCEL_OIDC_TOKEN` remains platform-provided; `ADMIN_ALLOWED_EMAILS` was synced into production on 2026-04-27. |
| P2-G03 | Vercel deploy succeeds after env vars set | ✅ **PASS** | Delivery Engineering | `npx vercel inspect craft-run.vercel.app` on 2026-05-02 returned production deployment `dpl_E7ema3R6N8wo7YE9ASAVWHrHY2AY` with status `Ready` and alias `https://craft-run.vercel.app`. |
| P2-G04 | `NEXT_PUBLIC_BASE_URL` matches the live Vercel domain | ✅ **PASS** | Delivery Engineering | Vercel production alias is `https://craft-run.vercel.app`; `app_settings.base_url` and `NEXT_PUBLIC_BASE_URL` were both verified against that alias with no trailing slash on 2026-04-27. |
| P2-G05 | LINE Messaging API webhook URL registered and verified | ✅ **PASS** | Delivery Engineering | LINE Developers console channel `2009662109` showed `Webhook URL = https://craft-run.vercel.app/api/webhook`; clicking `Verify` returned `Success` on 2026-05-02. |
| P2-G06 | LINE MINI App LIFF endpoint registered | ✅ **PASS** | Delivery Engineering | LINE Developers console channel `2009686374` showed LIFF app `2009686374-ovPbzgXx` with `Endpoint URL = https://craft-run.vercel.app/liff` on 2026-05-02. |
| P2-G07 | Admin user created in Supabase Auth | ✅ **PASS** | Delivery Engineering | Supabase admin query confirmed the allowlisted admin user exists; production `/admin/profile` also showed `พบ allowlist แล้ว 2 บัญชี` and the allowlisted account signed in successfully on 2026-05-02. |

### Phase 2 Operator Run Sheet

Use this run sheet during live-environment setup. Do not flip any Phase 2 gate to PASS until the evidence column is captured without exposing secret values.

Stop rule: if `P2-G03`, `P2-G05`, or `P2-G06` fails, stop the run and fix deployment or LINE/LIFF wiring before entering Phase 3.

| Gate | Operator steps | Evidence to capture | Result | Verified by / Date |
|---|---|---|---|---|
| P2-G01 | Apply all migrations in order with `supabase db push` or the SQL editor, then confirm the newest migration is present without manual patching. | Supabase MCP migration list showed `001` through `014_customer_media_assets` plus later repair migrations; schema smoke also confirmed `lead_media_assets`, `idx_lead_media_assets_lead`, and `customer-media`. | ✅ | Delivery Engineering / 2026-04-27 |
| P2-G02 | Set all 11 Vercel env vars from `docs/CUSTOMER_HANDOFF_PACKAGE.md`, then double-check names and target environments only. | Vercel production env list confirmed the 10 project-managed variables; `VERCEL_OIDC_TOKEN` remains runtime-provided by Vercel and is not listed by `vercel env list`. | ✅ | Delivery Engineering / 2026-04-27 |
| P2-G03 | Trigger a fresh production deploy after env vars are saved and wait for Vercel to finish cleanly. | `npx vercel inspect craft-run.vercel.app` returned production deployment `dpl_E7ema3R6N8wo7YE9ASAVWHrHY2AY` with status `Ready` and alias `https://craft-run.vercel.app`. | ✅ | Delivery Engineering / 2026-05-02 |
| P2-G04 | Compare the deployed production URL against `NEXT_PUBLIC_BASE_URL` and confirm the value has no trailing slash. | Vercel inspect confirmed the production alias; Supabase `app_settings.base_url` and the re-pulled production `NEXT_PUBLIC_BASE_URL` both matched `https://craft-run.vercel.app`. | ✅ | Delivery Engineering / 2026-04-27 |
| P2-G05 | Register `<base-url>/api/webhook` in the LINE Messaging API console and run the Verify action. | LINE Developers console channel `2009662109` showed `Webhook URL = https://craft-run.vercel.app/api/webhook`; clicking `Verify` returned `Success`. | ✅ | Delivery Engineering / 2026-05-02 |
| P2-G06 | Register `<base-url>/liff` as the LIFF endpoint, confirm the LIFF ID, and verify `LIFF_ID` plus `NEXT_PUBLIC_LIFF_ID` match it. | LINE Developers console showed LIFF app `2009686374-ovPbzgXx` with `Endpoint URL = https://craft-run.vercel.app/liff` under channel `2009686374`. | ✅ | Delivery Engineering / 2026-05-02 |
| P2-G07 | Create or invite the admin user in Supabase Auth, add the same email to `ADMIN_ALLOWED_EMAILS`, and redeploy if the env changed. | Supabase admin query returned `{"adminUserExists":true}` for the allowlisted admin account, and production `/admin/profile` showed `พบ allowlist แล้ว 2 บัญชี` while the allowlisted admin account reached `/admin`. | ✅ | Delivery Engineering / 2026-05-02 |

### Preliminary External Route Signals

- 2026-04-27: `https://craft-run.vercel.app/liff` returned HTTP 200 from the live alias.
- 2026-04-27: `https://craft-run.vercel.app/api/webhook` returned HTTP 405 for GET, which is the expected public surface for a POST-only webhook route.
- These probes do not replace LINE console verification for `P2-G05` or LIFF console verification for `P2-G06`; they only confirm that the deployed routes are externally reachable.

---

## Phase 3 — End-to-End Behavioral Gates (Requires Live System)

Auth evidence update, 2026-05-02: local preflight already covered redirect, allowlisted login, non-allowlisted deny, and disabled sign-up. Production now also confirms redirect, allowlisted admin access, and non-allowlisted deny.

Current launch blockers on 2026-05-02: all Phase 3 gates are PASS. The remaining no-go items are LIFF live checks `LIFF-VAL-006`, `LIFF-VAL-007`, `LIFF-VAL-008`, the commercial document defer-or-block decision, plus final sign-off. Production desktop access to `/liff` currently stays at `กำลังเปิดฟอร์มใน LINE...`, and the non-LIFF bypass is intentionally disabled outside localhost/non-production, so those remaining LIFF checks still require real operator/device evidence.

| Gate | Check | Result | Who verifies |
|---|---|---|---|
| P3-G01 | Unauthenticated `/admin` redirects to `/auth/login` | ✅ **PASS** | Delivery Engineering |
| P3-G02 | Staff login with valid credentials grants `/admin` access | ✅ **PASS** | Delivery Engineering |
| P3-G03 | Login with non-allowlisted email is denied | ✅ **PASS** | Delivery Engineering |
| P3-G04 | LINE message -> webhook -> conversation created in DB | ✅ **PASS** | Delivery Engineering |
| P3-G05 | LIFF intake -> lead created -> quote generated | ✅ **PASS** | Delivery Engineering |
| P3-G06 | Quote approval transitions to `WAITING_PAYMENT` | ✅ **PASS** | Delivery Engineering |
| P3-G07 | Quote rejection transitions to `CANCELLED` | ✅ **PASS** | Delivery Engineering |
| P3-G08 | Quote PDF download at public token URL | ✅ **PASS** | Delivery Engineering |
| P3-G09 | Admin unlock/commercial terms unlock production | ✅ **PASS** | Delivery Engineering |
| P3-G10 | Job status progression through all workflow states | ✅ **PASS** | Delivery Engineering |
| P3-G11 | Escalation keyword transitions to `HUMAN_REVIEW_REQUIRED` | ✅ **PASS** | Delivery Engineering |
| P3-G12 | `/admin/settings` save writes `settings.updated` in `action_log` | ✅ **PASS** | Delivery Engineering |
| P3-G13 | All gate events have `action_ref` in `action_log` | ✅ **PASS** | Delivery Engineering |

### Phase 3 Operator Run Sheet

Run these checks in order against the real deployment so the evidence bundle mirrors the customer journey and the staff journey end to end.

| Gate | Run steps | Expected outcome | Evidence to capture | Result | Verified by / Date |
|---|---|---|---|---|---|
| P3-G01 | Open `/admin` in a logged-out browser session. | Browser redirects to `/auth/login`. | Browser opened `https://craft-run.vercel.app/admin` and landed on `https://craft-run.vercel.app/auth/login` in a logged-out session. | ✅ | Delivery Engineering / 2026-05-02 |
| P3-G02 | Sign in with a valid allowlisted staff account. | Staff lands on `/admin` without middleware rejection. | The allowlisted admin account reached `https://craft-run.vercel.app/admin` and the admin shell showed the signed-in account. | ✅ | Delivery Engineering / 2026-05-02 |
| P3-G03 | Try to sign in with a non-allowlisted account. | Access is denied or the admin surface stays blocked. | `g.sepiro@gmail.com` authenticated but the browser stayed on `/admin` login with the deny message `บัญชีนี้ล็อกอินได้ แต่ยังไม่ได้รับสิทธิ์เข้า /admin...`. | ✅ | Delivery Engineering / 2026-05-02 |
| P3-G04 | Send a normal LINE message to the OA and inspect the webhook effect. | Conversation row is created and the webhook path succeeds. | Signed production webhook simulation for fake LINE user `U19de78b9462000000000000000000000` returned `200 {"status":"ok"}` with a valid signature; Supabase showed conversation `d74a9ab6-5cab-42bc-9dae-02be9e8bf573` in `COLLECTING_REQUIREMENTS`, and an invalid-signature probe returned `401 {"error":"Invalid signature"}`. | ✅ | Delivery Engineering / 2026-05-02 |
| P3-G05 | Open the LIFF intake flow from the customer path and submit a representative job. | Lead and quote records are created and linked to the conversation. | Production `/liff` accepted a live submission on 2026-05-02 and showed `ส่งข้อมูลเรียบร้อยแล้ว!`; Supabase showed lead `40d22e0c-a27d-4adc-928e-794307156d60` with note marker `P3-20260502-0201 test intake via LIFF` plus quote `c60aa047-07f0-4b3f-af6e-d0ed89f13351` / token `a6172739bf27c88e78a886f91bb3f495`. | ✅ | Delivery Engineering / 2026-05-02 |
| P3-G06 | Approve a quote that should remain payment-blocked. | Conversation moves to `WAITING_PAYMENT`. | Public quote page `/quote/a6172739bf27c88e78a886f91bb3f495` changed to `รอยืนยันการชำระ`; Supabase showed quote `c60aa047-07f0-4b3f-af6e-d0ed89f13351` as `approved`, `payment_terms=prepaid`, `payment_status=unpaid`, and conversation `2b0a2019-dba0-4bc9-851b-97c9caf3dff7` in `WAITING_PAYMENT`. | ✅ | Delivery Engineering / 2026-05-02 |
| P3-G07 | Reject a quote from the public customer path. | Conversation moves to `CANCELLED`. | Public quote page `/quote/1c6600a1f450a764f52d6228d80f4aca` reloaded with badge `ปฏิเสธแล้ว`; the owning `reject_quote` route also updates conversation `3211a306-a0e7-499d-9e6c-a245ffac89ec` to `CANCELLED`, matching the live Supabase record on 2026-05-02. | ✅ | Delivery Engineering / 2026-05-02 |
| P3-G08 | Open the public quote token URL and download the PDF. | PDF renders and downloads with expected business branding. | Production `/quote/a6172739bf27c88e78a886f91bb3f495/download` rendered the quotation document with quote no. `QT-A6172739`, customer `Akkapol`, total `535.00`, and the `ดาวน์โหลด / พิมพ์ PDF` action visible on 2026-05-02. | ✅ | Delivery Engineering / 2026-05-02 |
| P3-G09 | Use the admin commercial flow to unlock production for a blocked quote. | Conversation advances into `IN_DESIGN` when the payment rule is satisfied. | Production route `/api/quotes/c60aa047-07f0-4b3f-af6e-d0ed89f13351/commercial` accepted `{"paymentStatus":"paid"}` and returned `jobCreated: true` with job `7b60d426-db36-4ac0-9788-01feaf4343ea`; Supabase showed the quote as `approved` + `paid`, conversation `2b0a2019-dba0-4bc9-851b-97c9caf3dff7` in `IN_DESIGN`, and the new job in `IN_DESIGN`. | ✅ | Delivery Engineering / 2026-05-02 |
| P3-G10 | Advance a job through remaining staff-controlled workflow states and check customer status after each major change. | Job progression is accepted and customer-facing status stays aligned. | Lead `40d22e0c-a27d-4adc-928e-794307156d60` moved through design prerequisites `preview_sent` then `approved`; job `7b60d426-db36-4ac0-9788-01feaf4343ea` advanced to `IN_PRODUCTION`, `READY_FOR_FULFILLMENT`, and `COMPLETED`; `/status/a6172739bf27c88e78a886f91bb3f495` showed `กำลังผลิต`, `พร้อมส่งมอบ`, and `เสร็จสมบูรณ์`; Supabase ended with `status=COMPLETED`, `production_status=done`, `fulfillment_status=delivered`, `completed_at=2026-05-02T07:12:49.858+00:00`. | ✅ | Delivery Engineering / 2026-05-02 |
| P3-G11 | Send a supported escalation keyword such as `admin` or `คุยกับแอดมิน`. | Conversation moves to `HUMAN_REVIEW_REQUIRED`. | Signed production webhook simulation sent `admin`; conversation `d74a9ab6-5cab-42bc-9dae-02be9e8bf573` moved to `HUMAN_REVIEW_REQUIRED` and Supabase created open escalation `6ccbf9c2-068e-4850-bc87-71eb555de894` with reason `Customer requested: "admin"`. | ✅ | Delivery Engineering / 2026-05-02 |
| P3-G12 | Change a runtime setting in `/admin/settings` and save it. | Save succeeds and `settings.updated` appears in `action_log`. | Production `/admin/settings` save by the allowlisted admin account created `settings.updated` row `ACT-20260502-0246` at `2026-05-02T07:05:07.814509+00:00` with payload `changed_fields=["business_name"]`, `app_settings_id="default"`, and `used_schema_fallback=true`; the temporary probe value was restored. | ✅ | Delivery Engineering / 2026-05-02 |
| P3-G13 | Review the `action_log` rows created by the gates above. | Every recorded gate event has a non-empty `action_ref`. | Query on 2026-05-02 sampled the latest 15 production `action_log` rows and every row had a non-empty `action_ref`, with contiguous refs from `ACT-20260502-0230` through `ACT-20260502-0244`. | ✅ | Delivery Engineering / 2026-05-02 |

---

## Remaining LIFF Live Checks

These checks remain launch blockers because they require real LINE/LIFF device evidence beyond desktop production browser access.

| Check ID | Check | Result | Evidence Needed |
|---|---|---|---|
| LIFF-VAL-006 | Returning-customer prefill path | ⬜ **PENDING** | Open LIFF with a customer that already has leads and confirm phone plus latest document/billing defaults prefill correctly. |
| LIFF-VAL-007 | Company tax-document validation | ⬜ **PENDING** | Submit one company tax-invoice case without branch code and confirm Thai validation error, then submit with branch code and confirm intake succeeds. |
| LIFF-VAL-008 | Runtime catalog path | ⬜ **PENDING** | Confirm LIFF picker loads runtime catalog items from `/api/intake/product-catalog` and quote/status/download pages render the imported product label instead of a slug fallback. |

## Commercial Document Policy Guard

This guard keeps the launch runbook honest about what the current system proves and what remains a separate commercial-document implementation packet.

| Item | Status | Launch meaning |
|---|---|---|
| Policy source | ✅ **RECORDED** | [COMMERCIAL_DOCUMENT_POLICY_V1.md](COMMERCIAL_DOCUMENT_POLICY_V1.md) is the source of truth. Core rule: `เงินเข้าใคร → เอกสารออกชื่อนั้น`. |
| Implementation packet | ⬜ **DEFERRED / NOT IMPLEMENTED** | [../plan/feature-commercial-documents-1.md](../plan/feature-commercial-documents-1.md) must be opened before building billing note, invoice, receipt, tax-ready, or tax-invoice issuance. |
| `P3-G08` quote download | ✅ **PASS AS QUOTATION ONLY** | This proves the current quotation download route, not invoice, receipt, tax invoice, or tax compliance. |
| `P3-G09` commercial unlock | ✅ **PASS AS PAYMENT UNLOCK ONLY** | This proves payment status can unlock production under workflow rules, not that a receipt or tax invoice was issued. |
| `LIFF-VAL-007` tax-document validation | ⬜ **PENDING AS INTAKE VALIDATION** | This validates Thai branch-code intake behavior only; it does not prove tax invoice issuance. |

Sign-off rule: if go-live requires billing note, invoice, receipt, tax-ready, or tax-invoice issuance, the current verdict stays **NO-GO** until `feature-commercial-documents-1` is implemented and validated. If launch can proceed without those documents, the business owner must explicitly sign off that commercial documents are deferred.

## Final Verdict

| Area | Verdict | Notes |
|---|---|---|
| Phase 1 - code quality | ✅ PASS | Static/local gates remain green. |
| Phase 2 - environment | ✅ PASS | Production Vercel, LINE webhook, LIFF endpoint, and admin access evidence recorded. |
| Phase 3 - live behavior | ✅ PASS | End-to-end customer and operator workflow gates are recorded as passing. |
| Remaining LIFF focused checks | ⬜ PENDING | `LIFF-VAL-006`, `LIFF-VAL-007`, and `LIFF-VAL-008` still require operator/device evidence. |
| Commercial document policy | ⬜ DECISION REQUIRED | Policy v1 is recorded; implementation is deferred unless the business owner marks it required before launch. |
| Sign-off | ⬜ PENDING | Customer/operator acceptance is not recorded yet. |

**Current overall verdict: NO-GO until the remaining LIFF focused checks, commercial document defer-or-block decision, and final sign-off are completed.**

## Sign-Off

| Role | Name | Decision | Date | Notes |
|---|---|---|---|---|
| Delivery Engineering |  |  |  |  |
| Operator / Admin Owner |  |  |  |  |
| Customer / Business Owner |  |  |  |  |

Commercial document sign-off must state one of these decisions in the notes column: `Deferred after launch` or `Required before GO`.

## Rollback Decision Authority

If launch proceeds after sign-off, rollback can be triggered by Delivery Engineering or the business owner when any of these happen:

- LINE webhook delivery fails for real customer messages.
- LIFF intake fails for real customer submissions.
- Admin cannot access `/admin` with an allowlisted account.
- Quote approval or payment unlock behavior diverges from the workflow policy.
- Customer-facing quote/status pages show incorrect financial or fulfillment state.
