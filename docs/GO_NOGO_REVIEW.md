---
title: FOGUS Go / No-Go Review
version: 1.0
date: 2026-04-26
owner: Delivery Engineering
status: Gate open — Phase 1 passed; Phase 2-3 pending real environment
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
5. If any gate fails, stop the run, record evidence, and resolve the failure before continuing.
6. Only after all gates PASS, fill the Sign-Off table and update the overall verdict to **GO**.

This document is the live run sheet. Do not split the same verification run across multiple plan files while executing.

## Plan Linkback

- Phase 2 and Phase 3 here are the live-environment execution layer for Wave 2, Wave 3, and TASK-024 in `plan/process-go-live-waves-1.md`.
- When a gate passes here, copy the final evidence outcome back into the related Wave task record after the run ends.
- If this document and a planning file disagree during live execution, trust this document for gate order and `plan/process-go-live-waves-1.md` for backlog priority afterward.

---

## Phase 1 — Code Quality Gates (Static, Local)

| Gate | Check | Result | Evidence | Date |
|------|-------|--------|----------|------|
| P1-G01 | `npm run build` — exits 0, no errors | ✅ **PASS** | Exit 0. Compiled in 60s. 22 static pages generated. | 2026-04-26 |
| P1-G02 | `npm run lint` — 0 ESLint errors | ✅ **PASS** | 0 errors. 1 non-blocking Node MODULE_TYPELESS_PACKAGE_JSON advisory (non-blocking). | 2026-04-26 |
| P1-G03 | `npm run check:workflow-policy` — smoke passes | ✅ **PASS** | `workflow-policy smoke checks passed` | 2026-04-26 |
| P1-G04 | Auth middleware: unauthenticated → `/auth/login` redirect | ✅ **PASS** | Code-confirmed: `src/middleware.ts` — session check → redirect on missing session. | 2026-04-25 |
| P1-G05 | Auth middleware: non-allowlisted email → deny | ✅ **PASS** | Code-confirmed: `ADMIN_ALLOWED_EMAILS` check in auth flow — fail-closed if env not set. | 2026-04-25 |
| P1-G06 | `action_log` schema in migrations | ✅ **PASS** | `supabase/migrations/010_action_log.sql` audited — immutable, realtime enabled, 5 indexes. | 2026-04-26 |
| P1-G07 | All workflow routes call `logAction` | ✅ **PASS** | 14 confirmed callers audited across all route handlers and action types. | 2026-04-26 |

**Phase 1 verdict: ✅ ALL PASS**

---

## Phase 2 — Environment Configuration Gates (Requires Real Environment)

| Gate | Check | Result | Who verifies | Notes |
|------|-------|--------|-------------|-------|
| P2-G01 | Supabase migrations applied successfully | ✅ **PASS** | Delivery Engineering | Supabase MCP confirmed migrations through `014_customer_media_assets` plus later repair migrations; `lead_media_assets` table, index, bucket, and RLS surface were checked on 2026-04-27 |
| P2-G02 | All 11 env vars set in Vercel | ✅ **PASS** | Delivery Engineering | 10 project env vars confirmed in Vercel production and `VERCEL_OIDC_TOKEN` remains platform-provided; `ADMIN_ALLOWED_EMAILS` was synced into production on 2026-04-27 |
| P2-G03 | Vercel deploy succeeds after env vars set | ⬜ **PENDING** | Operator | Monitor at Vercel dashboard → Deployments |
| P2-G04 | `NEXT_PUBLIC_BASE_URL` matches the live Vercel domain | ✅ **PASS** | Delivery Engineering | Vercel production alias is `https://craft-run.vercel.app`; `app_settings.base_url` and `NEXT_PUBLIC_BASE_URL` were both verified against that alias with no trailing slash on 2026-04-27 |
| P2-G05 | LINE Messaging API webhook URL registered and verified | ⬜ **PENDING** | Operator | `<base-url>/api/webhook` — click Verify in LINE Developers console |
| P2-G06 | LINE MINI App LIFF endpoint registered | ⬜ **PENDING** | Operator | `<base-url>/liff` — verify LIFF ID then set `LIFF_ID`/`NEXT_PUBLIC_LIFF_ID` |
| P2-G07 | Admin user created in Supabase Auth | ⬜ **PENDING** | Operator | Invite user → set in `ADMIN_ALLOWED_EMAILS` → redeploy |

### Phase 2 Operator Run Sheet

Use this run sheet during live-environment setup. Do not flip any Phase 2 gate to PASS until the evidence column is captured without exposing secret values.

Stop rule: if `P2-G03`, `P2-G05`, or `P2-G06` fails, stop the run and fix deployment or LINE/LIFF wiring before entering Phase 3.

| Gate | Operator steps | Evidence to capture | Result | Verified by / Date |
|------|----------------|---------------------|--------|--------------------|
| P2-G01 | Apply all migrations in order with `supabase db push` or the SQL editor, then confirm the newest migration is present without manual patching. | Supabase MCP migration list showed `001` through `014_customer_media_assets` plus later repair migrations; schema smoke also confirmed `lead_media_assets`, `idx_lead_media_assets_lead`, and `customer-media`. | ✅ | Delivery Engineering / 2026-04-27 |
| P2-G02 | Set all 11 Vercel env vars from `docs/CUSTOMER_HANDOFF_PACKAGE.md`, then double-check names and target environments only. | Vercel production env list confirmed the 10 project-managed variables; `VERCEL_OIDC_TOKEN` remains runtime-provided by Vercel and is not listed by `vercel env list`. | ✅ | Delivery Engineering / 2026-04-27 |
| P2-G03 | Trigger a fresh production deploy after env vars are saved and wait for Vercel to finish cleanly. | Deployment URL, deployment ID, and success screenshot or log excerpt. | ⬜ | |
| P2-G04 | Compare the deployed production URL against `NEXT_PUBLIC_BASE_URL` and confirm the value has no trailing slash. | `vercel inspect craft-run.vercel.app` confirmed the production alias; Supabase `app_settings.base_url` and the re-pulled production `NEXT_PUBLIC_BASE_URL` both matched `https://craft-run.vercel.app`. | ✅ | Delivery Engineering / 2026-04-27 |
| P2-G05 | Register `<base-url>/api/webhook` in the LINE Messaging API console and run the Verify action. | LINE console verification success message and the final webhook URL. | ⬜ | |
| P2-G06 | Register `<base-url>/liff` as the LIFF endpoint, confirm the LIFF ID, and verify `LIFF_ID` plus `NEXT_PUBLIC_LIFF_ID` match it. | LIFF console screenshot showing endpoint and LIFF ID alignment. | ⬜ | |
| P2-G07 | Create or invite the admin user in Supabase Auth, add the same email to `ADMIN_ALLOWED_EMAILS`, and redeploy if the env changed. | Supabase Auth user record plus masked email confirmation in the allowlist workflow. | ⬜ | |

### Preliminary External Route Signals

- 2026-04-27: `https://craft-run.vercel.app/liff` returned HTTP 200 from the live alias.
- 2026-04-27: `https://craft-run.vercel.app/api/webhook` returned HTTP 405 for GET, which is the expected public surface for a POST-only webhook route.
- These probes do not replace LINE console verification for `P2-G05` or LIFF console verification for `P2-G06`; they only confirm that the deployed routes are externally reachable.

---

## Phase 3 — End-to-End Behavioral Gates (Requires Live System)

| Gate | Check | Result | Who verifies |
|------|-------|--------|-------------|
| P3-G01 | Unauthenticated `/admin` → redirect to `/auth/login` | ⬜ **PENDING** | QA / Operator |
| P3-G02 | Staff login with valid credentials → `/admin` access granted | ⬜ **PENDING** | QA / Operator |
| P3-G03 | Login with non-allowlisted email → access denied | ⬜ **PENDING** | QA / Operator |
| P3-G04 | LINE message → webhook → conversation created in DB | ⬜ **PENDING** | QA / Operator |
| P3-G05 | LIFF intake → lead created → quote generated | ⬜ **PENDING** | QA / Operator |
| P3-G06 | Quote approval → state transitions to `WAITING_PAYMENT` | ⬜ **PENDING** | QA / Operator |
| P3-G07 | Quote rejection → state transitions to `REQUIREMENTS_REVIEW` | ⬜ **PENDING** | QA / Operator |
| P3-G08 | Quote PDF download at public token URL | ⬜ **PENDING** | QA / Operator |
| P3-G09 | Admin unlock (commercial terms) → production state unlocked | ⬜ **PENDING** | QA / Operator |
| P3-G10 | Job status progression through all workflow states | ⬜ **PENDING** | QA / Operator |
| P3-G11 | Escalation keyword → `HUMAN_REVIEW_REQUIRED` state | ⬜ **PENDING** | QA / Operator |
| P3-G12 | `/admin/settings` save → `settings.updated` in action_log | ⬜ **PENDING** | QA / Operator |
| P3-G13 | All gate events have `action_ref` in `action_log` | ⬜ **PENDING** | QA / Operator |

### Phase 3 Operator Run Sheet

Run these checks in order against the real deployment so the evidence bundle mirrors the customer journey and the staff journey end to end.

Stop rule: if any of `P3-G01` through `P3-G05` fails, treat the system as launch-blocked and do not continue deeper into customer acceptance until the failure is resolved.

| Gate | Run steps | Expected outcome | Evidence to capture | Result | Verified by / Date |
|------|-----------|------------------|---------------------|--------|--------------------|
| P3-G01 | Open `/admin` in a logged-out browser session. | Browser redirects to `/auth/login`. | Redirect screenshot with URL visible. | ⬜ | |
| P3-G02 | Sign in with a valid allowlisted staff account. | Staff lands on `/admin` without middleware rejection. | Login success screenshot and masked account identifier. | ⬜ | |
| P3-G03 | Try to sign in with a non-allowlisted account. | Access is denied or the admin surface stays blocked. | Error or rejection screenshot with masked account identifier. | ⬜ | |
| P3-G04 | Send a normal LINE message to the OA and inspect the webhook effect. | Conversation row is created and the webhook path succeeds. | LINE chat screenshot plus DB record or admin evidence of the new conversation. | ⬜ | |
| P3-G05 | Open the LIFF intake flow from the customer path and submit a representative job. | Lead and quote records are created and linked to the conversation. | LIFF submit confirmation plus DB or admin evidence of the new lead and quote. | ⬜ | |
| P3-G06 | Approve a quote that should remain payment-blocked. | Conversation moves to `WAITING_PAYMENT`. | Public quote action screenshot plus resulting state evidence. | ⬜ | |
| P3-G07 | Reject a quote from the public customer path. | Conversation returns to `REQUIREMENTS_REVIEW`. | Rejection screenshot plus resulting state evidence. | ⬜ | |
| P3-G08 | Open the public quote token URL and download the PDF. | PDF renders and downloads with the expected business branding. | PDF screenshot or downloaded artifact reference. | ⬜ | |
| P3-G09 | Use the admin commercial flow to unlock production for a blocked quote. | Conversation advances into `IN_DESIGN` when the payment rule is satisfied. | Admin action screenshot plus resulting workflow state evidence. | ⬜ | |
| P3-G10 | Advance a job through the remaining staff-controlled workflow states and check the customer status page after each major change. | Job progression is accepted and customer-facing status stays aligned. | Admin progression screenshots plus customer status-page screenshots. | ⬜ | |
| P3-G11 | Send a supported escalation keyword such as `admin` or `คุยกับแอดมิน`. | Conversation moves to `HUMAN_REVIEW_REQUIRED`. | LINE chat evidence plus resulting state evidence. | ⬜ | |
| P3-G12 | Change a runtime setting in `/admin/settings` and save it. | Save succeeds and `settings.updated` appears in `action_log`. | Settings save screenshot plus `action_log` row evidence. | ⬜ | |
| P3-G13 | Review the `action_log` rows created by the gates above. | Every recorded gate event has a non-empty `action_ref`. | Query output or screenshots showing `action_ref` present for sampled rows. | ⬜ | |

---

## Go / No-Go from action-tracking-plan.md

The `plan/action-tracking-plan.md` defines a 7-item manual go/no-go gate. Status as of 2026-04-26:

| Gate | Item | Status |
|------|------|--------|
| AG-01 | Build passes | ✅ Done — 2026-04-26 |
| AG-02 | Lint passes | ✅ Done — 2026-04-26 |
| AG-03 | Smoke passes | ✅ Done — 2026-04-26 |
| AG-04 | action_log schema confirmed | ✅ Done — 2026-04-26 |
| AG-05 | All action callers confirmed | ✅ Done — 2026-04-26 |
| AG-06 | E2E behavioral tests (live) | ⬜ Pending — requires real environment |
| AG-07 | Customer/operator sign-off | ⬜ Pending |

---

## Current Verdict

| Phase | Status |
|-------|--------|
| Phase 1 — Code Quality | ✅ ALL PASS |
| Phase 2 — Environment Config | ⬜ Pending operator actions |
| Phase 3 — E2E Behavioral | ⬜ Pending live environment |
| action-tracking-plan gates | 5/7 ✅ — 2 pending |

### **Overall: NO-GO (Phase 2 + Phase 3 not yet verified)**

---

## Sign-Off

TASK-024 is complete only when all mandatory gates above are PASS and this sign-off table is fully recorded.

This document requires the following sign-offs before the final GO decision is recorded:

| Role | Name | Signature / Date |
|------|------|-----------------|
| Delivery Engineer | | |
| Operator | | |
| Customer Acceptance | | |

Once all gates in Phases 1–3 are cleared and sign-offs are collected, update the **Overall** verdict above to **✅ GO** and record the approved launch date.

---

## Rollback Decision Authority

If any P3 gate fails after initial go-live:

- **P3-G01 to P3-G03** (auth): Immediate rollback — no exceptions.
- **P3-G04 to P3-G05** (intake): Immediate rollback — core business flow broken.
- **P3-G06 to P3-G11** (workflow): Rollback unless isolated to a single non-critical path; assess impact within 15 minutes.
- **P3-G12 to P3-G13** (logging): Investigate; rollback if the main flow is also degraded.

Rollback procedure: Vercel dashboard → Deployments → prior successful deployment → **Promote to Production**.
