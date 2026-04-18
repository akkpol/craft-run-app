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

## Workflow Source Of Truth
- `src/lib/types.ts` = canonical workflow states
- `src/lib/quote-workflow.ts` = payment gate and job-creation rules
- `src/app/api/quotes/[id]/approve/route.ts` = quote approval behavior
- `src/app/api/quotes/[id]/commercial/route.ts` = post-approval payment/commercial updates
- `src/app/api/jobs/[id]/status/route.ts` = allowed downstream job transitions
- `docs/WORKFLOW_TRANSITION_TABLE.md` = central transition table for humans and agents

## Workflow States
Main path:

`NEW_MESSAGE → COLLECTING_REQUIREMENTS → REQUIREMENTS_REVIEW → WAITING_QUOTE_APPROVAL → WAITING_PAYMENT / IN_DESIGN → IN_PRODUCTION → READY_FOR_FULFILLMENT → COMPLETED`

Explicit side branches:

`ON_HOLD_CUSTOMER_INPUT`, `HUMAN_REVIEW_REQUIRED`, `CANCELLED`

## Approval And Payment Gate
- `credit` unlocks production immediately
- `deposit` unlocks production only when `payment_status` is `partial` or `paid`
- `prepaid` unlocks production only when `payment_status` is `paid`
- Approving a quote may stop at `WAITING_PAYMENT`; it does not always create a job

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
- [ ] Approve button moves conversation to WAITING_PAYMENT or creates/reuses a job depending on payment unlock status
- [ ] Admin commercial update can move an approved quote from WAITING_PAYMENT to IN_DESIGN
- [ ] Admin page shows leads/quotes/jobs/escalations
- [ ] Status page shows latest job status
- [ ] Escalation flag works (HUMAN_REVIEW_REQUIRED)
- [ ] Safe-area padding visible on Android
- [ ] No console errors on LIFF init
