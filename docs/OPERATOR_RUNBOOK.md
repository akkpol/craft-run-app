---
title: FOGUS Operator Runbook
version: 1.0
date: 2026-04-26
owner: Delivery Engineering
status: Active
plan_ref: plan/process-customer-handoff-1.md (TASK-023)
---

# FOGUS — Operator Runbook

This runbook covers day-to-day incident triage, scheduled maintenance, and emergency procedures for the FOGUS production system.

---

## 1. System Overview

- **Platform**: Next.js 16 on Vercel, Supabase (DB + Auth + Storage), LINE Messaging API, LINE MINI App (LIFF)
- **Deployment trigger**: `git push` to main branch → Vercel auto-deploy
- **Workflow state machine**: `docs/workflow-policy.json` — do not modify without a full smoke test
- **Action log**: all significant events write to `action_log` table with `action_ref` format `ACT-YYYYMMDD-NNNN`

---

## 2. Incident Triage

### 2a. LINE Messages Not Arriving (Webhook Not Receiving)

1. Go to LINE Developers → Messaging API channel → Verify webhook URL.
2. Confirm webhook URL is exactly `<base-url>/api/webhook` (no trailing slash, correct domain).
3. Check Vercel runtime logs (Vercel dashboard → Project → Functions → `/api/webhook`) for recent invocations.
4. Confirm `LINE_CHANNEL_SECRET` in Vercel env vars matches the LINE console value — signature verification will reject all requests if mismatched.
5. If logs show 401/403: rotate `LINE_CHANNEL_SECRET` per Section 7 of the handoff package and redeploy.

### 2b. Admin Login Failing for All Staff

1. Confirm the staff user exists in Supabase Auth → Users.
2. Confirm the staff email is listed in `ADMIN_ALLOWED_EMAILS` Vercel env var (comma-separated, no spaces around commas).
3. Confirm Vercel has been redeployed after the env var was last changed.
4. If Supabase Auth is unresponsive: check [Supabase Status](https://status.supabase.com).
5. If `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` were recently changed, trigger a fresh Vercel deploy.

### 2c. LIFF Intake Form Not Loading

1. Open LINE app → follow LIFF link → note the error shown in the MINI App webview.
2. Common errors:
   - `LIFF_ID is invalid` → `LIFF_ID`/`NEXT_PUBLIC_LIFF_ID` env var mismatch with LINE console. Update env vars and redeploy.
   - `Not in LINE environment` → user is accessing the URL in a browser, not LINE — expected behavior, not a bug.
   - Blank page → check Vercel logs for runtime errors at `/liff`.
3. Confirm LIFF endpoint in LINE Developers console is `<base-url>/liff` (not `/liff/intake`).

### 2d. Quote/Status Page Returning 404 or Error

1. These pages use public token URLs: `<base-url>/quote/<token>` and `<base-url>/status/<token>`.
2. Confirm the token in the LINE message matches a real record in Supabase `quotes` table.
3. Check Vercel function logs for the route to identify the exact error.
4. If `NEXT_PUBLIC_BASE_URL` was recently changed, old tokens may contain the old domain — they are still valid as long as the token value itself hasn't changed.

### 2e. PDF Download Not Rendering Correctly

1. Navigate to `/quote/<token>/download` directly.
2. If business logo is missing: check company settings at `/admin/settings` — ensure logo URL is a publicly accessible HTTPS URL.
3. If company name/address are blank: update at `/admin/settings`.
4. If page is blank: check browser console for JS errors — most likely a Supabase connection issue.

### 2f. Action Log Not Recording Events

1. Verify the `action_log` table exists in Supabase — apply migration `supabase/migrations/010_action_log.sql` if missing.
2. Check that `SUPABASE_SECRET_KEY` is correctly set in Vercel env vars (used by server-side logging helpers).
3. Action logging is **non-fatal by design** — a failed log write never blocks the main operation. If main workflow works but log is empty, the DB connection for logging is silently failing.
4. To diagnose: check Vercel function logs for the relevant API route and look for any log-write errors.

### 2g. AI Preview Generation Failing (API Missing, Provider Error, Token Invalid, or Quota Exhausted)

This flow applies when staff cannot generate a design preview from the lead screen or when the preview request returns an error.

#### Expected runtime behavior

- The app composes the final design prompt from lead data and sends it to the AI image provider.
- The AI runtime is enabled only when `ai_image_enabled` is on and an API key is available.
- If generation fails, the lead is marked with `ai_image_status = failed` and the error message is stored in `ai_image_error`.

#### Step 1. Confirm the failure scope

1. Retry with one affected lead only. Do not bulk-retry multiple jobs yet.
2. Check whether the problem affects:
   - one lead only
   - all AI preview attempts
   - only new attempts after a recent settings change
3. If only one lead fails, first inspect the lead prompt/context before treating it as a system outage.

#### Step 2. Read the exact failure signal

Check these in order:

1. Admin UI error text shown after preview generation fails.
2. `leads.ai_image_error` for the affected lead.
3. Vercel function logs for `POST /api/leads/[id]/ai-preview`.
4. `action_log` entries for `lead.ai_preview_generated`.

#### Step 3. Map the error to the right action

**Case A — API not configured**

Typical message:

- `AI image generation is not configured`

Meaning:

- `ai_image_enabled` is off, or
- no API key is available from `app_settings.ai_image_api_key`, or
- no `OPENAI_API_KEY` fallback is available in the server environment

Operator action:

1. Go to `/admin/settings` and verify AI image generation is enabled.
2. Confirm provider and model fields are filled as intended.
3. Confirm an API key exists in settings or in server env vars.
4. If settings were just changed, redeploy on Vercel and retry one lead.

Escalation owner:

- Delivery Engineering

**Case B — Unsupported provider configuration**

Typical message:

- `Unsupported AI image provider`

Meaning:

- the configured provider does not match the runtime currently supported by the app

Operator action:

1. Check `/admin/settings` and set the provider back to the supported value.
2. Redeploy if the provider came from env-backed configuration.
3. Retry one lead.

Escalation owner:

- Delivery Engineering

**Case C — Token invalid, expired, revoked, or quota exhausted**

Typical message:

- provider returns an OpenAI error message in the API response
- examples may include invalid key, insufficient quota, billing, or auth errors

Meaning:

- the key exists but the provider rejected it

Operator action:

1. Do not keep retrying multiple leads.
2. Capture the exact provider message from logs.
3. Confirm whether the API key was recently rotated.
4. Replace the key in `/admin/settings` or Vercel env vars.
5. Redeploy if env vars changed.
6. Retry one lead only after the key update is complete.

Escalation owner:

- Delivery Engineering for key rotation and runtime verification
- Business owner or billing owner if the provider account is out of quota or payment has failed

**Case D — Provider outage or upstream request failure**

Typical message:

- `AI image provider request failed`
- timeout, 5xx, or empty response from the provider

Operator action:

1. Check provider status if available.
2. Wait a short interval and retry one lead only.
3. If the second attempt fails with the same upstream symptom, stop retries and escalate.

Escalation owner:

- Delivery Engineering

**Case E — App storage/upload failure after generation**

Typical signal:

- provider request succeeds but upload/public URL step fails
- Vercel or storage logs show bucket upload errors

Operator action:

1. Check Supabase Storage health.
2. Confirm bucket `app-assets` exists and is writable by the server path.
3. Escalate with the exact upload error.

Escalation owner:

- Delivery Engineering

#### Step 4. Customer-facing fallback

If AI preview cannot be generated during the incident window:

1. Do not block the whole lead from moving operationally.
2. Tell staff to switch to manual design handling for the affected lead.
3. Keep the conversation with the customer explicit that preview generation is delayed, not the entire order intake.
4. Resume AI preview only after one successful verification run.

#### Step 5. Handoff package for escalation

When sending the issue onward, include all of the following:

- lead ID
- affected route: `POST /api/leads/[id]/ai-preview`
- exact `ai_image_error` text
- Vercel log lines for the failed request
- whether `/admin/settings` was changed recently
- whether the key lives in settings or env vars
- whether failure is one lead or all leads
- Bangkok timestamp of first failure

#### Step 6. Ownership path

1. Operator or admin staff: identify the failing lead, collect the exact message, stop bulk retries.
2. Delivery Engineering: verify runtime config, key source, provider response, Vercel logs, and storage/upload behavior.
3. Business owner or billing owner: resolve provider account suspension, quota, or billing issues when the provider rejected a valid-looking request for commercial reasons.

#### Step 7. Clear decision flow

1. If the message is `AI image generation is not configured`, fix configuration first.
2. If the message shows auth, quota, or billing rejection, rotate key or resolve provider account status.
3. If the message shows upstream/provider failure, stop repeated retries and escalate.
4. If the provider call works but storage fails, treat it as a Supabase Storage incident.
5. If one lead fails but others work, inspect the lead prompt/context rather than treating it as a platform outage.

---

## 3. Redeploy Procedure

### Standard redeploy (after env var or code changes):

```bash
# From main branch on local machine:
git push origin main
```

Vercel auto-deploys on push. Monitor progress at: Vercel dashboard → Deployments.

### Force redeploy (same code, refresh env vars):

1. Vercel dashboard → Project → Deployments.
2. Find the most recent successful deployment.
3. Click the three-dot menu → **Redeploy**.
4. This picks up updated env vars without a code change.

### Promote an older deployment (rollback):

1. Vercel dashboard → Project → Deployments.
2. Find the last known-good deployment.
3. Click the three-dot menu → **Promote to Production**.
4. Takes effect within ~30 seconds.

---

## 4. LINE / LIFF Reconfiguration After Secret Rotation

If `LINE_CHANNEL_SECRET` is rotated (see handoff package Section 7):

1. Update `LINE_CHANNEL_SECRET` in Vercel env vars immediately.
2. Trigger a Vercel redeploy immediately (see Section 3 above).
3. Go to LINE Developers → Messaging API → **Verify** webhook URL to confirm the new secret is accepted.
4. Send a test LINE message to confirm end-to-end delivery.

If `LIFF_ID` changes (e.g. channel migration):

1. Update `LIFF_ID` and `NEXT_PUBLIC_LIFF_ID` in Vercel env vars.
2. Trigger a Vercel redeploy.
3. Go to LINE Developers → LIFF → confirm endpoint URL is still `<base-url>/liff`.
4. Test the LIFF link from LINE to confirm intake form loads.

---

## 5. Hypercare Support Window

- **Duration**: 48–72 hours after go-live
- **Priority**: All P1/P2 issues (anything blocking LINE delivery, admin access, or quote flow) must be resolved within 2 hours during this window
- **Escalation contact**: Delivery Engineering lead
- **Operating hours during hypercare**: continuous coverage by on-call operator

After the hypercare window closes, normal support SLAs apply.

---

## 6. Routine Checks (Weekly)

| Check | How |
|-------|-----|
| Verify LINE webhook is active | LINE Developers → Messaging API → Webhook settings → Verify |
| Review `action_log` for anomalies | Supabase Table Editor → `action_log` → sort by `created_at` DESC |
| Check Vercel function error rate | Vercel dashboard → Analytics / Logs |
| Confirm admin login works | Log in at `/auth/login` with a staff account |
| Confirm AI preview can generate for one test lead | Generate one preview and verify `ai_image_status` becomes `generated` |

---

## 7. Environment Variable Change Checklist

When any env var is changed:

- [ ] Update in Vercel dashboard → Project Settings → Environment Variables
- [ ] Trigger a redeploy (env vars are baked at build/deploy time for public vars)
- [ ] If `LINE_CHANNEL_SECRET` changed: immediately verify webhook in LINE console
- [ ] If `LIFF_ID`/`NEXT_PUBLIC_LIFF_ID` changed: test LIFF from LINE app
- [ ] If `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` changed: test login + public pages
- [ ] If `ADMIN_ALLOWED_EMAILS` changed: test that new staff can log in and removed staff cannot
- [ ] Record the change and date in incident log

---

## 8. Workflow Policy Changes

The workflow state machine is defined in `docs/workflow-policy.json` and loaded by `src/lib/workflow-policy-core.mjs`.

**Never modify `workflow-policy.json` without:**

1. Running `npm run check:workflow-policy` (`node scripts/workflow-policy-smoke.mjs`) locally — must pass.
2. Running `npm run build` and `npm run lint` — both must pass.
3. Performing a full E2E test of the quote approval → payment → production flow.
4. Tagging the commit with a version note explaining the change.

---

## 9. Escalation Reference

When reporting issues to Delivery Engineering, always include:

- `action_ref` of the affected action if available (format: `ACT-YYYYMMDD-NNNN`, found in `action_log` table)
- Vercel function log URL or copy of relevant log lines
- Exact LINE User ID or conversation ID if the issue is LINE-side
- Time of first occurrence (Bangkok time, GMT+7)
- Current deployment SHA (visible in Vercel dashboard → active deployment)
