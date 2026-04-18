# 🏭 FOGUS — Digital Signage & Print ERP (2026)

LINE OA + LIFF + Supabase + Next.js 16.2 + Vercel

## Vercel Sandbox

โปรเจกต์นี้ตั้งค่าพร้อมใช้ Vercel Sandbox CLI แล้วสำหรับรันโค้ดที่ไม่ไว้ใจใน Linux environment แบบแยกออกจากเครื่องหลักและฐานข้อมูลของแอป

ดูคู่มือเริ่มต้นที่ `docs/VERCEL_SANDBOX.md`

## Workflow Source Of Truth

ถ้าจะอ้างอิง customer flow หรือ state transition ของระบบ ให้ยึดตามลำดับนี้:

- `src/lib/types.ts` = รายชื่อ workflow states ที่ใช้งานจริง
- `src/lib/quote-workflow.ts` = approval/payment gate และ job creation rule
- `src/app/api/quotes/[id]/approve/route.ts` = approve quote แล้วไป `WAITING_PAYMENT` หรือ `IN_DESIGN`
- `src/app/api/quotes/[id]/commercial/route.ts` = admin ปรับ payment term/status แล้วปลดล็อกไป `IN_DESIGN`
- `src/app/api/jobs/[id]/status/route.ts` = allowed job transitions หลังเริ่มงาน
- `docs/WORKFLOW_TRANSITION_TABLE.md` = transition table กลางสำหรับคนและ agent

## Quick Start For ENV

ถ้า user งงเรื่อง `Messaging API` กับ `LIFF` ให้เริ่มจาก 2 ไฟล์นี้ก่อน:

- `.env.example` = ตัวอย่าง env พร้อมคำอธิบายว่าแต่ละค่ามาจากไหน
- `docs/ENV_AND_LINE_SETUP.md` = คู่มือแยกว่าอะไรคือ Messaging API, อะไรคือ LIFF, และ URL ไหนต้องใส่ที่ไหน

หลักการของ repo นี้:

- `.env.example` เป็นแม่แบบให้เจ้าของระบบหรือผู้ติดตั้งกรอก
- ไม่ควรใช้ repo นี้เป็นที่เก็บ secret จริงถาวร
- production ควรกรอกค่าจริงใน Vercel Environment Variables
- หลังจากระบบบูตได้แล้ว สามารถให้ user เข้าไปกรอกค่า LINE/LIFF/Base URL ใน `/admin/settings` ได้

ภาพจำสั้นที่สุด:

- `Messaging API` = แชต LINE OA + webhook + push/reply message
- `LIFF` = หน้าเว็บใน LINE
- `Webhook URL` ต้องเป็น `/api/webhook`
- `LIFF Endpoint URL` ต้องเป็น `/liff`

## Project Structure

```
fogus/
├── src/
│   ├── app/
│   │   ├── layout.tsx                      # Root layout + LIFF SDK CDN
│   │   ├── page.tsx                        # Redirect → /admin
│   │   ├── globals.css                     # Tailwind v4
│   │   ├── api/
│   │   │   ├── webhook/route.ts            # POST — LINE webhook
│   │   │   ├── intake/route.ts             # POST — LIFF form submission
│   │   │   ├── quotes/[id]/approve/route.ts # POST — approve quote
│   │   │   └── jobs/[id]/status/route.ts   # POST — update job status
│   │   ├── liff/
│   │   │   ├── layout.tsx                  # Safe-area padding
│   │   │   ├── page.tsx                    # LIFF endpoint → redirect /intake
│   │   │   └── intake/page.tsx             # Intake form (client component)
│   │   ├── quote/[token]/
│   │   │   ├── page.tsx                    # Public quote page
│   │   │   └── approve-button.tsx          # Client approve button
│   │   ├── status/[token]/page.tsx         # Customer status page
│   │   └── admin/
│   │       ├── page.tsx                    # Admin dashboard (server)
│   │       └── admin-tabs.tsx              # Tabs + tables (client)
│   ├── lib/
│   │   ├── line.ts                         # LINE SDK helpers
│   │   ├── types.ts                        # Types, constants, pricing
│   │   └── supabase/
│   │       ├── client.ts                   # Browser client (publishable key)
│   │       ├── server.ts                   # SSR client (publishable key)
│   │       └── admin.ts                    # Admin client (secret key)
│   └── middleware.ts                       # Auth middleware
├── supabase/migrations/001_initial.sql     # Database schema
├── .env.example                            # Environment variables
├── next.config.ts
├── tsconfig.json
├── package.json
├── vercel.json
└── README.md
```

## 2026 Constraints Applied

| Constraint | Implementation |
|---|---|
| Supabase new API keys | `sb_publishable_` / `sb_secret_` (not legacy anon/service_role) |
| Next.js 16 async params | `await props.params` in all dynamic routes |
| LIFF edge-to-edge Android | `padding-bottom: env(safe-area-inset-bottom)` in liff/layout.tsx |
| LIFF endpoint URL | Registered as `/liff`, not `/liff/intake` |
| `liff.requestFriendship()` | Called after `liff.init()` in intake page |
| Next.js 16.2.x patched | Package.json pins `^16.2.0` (CVE-2026-23869 patched) |

## Deployment Steps (3 hours)

### Hour 1: Setup (45 min)

1. **Supabase Project**
   - Create project at supabase.com
   - Go to SQL Editor → paste `supabase/migrations/001_initial.sql` → Run
   - Go to Settings → API Keys → Enable new API keys
   - Copy `sb_publishable_...` and `sb_secret_...`

2. **LINE OA + Messaging API**
   - Create LINE OA at manager.line.biz
   - Enable Messaging API in settings
   - LINE Developers Console → create Messaging API channel
   - Copy Channel Secret + Channel Access Token
   - Response Settings → Chat: ON, Webhook: ON, Auto-reply: OFF

3. **LIFF Registration**
   - LINE Developers Console → LIFF tab → Add LIFF app
   - Endpoint URL: `https://your-app.vercel.app/liff`
   - Size: **Full**
   - Scopes: openid, profile
   - Copy LIFF ID

4. **Deploy to Vercel**
   ```bash
   git init && git add . && git commit -m "init"
   npx vercel --prod
   ```
   - Add all env vars in Vercel dashboard
   - Set webhook URL in LINE Console: `https://your-app.vercel.app/api/webhook`
   - Update LIFF endpoint URL with real Vercel URL

### Hour 2: Test Core Flow (60 min)

5. **Test webhook**
   - Send message to LINE OA → should get Flex Message reply
   - Check Supabase: conversations + messages tables

6. **Test LIFF form**
   - Tap "กรอกรายละเอียดงาน" in LINE
   - Fill form → submit
   - Check: leads + quotes + quote_items tables

7. **Test quote approval**
   - Open quote link → click approve
   - Check: conversation moves to `WAITING_PAYMENT` or `IN_DESIGN` based on payment terms/status
   - Check: `jobs` + `job_timeline` are created only when production is unlocked

### Hour 3: Admin + Polish (60 min)

8. **Admin dashboard**
   - Go to `/admin` → verify all tabs show data
   - Change job status → verify LINE push message sent

9. **Customer status page**
   - Open `/status/:token` → verify latest status shows

10. **Escalation test**
    - Send "คุยกับแอดมิน" in LINE → check escalations table

## Environment Variables

```
LINE_CHANNEL_SECRET=
LINE_CHANNEL_ACCESS_TOKEN=
LIFF_ID=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
NEXT_PUBLIC_BASE_URL=
```

Note: `LIFF_ID` also needs a client-side version:
```
NEXT_PUBLIC_LIFF_ID=  (same value as LIFF_ID)
```

### ENV Mapping Cheat Sheet

| ENV | Source | Purpose |
|---|---|---|
| `LINE_CHANNEL_SECRET` | LINE Developers Console > Messaging API | verify webhook signature |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Developers Console > Messaging API | send reply/push messages |
| `LIFF_ID` | LINE Developers Console > LIFF | LIFF app id |
| `NEXT_PUBLIC_LIFF_ID` | same as `LIFF_ID` | browser-side LIFF init |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project Settings | project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase Project Settings | browser/SSR key |
| `SUPABASE_SECRET_KEY` | Supabase Project Settings | server-only admin key |
| `NEXT_PUBLIC_BASE_URL` | your deployed app URL | build public links |

รายละเอียดเต็มดูที่ `docs/ENV_AND_LINE_SETUP.md`

## Workflow States

Canonical main path:

```
NEW_MESSAGE → COLLECTING_REQUIREMENTS → REQUIREMENTS_REVIEW → WAITING_QUOTE_APPROVAL
→ WAITING_PAYMENT / IN_DESIGN → IN_PRODUCTION → READY_FOR_FULFILLMENT → COMPLETED
```

Explicit side branches:

```
ON_HOLD_CUSTOMER_INPUT
HUMAN_REVIEW_REQUIRED
CANCELLED
```

ดู transition table แบบเต็มที่ `docs/WORKFLOW_TRANSITION_TABLE.md`

## Quote Approval And Payment Gate

- `credit` = อนุมัติแล้วปล่อยเข้า `IN_DESIGN` ได้ทันที
- `deposit` = อนุมัติแล้วจะยังอยู่ `WAITING_PAYMENT` จนกว่าจะเป็น `partial` หรือ `paid`
- `prepaid` = อนุมัติแล้วจะยังอยู่ `WAITING_PAYMENT` จนกว่าจะเป็น `paid`
- การ approve quote ไม่ได้แปลว่าจะสร้าง job เสมอไป

## Smoke Test Checklist

- [ ] `POST /api/webhook` returns 200 with valid signature
- [ ] `POST /api/webhook` returns 401 with invalid signature
- [ ] LINE message → bot replies with Flex Message + LIFF link
- [ ] LIFF page opens inside LINE app (Full size)
- [ ] `liff.requestFriendship()` fires (check console)
- [ ] Safe-area padding visible on Android (no overlap with nav bar)
- [ ] Intake form submit → creates lead + quote in DB
- [ ] Quote link sent to customer via LINE push message
- [ ] `/quote/:token` shows quote with approve button
- [ ] Approve quote moves to `WAITING_PAYMENT` or creates/reuses a job based on payment unlock rules
- [ ] Customer receives LINE notification on status change
- [ ] `/status/:token` shows current job status + timeline
- [ ] `/admin` shows all leads/quotes/jobs/escalations
- [ ] Admin can change job status → triggers LINE notification
- [ ] "คุยกับแอดมิน" creates escalation row
- [ ] Conversation state updates correctly through workflow

## Routes Summary

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | /api/webhook | LINE signature | Webhook handler |
| POST | /api/intake | None (LIFF) | Form submission |
| POST | /api/quotes/[id]/approve | None (public) | Approve quote |
| POST | /api/jobs/[id]/status | None (admin) | Update job status |
| GET | /liff | None | LIFF endpoint (redirect) |
| GET | /liff/intake | None | Intake form |
| GET | /quote/[token] | Public token | Quote page |
| GET | /status/[token] | Public token | Status page |
| GET | /admin | Middleware | Admin dashboard |
