# FOGUS — Final Production Spec (April 2026)

## Stack (Locked)
- Next.js 16.2.x (latest patched)
- Supabase (PostgreSQL + Auth + Storage)
- Vercel (deploy)
- LINE Messaging API + LIFF v2.28.0

## 2026 Constraints Applied
1. Supabase: `sb_publishable_` / `sb_secret_` keys (not legacy anon/service_role)
2. Next.js 16: `await props.params` in all dynamic routes
3. LIFF: `padding-bottom: env(safe-area-inset-bottom)` on all pages
4. LIFF endpoint URL: `/liff` (not `/liff/intake`)
5. Call `liff.requestFriendship()` after `liff.init()`
6. Pin Next.js 16.2.x (CVE-2026-23869 patched)
7. Supabase UI Library blocks: password-based-auth, dropzone
8. `npx create-next-app -e with-supabase` as starter

## Environment Variables
```
# LINE
LINE_CHANNEL_SECRET=
LINE_CHANNEL_ACCESS_TOKEN=
LIFF_ID=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=

# App
NEXT_PUBLIC_BASE_URL=https://your-app.vercel.app
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=change-me-in-production
```

## Workflow States
NEW_MESSAGE → COLLECTING_INFO → FORM_SUBMITTED → QUOTE_DRAFTED →
WAITING_CUSTOMER_APPROVAL → JOB_CREATED → IN_PROGRESS → COMPLETED
(branch: HUMAN_REVIEW_REQUIRED at any point)

## Routes
- POST /api/webhook
- POST /api/intake
- POST /api/quotes/[id]/approve
- POST /api/jobs/[id]/status
- GET  /liff (LIFF endpoint)
- GET  /liff/intake (intake form)
- GET  /quote/[token]
- GET  /status/[token]
- GET  /admin

## Smoke Test Checklist
- [ ] LINE webhook responds 200 on production URL
- [ ] Signature verification rejects invalid signatures
- [ ] Bot replies with LIFF link on message
- [ ] LIFF page opens inside LINE app
- [ ] liff.requestFriendship() prompts add-friend
- [ ] Intake form submits → lead + quote created in DB
- [ ] Quote page loads at /quote/:token
- [ ] Approve button creates job + timeline entry
- [ ] Admin page shows leads/quotes/jobs/escalations
- [ ] Status page shows latest job status
- [ ] Escalation flag works (HUMAN_REVIEW_REQUIRED)
- [ ] Safe-area padding visible on Android
- [ ] No console errors on LIFF init
