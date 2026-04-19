# Locked Spec

Source documents for deeper context:
- `../../../../CLAUDE.md`
- `../../../../FOGUS_FINAL_SPEC.md`
- `../../../../package.json`
- `../../../../next.config.ts`

## Locked stack
- Next.js `^16.2.0`
- React `^19.1.0`
- Supabase via `@supabase/ssr` and `@supabase/supabase-js`
- Vercel deployment
- LINE Messaging API and LIFF v2.28
- React Compiler enabled in `next.config.ts`

## Non-negotiable constraints
1. Use Supabase `sb_publishable_` and `sb_secret_` keys, not legacy `anon` or `service_role` keys.
2. In all dynamic routes, await `props.params` before reading `id` or `token`.
3. Add `padding-bottom: env(safe-area-inset-bottom)` to every LIFF page.
4. Register LIFF at `/liff`, not `/liff/intake`.
5. Call `liff.requestFriendship()` after `liff.init()`.
6. Keep Next.js pinned to 16.2.x or later patched 16.2 releases.
7. Prefer Supabase UI Library blocks `password-based-auth` and `dropzone` when relevant.
8. Turbopack is default in Next.js 16; do not add `--turbopack`.

## Environment variables
```env
LINE_CHANNEL_SECRET=
LINE_CHANNEL_ACCESS_TOKEN=
LIFF_ID=
NEXT_PUBLIC_LIFF_ID=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
NEXT_PUBLIC_BASE_URL=
ADMIN_EMAIL=
ADMIN_PASSWORD=
```

## Workflow states
```text
NEW_MESSAGE -> COLLECTING_REQUIREMENTS -> REQUIREMENTS_REVIEW ->
WAITING_QUOTE_APPROVAL -> WAITING_PAYMENT? -> IN_DESIGN ->
IN_PRODUCTION -> READY_FOR_FULFILLMENT -> COMPLETED

Side branches: ON_HOLD_CUSTOMER_INPUT, HUMAN_REVIEW_REQUIRED, CANCELLED
```

Behavior notes:
- `POST /api/intake` moves complete submissions to `WAITING_QUOTE_APPROVAL` and incomplete submissions to `ON_HOLD_CUSTOMER_INPUT`.
- `POST /api/quotes/[id]/approve` may stop at `WAITING_PAYMENT`; it only creates a job when payment terms unlock production.
- Jobs start at `IN_DESIGN`, not `JOB_CREATED`, and advance through explicit operational states.

## Route contract
- `POST /api/webhook`
- `POST /api/intake`
- `POST /api/quotes/[id]/approve`
- `POST /api/jobs/[id]/status`
- `GET /liff`
- `GET /liff/intake`
- `GET /quote/[token]`
- `GET /status/[token]`
- `GET /admin`

## Expected project structure
```text
src/app/api/webhook/route.ts
src/app/api/intake/route.ts
src/app/api/quotes/[id]/approve/route.ts
src/app/api/jobs/[id]/status/route.ts
src/app/liff/page.tsx
src/app/liff/intake/page.tsx
src/app/quote/[token]/page.tsx
src/app/status/[token]/page.tsx
src/app/admin/page.tsx
src/lib/line.ts
src/lib/types.ts
src/lib/supabase/client.ts
src/lib/supabase/server.ts
src/lib/supabase/admin.ts
src/middleware.ts
```

## Database model
Nine tables are part of the intended model:
- `conversations`
- `messages`
- `customers`
- `leads`
- `quotes`
- `quote_items`
- `jobs`
- `job_timeline`
- `escalations`

Realtime is expected for `conversations`, `jobs`, and `escalations`.

## Implementation patterns

### Dynamic route handler pattern
```ts
export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
}
```

### Supabase client split
- Browser code: `src/lib/supabase/client.ts`
- Server components and SSR: `src/lib/supabase/server.ts`
- Server-only API logic: `src/lib/supabase/admin.ts`

### LINE behavior
- Verify webhook signatures before processing.
- Reply with the LIFF link during the webhook turn.
- Use Push messages for quote links and later status updates.
- Wrap LINE API calls in try/catch so failed pushes do not crash handlers.

### Pricing and units
- Store dimensions in mm.
- Convert `cm`, `m`, `inch`, and `ft` to mm at intake.
- Calculate pricing by product type, area, quantity, minimum charge, and 7 percent VAT.
- Quote validity is 30 days.

## Escalation keywords
Check all incoming messages for these Thai phrases plus `admin`:
- `คุยกับคน`
- `คุยกับแอดมิน`
- `ขอคุยกับคน`
- `ต้องการคุยกับคน`
- `admin`

Matching messages should create an escalation, set `HUMAN_REVIEW_REQUIRED`, and reply that the team will follow up.

## Anti-patterns
- Do not use `any` in TypeScript.
- Do not expose `SUPABASE_SECRET_KEY` to client code.
- Do not keep conversation state in memory.
- Do not skip webhook signature verification.
- Do not forget LIFF safe-area padding.
- Do not replace Push messages with Reply messages for delayed notifications.
- Do not silently change workflow states or rename public routes.

## Validation targets
- Webhook returns `200` on the production URL.
- Invalid signatures are rejected.
- The bot replies with a LIFF link after a customer message.
- LIFF opens inside LINE and prompts friendship correctly.
- Intake submission creates a lead and either a quote or an `ON_HOLD_CUSTOMER_INPUT` state when data is incomplete.
- Quote approval either creates a job and timeline entry or parks the workflow at `WAITING_PAYMENT`, depending on payment terms.
- Admin can view leads, quotes, jobs, and escalations.
- Status page reflects the latest job status.
- Escalation flow works.
- No LIFF init console errors appear.
