# FOGUS — Digital Signage & Print ERP 2026

## Identity

You are building a LINE OA + LIFF + Next.js ERP system for a Thai print & signage shop.
Stack is locked: Next.js 16.2, Supabase, Vercel, LINE Messaging API, LIFF v2.28.

## Critical 2026 Constraints

These are NON-NEGOTIABLE. Every file you write must follow these:

1. **Supabase keys**: Use `sb_publishable_` / `sb_secret_` — NEVER legacy `anon` / `service_role`
2. **Next.js 16 async params**: All dynamic routes use `async (request, props) => { const { id } = await props.params; }`
3. **LIFF safe area**: Every LIFF page must have `padding-bottom: env(safe-area-inset-bottom)` (Android edge-to-edge since 9 Mar 2026)
4. **LIFF endpoint URL**: Registered as `/liff` in LINE Console, NOT `/liff/intake`
5. **liff.requestFriendship()**: Must be called after `liff.init()` in the intake page
6. **Next.js version**: Pin `^16.2.0` — must include CVE-2026-23869 patch
7. **Turbopack**: Default in Next.js 16 — no `--turbopack` flag needed
8. **React Compiler**: Enabled via `reactCompiler: true` in next.config.ts

## Architecture Overview

```
Customer (LINE) → Webhook → Save msg → Reply LIFF link
                                         ↓
                               LIFF intake form
                                         ↓
                              POST /api/intake
                         (normalize mm, create lead+quote)
                                         ↓
                          Push quote link via LINE
                                         ↓
                        Customer opens /quote/:token
                              clicks approve
                                         ↓
                     POST /api/quotes/:id/approve
                        (create job + timeline)
                                         ↓
                    Admin updates status in /admin
                  POST /api/jobs/:id/status
                                         ↓
                     Push notification → LINE
                   Customer views /status/:token
```

## Workflow States (hardcoded, never derived)

```
NEW_MESSAGE → COLLECTING_INFO → FORM_SUBMITTED → QUOTE_DRAFTED →
WAITING_CUSTOMER_APPROVAL → JOB_CREATED → IN_PROGRESS → COMPLETED

Branch: HUMAN_REVIEW_REQUIRED (keyword escalation or incomplete data)
```

## Project Structure

```
src/
├── app/
│   ├── layout.tsx                        # Root layout
│   ├── page.tsx                          # Redirect → /admin
│   ├── globals.css                       # Tailwind v4
│   ├── api/
│   │   ├── webhook/route.ts             # LINE webhook (verify sig → save → reply)
│   │   ├── intake/route.ts              # LIFF form → lead + quote
│   │   ├── quotes/[id]/approve/route.ts # Approve → create job
│   │   └── jobs/[id]/status/route.ts    # Admin status update
│   ├── liff/
│   │   ├── layout.tsx                   # LIFF SDK CDN + viewport
│   │   ├── page.tsx                     # /liff → redirect /liff/intake
│   │   └── intake/page.tsx              # Intake form (client component)
│   ├── quote/[token]/
│   │   ├── page.tsx                     # Public quote (server component)
│   │   └── approve-button.tsx           # Approve button (client)
│   ├── status/[token]/page.tsx          # Customer status (server)
│   ├── auth/login/page.tsx              # Admin login (client)
│   └── admin/
│       ├── page.tsx                     # Dashboard (server)
│       └── job-actions.tsx              # Status dropdown (client)
├── lib/
│   ├── line.ts                          # LINE SDK: verify, reply, push
│   ├── types.ts                         # Types, constants, pricing, unit conversion
│   └── supabase/
│       ├── client.ts                    # Browser (publishable key)
│       ├── server.ts                    # SSR (publishable key)
│       └── admin.ts                     # Server-only (secret key)
└── middleware.ts                        # Auth check for /admin, exclude webhook/liff/quote/status/auth
```

## Database (9 tables)

conversations, messages, customers, leads, quotes, quote_items, jobs, job_timeline, escalations

Schema: `supabase/migrations/001_initial.sql`

Realtime enabled: conversations, jobs, escalations

## Environment Variables

```
LINE_CHANNEL_SECRET=
LINE_CHANNEL_ACCESS_TOKEN=
LIFF_ID=
NEXT_PUBLIC_LIFF_ID=           # same value, client-side
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=   # sb_publishable_...
SUPABASE_SECRET_KEY=                     # sb_secret_...
NEXT_PUBLIC_BASE_URL=                    # https://your-app.vercel.app
```

## Code Patterns

### Dynamic Route Handler (Next.js 16)
```typescript
export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  // ...
}
```

### Supabase Client Usage
```
Frontend (LIFF, quote page): src/lib/supabase/client.ts (publishable key)
Server Components:           src/lib/supabase/server.ts (publishable key)
API Routes (webhook, intake): src/lib/supabase/admin.ts (secret key)
```

### LINE SDK Usage
```
Webhook:     verifySignature() before any processing
Reply:       replyWithIntakeLink() — Flex Message with LIFF link
Push:        pushQuoteLink() — send quote to customer
             pushStatusUpdate() — notify status change
```

### Unit Conversion
```
All dimensions stored as mm in DB.
toMM(value, unit) converts cm/m/inch/ft → mm.
calculatePrice(productType, widthMm, heightMm, qty) returns subtotal in THB.
```

## Anti-Patterns — DO NOT

- ❌ Use `any` type in TypeScript
- ❌ Use legacy Supabase `anon` / `service_role` keys
- ❌ Use sync params in dynamic routes (removed in Next.js 16)
- ❌ Put `SUPABASE_SECRET_KEY` in client-side code
- ❌ Use Reply Message for async notifications (use Push Message)
- ❌ Store conversation state in memory (serverless = stateless, use DB)
- ❌ Call LINE API without try-catch (push can fail, don't crash the handler)
- ❌ Skip signature verification on webhook
- ❌ Forget safe-area-inset-bottom on LIFF pages
- ❌ Deploy without testing escalation flow

## Testing Commands

```bash
npm run dev          # Local dev (Turbopack, default)
npm run build        # Production build
npm run start        # Start production server

# Smoke test webhook locally:
# Use ngrok to expose localhost, set webhook URL in LINE Console
```

## Escalation Keywords

Bot checks for these Thai keywords in every message:
"คุยกับคน", "คุยกับแอดมิน", "ขอคุยกับคน", "ต้องการคุยกับคน", "admin"

Match → create escalation + set HUMAN_REVIEW_REQUIRED + reply "ทีมงานจะติดต่อกลับ"

## Pricing Config (types.ts)

| Product | Per sqm (฿) | Min charge (฿) |
|---------|------------|-----------------|
| vinyl_banner | 250 | 500 |
| acrylic_sign | 3,500 | 1,500 |
| sticker | 350 | 300 |
| foam_board | 800 | 500 |
| aluminium | 4,500 | 2,000 |
| other | 500 | 500 |

VAT: 7% on top of subtotal. Quote valid for 30 days.

## Deployment

```bash
git init && git add . && git commit -m "init fogus"
npx vercel --prod
# Add env vars in Vercel dashboard
# Set webhook URL in LINE Console: https://your-app.vercel.app/api/webhook
# Set LIFF endpoint URL: https://your-app.vercel.app/liff
```

## When Compacting

Preserve:
- List of modified files
- Current task and progress
- Any bugs found / fixed
- Which workflow states have been tested
