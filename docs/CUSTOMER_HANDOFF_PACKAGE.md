---
title: FOGUS Customer Handoff Package
version: 1.0
date: 2026-04-26
owner: Delivery Engineering
status: Ready for customer review
plan_ref: plan/process-customer-handoff-1.md (TASK-022)
---

# FOGUS — Customer Handoff Package

## 1. System Access

| Surface | URL pattern | Who can access |
|---------|------------|----------------|
| Customer LIFF intake | `<base-url>/liff` | LINE users with friendship |
| Customer quote view | `<base-url>/quote/<token>` | Token holder (no login required) |
| Customer status page | `<base-url>/status/<token>` | Token holder (no login required) |
| Quote PDF download | `<base-url>/quote/<token>/download` | Token holder (no login required) |
| Admin / backoffice | `<base-url>/admin` | Allowlisted staff only (requires Supabase Auth login) |
| Admin settings | `<base-url>/admin/settings` | Allowlisted staff only |

> **Note**: `<base-url>` is the `NEXT_PUBLIC_BASE_URL` env var. Set this to your Vercel deployment URL (e.g. `https://your-app.vercel.app`) before going live.

---

## 2. Environment Variables — Ownership Table

All variables must be configured in Vercel Project Settings → Environment Variables before first deploy.

| Variable | Source | Purpose | Side | Owner |
|----------|--------|---------|------|-------|
| `ADMIN_ALLOWED_EMAILS` | Self-defined — comma-separated email list | Allowlist for `/admin` backoffice access | Server | Operator |
| `ADMIN_EMAIL` | Self-defined — single email (legacy fallback) | Legacy single-email fallback if allowlist not set | Server | Operator |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Developers → Messaging API channel → Channel access token | Send reply/push messages to LINE users | Server only | Operator |
| `LINE_CHANNEL_SECRET` | LINE Developers → Messaging API channel → Channel secret | Verify incoming webhook request signatures | Server only | Operator |
| `LIFF_ID` | LINE Developers → LIFF → LIFF ID field | LIFF URL construction and `liff.init()` call | Server + client config | Operator |
| `NEXT_PUBLIC_LIFF_ID` | Same value as `LIFF_ID` | Browser-side `liff.init()` | Public/client | Operator |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase dashboard → Project Settings → API → Project URL | Supabase project endpoint | Public/client | Operator |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase dashboard → Project Settings → API → `anon` public key | Browser/SSR read-only access | Public/client | Operator |
| `SUPABASE_SECRET_KEY` | Supabase dashboard → Project Settings → API → `service_role` key | Server-only admin DB operations | **Server only — never expose to browser** | Operator |
| `NEXT_PUBLIC_BASE_URL` | Self-defined — your Vercel deployment URL | Builds all quote/status/liff links | Public/client | Operator |
| `OPENAI_API_KEY` | OpenAI Platform | Optional fallback key for AI preview provider `openai` | Server only | Operator / Business owner |
| `GOOGLE_API_KEY` | Google AI Studio | Optional fallback key for AI preview provider `google` | Server only | Operator / Business owner |
| `GEMINI_API_KEY` | Google AI Studio / legacy naming | Optional fallback if `GOOGLE_API_KEY` is not set | Server only | Operator / Business owner |
| `VERCEL_OIDC_TOKEN` | Auto-provided by Vercel runtime | Vercel integration token | Deployment only | Auto |

---

## 3. LINE Console Registration

### 3a. Messaging API Webhook (for receiving LINE messages)

1. Go to LINE Developers → your Messaging API channel → Messaging API tab.
2. Set **Webhook URL** to: `https://<your-vercel-domain>/api/webhook`
3. Enable **Use webhook** toggle.
4. Click **Verify** — you should receive a 200 response.

### 3b. LINE MINI App / LIFF Endpoint (for customer intake form)

1. Go to LINE Developers → LIFF tab.
2. Set the **Endpoint URL** to: `https://<your-vercel-domain>/liff`
3. ⚠️ **Do NOT** register the webhook URL here or the LIFF URL at the webhook field — these are separate registrations.
4. Note the resulting `LIFF ID` (format: `<channelId>-xxxxxxxx`) and set it as both `LIFF_ID` and `NEXT_PUBLIC_LIFF_ID`.

---

## 4. Supabase Setup

1. Create a new Supabase project.
2. Apply all migrations in order from `supabase/migrations/`:
   ```
   001_...sql
   002_...sql
   ...
   010_action_log.sql
   ```
   Apply via Supabase CLI: `supabase db push` or copy-paste each file in the SQL editor.
3. In Supabase Auth → Users, create a user account for each staff/admin.
4. Add the same email addresses to `ADMIN_ALLOWED_EMAILS` in Vercel env vars.

---

## 5. Admin User Creation Steps

1. Open Supabase dashboard → Authentication → Users.
2. Click **Invite user** and enter the staff email address.
3. The staff member receives an invite email — they set their password on first sign-in.
4. Add the same email to `ADMIN_ALLOWED_EMAILS` env var in Vercel (comma-separated if multiple).
5. Redeploy on Vercel or trigger a new deployment so the updated env var takes effect.

The system is **fail-closed**: if `ADMIN_ALLOWED_EMAILS` is not set, no one can reach `/admin` — even the Supabase admin user.

---

## 6. Runtime Settings (Post-Boot Configuration)

After the system is live, runtime settings can be updated without a redeploy by navigating to `/admin/settings`. Settings stored here include:

- Company name and address (used on PDF documents)
- Business logo URL
- LINE Messaging API token and secret (runtime override of env vars)
- LIFF ID
- Base URL override

All changes to these settings are recorded in the `action_log` table with `action_type = 'settings.updated'` and `actor_type = 'human'` for full traceability.

---

## 7. Key Rotation Procedure

### LINE Channel Access Token

1. Go to LINE Developers → Messaging API channel → Issue new token.
2. Copy the new token.
3. Update `LINE_CHANNEL_ACCESS_TOKEN` in Vercel env vars.
4. Trigger a redeploy on Vercel.
5. Old token continues working until explicitly revoked.

### LINE Channel Secret

1. Go to LINE Developers → Basic settings → Channel secret → Reissue.
2. ⚠️ Old secret is immediately invalidated — incoming webhooks will fail until step 3 is complete.
3. Update `LINE_CHANNEL_SECRET` in Vercel env vars.
4. Trigger a redeploy on Vercel immediately.

### Supabase Secret Key (`SUPABASE_SECRET_KEY` / service_role)

1. Go to Supabase dashboard → Project Settings → API → Rotate `service_role` key.
2. ⚠️ All server-side DB operations will fail until env var is updated.
3. Update `SUPABASE_SECRET_KEY` in Vercel env vars.
4. Trigger a redeploy on Vercel immediately.

---

## 8. PDF / Quote Document Access

- Quote PDF is publicly accessible at `<base-url>/quote/<token>/download` using the token embedded in LINE messages.
- The current quote PDF is a quotation document only. It must not be presented as an invoice, receipt, tax invoice, or legal/compliance-complete tax document.
- No login is required — the token itself is the authorization credential.
- Tokens are UUIDs generated at quote creation and do not expire by default.
- Business logo and company details come from runtime settings at `/admin/settings`.

Commercial document policy source: [COMMERCIAL_DOCUMENT_POLICY_V1.md](COMMERCIAL_DOCUMENT_POLICY_V1.md). Implementation for billing note, invoice, receipt, tax-ready, and tax-invoice issuance belongs to [../plan/feature-commercial-documents-1.md](../plan/feature-commercial-documents-1.md).

---

## 9. Rollback Trigger Criteria

Initiate a rollback (revert to previous Vercel deployment) if ANY of the following occur:

| Signal | Action |
|--------|--------|
| LINE webhook delivering 500 errors repeatedly | Rollback immediately |
| Admin login blocked for all staff with valid accounts | Rollback immediately |
| LIFF intake not creating leads or quotes in Supabase | Rollback immediately |
| Quote approval flow not changing workflow state | Rollback immediately |
| `action_log` table not receiving entries on known actions | Investigate then rollback if persistent |

To rollback: Vercel dashboard → Deployments → previous successful deployment → **Promote to Production**.

---

## 10. Support and Escalation

- Action log reference format: `ACT-YYYYMMDD-NNNN` (e.g. `ACT-20260426-0012`) — use this when reporting issues for exact traceability.
- Hypercare window: 48–72 hours post-launch — prioritize support tickets during this window.
- For LINE/LIFF configuration issues, verify: webhook URL registration, LIFF endpoint URL, and that both `LIFF_ID` and `NEXT_PUBLIC_LIFF_ID` match the console value.

---

## 11. Build Evidence (2026-04-26)

| Check | Result | Detail |
|-------|--------|--------|
| `npm run build` | ✅ Pass | Exit 0. Compiled successfully in 60s. 22 static pages generated. |
| `npm run lint` | ✅ Pass | 0 ESLint errors. Node.js MODULE_TYPELESS_PACKAGE_JSON advisory was removed on 2026-04-30 after adding `"type": "module"` to `package.json`. |
| `npm run check:workflow-policy` | ✅ Pass | `workflow-policy smoke checks passed` |
