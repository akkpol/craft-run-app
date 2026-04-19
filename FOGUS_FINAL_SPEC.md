# FOGUS — Final Production Spec (April 2026)

## Stack (Locked)
- Next.js 16.2.x (latest patched)
- Supabase (PostgreSQL + Auth + Storage)
- Vercel (deploy)
- LINE Messaging API + LIFF v2.28.0

## Product Logic In 5 Seconds

```text
CUSTOMER (LINE)
→ LINE OA + MINI APP
→ CONVERSATION BRAIN
→ ERP CORE
	Lead → Quote → Job
→ PAYMENT GATE
→ DESIGN (AI optional)
→ PRODUCTION + DELIVERY

REALTIME DASHBOARD = monitoring layer across the whole system, not the final workflow state.
```

## Delivery Priority

### P0 — Must Work Before Anything Else

- Workflow state machine
- `Lead -> Quote -> Job` record flow
- Payment unlock rules
- Job creation only after payment terms unlock production

Reason:
This is the non-negotiable ERP control layer. If this is wrong, the system can approve or produce work at the wrong time.

### P1 — Must Be Usable Right After Backbone

- Quote approval and commercial update surfaces
- Customer quote and status pages
- Admin job and conversation actions
- Production tracking and timeline visibility

Reason:
This is the minimum operational layer that lets the team run real work through the system.

### P2 — Valuable But Not Backbone-Critical

- AI design assist and preview loop
- `/studio` scene and dashboard polish
- Better visual bottleneck reporting and presentation layers

Reason:
These improve conversion, speed, and clarity, but the business can still operate without them if P0 and P1 are stable.

### Shortest Priority Rule

- If there is a tradeoff, do `Payment Gate` before `AI Design`.
- If there is a tradeoff, do runtime workflow correctness before dashboard polish.

## Vercel Cost Decision

### Recommended Baseline

- `Hobby` is free, but Vercel documents it as non-commercial, personal-use oriented.
- `Pro` is the realistic baseline for this ERP if it is going to a real customer.
- `Enterprise` is not necessary for the current stage of FOGUS.

### What Pro Means Right Now

- `Pro` has a `$20/month` platform fee.
- that includes `1` deploying seat and `$20/month` usage credit.
- additional deploying members cost `$20/month` per seat.
- unlimited read-only viewer seats are included.

### Practical Reading For FOGUS

- if this is still internal development or personal validation, `Hobby` is enough to test.
- if this becomes a real customer deployment, choose `Pro` first.
- if only one person deploys and manages the system, the starting platform cost is small enough to treat as normal operating overhead.
- the main cost risk is not the base plan; it is extra usage from traffic, functions, images, and optional Sandbox usage.

### Vercel Sandbox Cost Note

- `Sandbox` on Hobby includes a small free monthly allotment and then pauses when limits are exceeded.
- on `Pro`, Sandbox usage is metered against the monthly credit and then billed on-demand.
- for this repo, Sandbox is useful for isolated testing, but it is not required to launch the ERP.

## Central Remaining Work

This section is the single place to decide what is still left before customer handoff and what can wait.

### Already Verified

- clean `npm run build` passes
- `npm run lint` baseline was recorded as pass with warnings only
- `npm run check:workflow-policy` baseline was recorded as pass
- canonical workflow and payment-gate model are already in place
- action-log foundation and route wiring are mostly implemented in code

### Must Finish Before Real Customer Go-Live

#### 1. Environment And Console Wiring

- provision customer Supabase project and apply migrations
- configure Vercel environment variables correctly
- set LINE Messaging API webhook to `/api/webhook`
- set LIFF endpoint to `/liff`
- verify `/admin/settings` writes the expected runtime config

Why this is still open:

- these are handoff and deployment tasks, not guaranteed by local build success

#### 2. End-To-End Acceptance Flow

- verify webhook signature success and failure cases
- verify LINE chat to LIFF to intake to quote creation
- verify quote approval matrix for `credit`, `deposit`, and `prepaid`
- verify status page and timeline rendering
- verify admin-triggered LINE notifications
- verify escalation keywords and manual-review routing

Why this is still open:

- the smoke checklist in this spec and `README.md` is still unchecked

#### 3. Admin Access Hardening

- stop relying on public sign-up for backoffice access
- keep customer flow login-free
- restrict `/admin` to explicitly allowed staff/admin accounts

Why this is still open:

- auth exists, but it is still too permissive for a production backoffice model

### Important Next After Go-Live Blockers

#### 4. Staff Profile And Ownership Model

- add first-class staff/admin profile model
- replace free-text ownership such as `assigned_to` and `assigned_designer` over time
- make named ownership visible in admin and `/studio`

Why this matters:

- this is the biggest current operations-model gap once more than one staff member is involved

#### 5. Action Tracking Verification

- verify `action_ref` generation and actor typing through manual tests
- confirm build, lint, and workflow checks after the full action-tracking rollout
- collect evidence for handoff and disputes

Current status:

- route-level logging is already wired broadly in code
- remaining work is mainly verification and evidence capture

#### 6. Customer Handoff Package

- prepare release evidence and screenshots
- create operations runbook
- document key rotation and rollback path
- obtain customer sign-off and schedule hypercare window

### Valuable But Safe To Delay

#### 7. AI Provider Expansion

- keep AI optional until backbone and handoff are stable
- refactor image generation from `openai-only` to provider adapter
- add `gemini` only after provider abstraction and settings constraints are updated

Current status:

- AI is already optional in workflow design
- implementation is still provider-locked to OpenAI

#### 8. `/studio` Operations Surface

- refactor `/studio` into the intended scene-first ownership view
- make blockers, owner, and station flow readable in 5 seconds

Current status:

- route exists and builds
- concept direction is chosen
- visual refactor is still pending

#### 9. Product Master / Catalog

- move product types and pricing rules from code constants toward admin-managed data if needed

When to do this:

- only when catalog and pricing start changing often enough to justify the extra system surface

## Shortest Go-Live Read

- deploy on `Vercel Pro` if this is a real customer project
- finish environment wiring and E2E acceptance first
- harden admin login before multi-user rollout
- treat `staff/admin profile` as the next real product gap
- keep `Gemini` and `/studio` as controlled follow-up work, not launch blockers

## Actor Use Cases

### Customer

What the customer does:

- starts in LINE OA chat
- opens LIFF mini app
- submits real job requirements
- receives quote
- approves or rejects quote
- waits for payment unlock when required
- reviews design preview when applicable
- tracks status and receives delivery or pickup outcome

What the system must do for the customer:

- keep entry friction low in LINE
- preserve conversation state correctly
- generate or route to quote flow
- never advance to production before payment rules allow it
- expose quote and status pages safely by token

### Conversation Brain

This is the system decision layer, not a human role.

What it does:

- receives inbound messages
- determines whether the user is still collecting requirements, ready for quote, or needs escalation
- creates or reuses conversation context
- pushes the next correct state into the ERP path
- hands off to human review when the request cannot continue safely

### Admin Sales / Quoting

What this actor does:

- reviews lead details
- adjusts quote line items and price
- sends commercial decision forward
- manages quote approval exceptions

Primary system surfaces:

- admin dashboard quote tables
- quote approval surfaces
- commercial update flow

### Cashier / Commercial Admin

What this actor does:

- records payment terms
- updates payment status
- unlocks the flow from `WAITING_PAYMENT` to `IN_DESIGN` when rules are satisfied

Why this matters:

- this is the gate that prevents the ERP from creating or advancing work too early

### Designer

What this actor does:

- prepares design output
- sends preview
- handles revision loop
- marks design as approved or still waiting on customer response

Important note:

- AI can assist here, but design is still a workflow stage even when no AI is used

### AI Design Assist

This is not a standalone business actor. It is an optional executor mode inside the design stage.

What it does:

- generates mockup ideas or preview assets
- supports faster first-pass design
- shortens revision cycles when used well

What it must not do:

- bypass payment gate
- replace workflow ownership
- become a required dependency for every job

### Production Staff

What this actor does:

- receives jobs only after payment and design conditions are cleared
- produces the work
- updates production status and evidence
- hands off to fulfillment

### Dispatch / Fulfillment

What this actor does:

- prepares delivery or pickup
- completes the order handoff
- closes the job into `COMPLETED`

### Owner / Product Admin

What this actor does:

- configures company profile and base settings
- manages LINE, LIFF, base URL, and upload settings
- monitors bottlenecks, revenue flow, and operational risk

This is a configuration and oversight role, not the core transaction path.

## Profile Status And Gaps

### Customer Profile

Current status:

- exists in the database through `customers`
- keyed by `line_user_id`
- currently stores minimal identity such as `display_name` and `phone`
- gets refreshed from LINE profile fetch during webhook and intake flow

Assessment:

- not missing
- but still thin; this is a lightweight customer profile, not a full CRM profile

### Company Profile

Current status:

- partially exists in `app_settings`
- supports business name, phone, email, logo, and company profile asset

Assessment:

- not missing for v1
- enough for document branding and public-facing business identity

### Staff / Admin Profile

Current status:

- missing as a first-class model
- assignment is currently represented by free-text fields such as `assigned_to` and `assigned_designer`
- access control is handled through auth session checks, not a staff directory with explicit roles

Assessment:

- this is the real profile gap in the current system
- it becomes important as soon as `/studio`, ownership, workload routing, or multi-staff accountability matter

Recommended urgency:

- `P1` if multiple staff need named ownership and reporting
- `P2` if one admin still operates most of the workflow alone

### AI Profile

Current status:

- should not be modeled as a person profile
- already represented correctly as execution metadata through `design_assignment_mode` and `design_executor`

Assessment:

- not missing
- do not turn AI into a fake user table unless audit requirements truly demand it

### Product Profile / Product Master

Current status:

- product types currently live in code constants, mainly in `src/lib/types.ts`
- there is no first-class admin-managed product catalog table yet

Assessment:

- this is a second real gap, but less urgent than payment and staff ownership
- it matters when the business wants editable product rules, dynamic pricing inputs, or product-specific admin settings

Recommended urgency:

- `P2` unless pricing and catalog changes happen frequently

## What Is Missing Versus What Is Urgent

- Missing and urgent first: staff/admin profile if the team needs real named ownership in operations
- Missing but not urgent first: richer customer CRM profile
- Missing but optional for now: product master as an admin-managed model
- Not missing: AI profile; keep AI as execution metadata, not a human account

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
- `AI_WORKFLOW_GUARD.md` = required read order and enforcement rules for workflow-sensitive work
- `docs/workflow-policy.json` = canonical machine-readable workflow contract
- `src/lib/workflow-policy-core.mjs` = runtime helper layer that loads and enforces the policy
- `src/lib/types.ts` = canonical workflow states and shared workflow enums
- `src/lib/workflow-transitions.ts` = allowed conversation and job transition maps
- `src/lib/quote-workflow.ts` = payment gate and job-creation rules
- `src/app/api/intake/route.ts` = intake-driven workflow entry and requirement review branching
- `src/app/api/quotes/public/[token]/route.ts` = customer quote-page workflow surface
- `src/app/api/quotes/[id]/commercial/route.ts` = post-approval payment and commercial unlock updates
- `src/app/status/[token]/customer-status-actions.tsx` = customer status-page workflow actions
- `src/app/quote/[token]/approve-button.tsx` = customer quote approval UI contract
- `docs/WORKFLOW_TRANSITION_TABLE.md` = human-readable derivative summary, not the canonical source

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
