---
title: FOGUS Reality Analysis Map v1
date: 2026-05-03
status: analysis-baseline
scope: LINE, LIFF, workflow policy, customer/admin UI control points
branch: dev/commercial-document-core
---

# FOGUS Reality Analysis Map v1

This is not the final operating-flow freeze.

This document maps what the system actually does today, where policy must be strict, and which UI rules should be locked before the next coding round. The goal is to stop rebuilding from vague intent. Each future implementation slice should start from this map, then update it when reality changes.

## Source Hierarchy For This Analysis

| Layer | Source | How to treat it |
| --- | --- | --- |
| Runtime state truth | `docs/workflow-policy.json`, `src/lib/workflow-transitions.ts`, `src/lib/workflow-policy-core.mjs` | Canonical for current state/CTA rules |
| LINE entry truth | `src/app/api/webhook/route.ts`, `src/lib/line.ts` | Canonical for returning customer behavior |
| LIFF intake truth | `src/app/liff/intake/intake-form.tsx`, `src/app/api/intake/route.ts` | Canonical for customer form, validation, quote creation |
| Quote/status truth | `src/app/quote/[token]/page.tsx`, `src/app/status/[token]/page.tsx`, `src/app/api/quotes/public/[token]/route.ts` | Canonical for public customer actions |
| Admin operating truth | `src/app/admin/page.tsx`, `src/lib/admin-overview.ts`, `src/lib/backoffice-automation.ts`, `src/app/admin/quote-actions.tsx` | Canonical for current backoffice operations |
| Commercial rule truth | `docs/COMMERCIAL_DOCUMENT_POLICY_V1.md`, `docs/COMMERCIAL_DOCUMENT_BUSINESS_FLOW_V1_FREEZE.md` | Canonical for receiver/document policy |
| Future ideas | `src/app/liff/intake/End-to-End.md` | Useful ideas only; not runtime truth |
| Demo shell | `src/app/dashboard/page.tsx`, `src/app/dashboard/data.json` | Not operating truth; should not drive workflow decisions |

## Reality Summary

The system already has a strong workflow spine, but the UI is not fully locked around that spine.

Current reality:

- LINE can route returning customers by conversation state.
- LIFF can verify identity, collect structured order data, validate tax/document fields, create lead, calculate price, create quote, and push quote link.
- Public quote page can approve/reject/rescope and show payment instructions from a payment profile snapshot.
- Status page can show job/design state and let customers resolve hold, approve design, or request revision.
- Admin page has a real overview queue, automation counters, and quote/payment/receiver actions.
- `/dashboard` is still demo-style UI and should not be used as the operating command center.

Main risk:

```text
System can move fast from LIFF -> quote -> payment instructions,
but payment receiver, commercial document rules, and admin UI gates are not yet strict enough
to guarantee every customer sees the right next action and every operator sees the right blocker.
```

## Actual Flow Map

### 1. LINE Entry And Re-Entry

Actual behavior:

| Customer situation | Current system behavior | Reality status |
| --- | --- | --- |
| New text message, no reusable conversation | Creates conversation and replies with LIFF intake link | Working |
| Existing early conversation | Offers resume or fresh intake | Working |
| `WAITING_QUOTE_APPROVAL` | Sends quote context/link, not generic resume | Working |
| `WAITING_PAYMENT` | Sends payment/status context, not generic resume | Working |
| `IN_DESIGN`, `IN_PRODUCTION`, `READY_FOR_FULFILLMENT` | Sends production/status context | Working |
| `COMPLETED` or `CANCELLED` | Sends fresh intake invitation | Working |
| Customer types human-support keywords | Creates escalation and moves to `HUMAN_REVIEW_REQUIRED` | Working |

Strict policy needed:

- LINE must never show a generic intake CTA when the customer is waiting on quote, payment, design response, production, or fulfillment.
- LINE must keep one primary action per state.
- LINE copy should be state-specific and should not expose internal errors.

UI issue to lock:

- Flex message styling/copy should become a reusable contract. Right now each reply type manually defines copy, color, button labels, and icons.
- Quote-waiting reply includes a fresh-intake button. That can be useful, but it is risky because it allows customer to branch away while a quote is active. It should be governed by explicit policy: fresh intake is secondary, visually quieter, and must not look like the main path.

### 2. LIFF Entry

Actual behavior:

- `/liff` redirects to `/liff/intake` and preserves query hints like category/product/mode/devNoLiff/lineUserId.
- `/liff/intake` loads runtime app config and disables LIFF only for local/dev test conditions.
- Customer identity is required in production through LIFF ID token.
- Access token enrichment is best-effort and logs incidents if enrichment fails.

Strict policy needed:

- Production intake must require verified LINE identity.
- Dev bypass must stay development-only.
- LIFF identity failure should block submit, not create anonymous customer records.

UI issue to lock:

- Intake should show an explicit identity readiness state before submit: ready, reconnect from LINE, or local test mode.
- Error copy should tell the customer the next action, not just that identity failed.

### 3. LIFF Form Reality

Actual collected groups:

| Group | Current fields |
| --- | --- |
| Work basics | product type, width, height, unit, quantity, due date |
| Contact | phone, LINE user ID/display name from LIFF |
| Fulfillment | pickup/delivery/install, address fields, optional latitude/longitude |
| Document intent | requested document type, billing entity type, branch type/code, billing name, tax ID, billing address |
| Design context | design brief, note, reference info, reference files |
| Runtime metadata | intake mode, LIFF access token, LIFF context snapshot |

Client validation currently blocks:

- no product type
- non-positive width/height
- no phone
- no due date or past due date
- no fulfillment mode
- incomplete delivery/install address
- incomplete latitude/longitude pair
- non-numeric latitude/longitude
- tax invoice missing billing name/tax ID/address/branch code when needed
- missing LIFF ID token in configured LIFF mode

Server validation additionally blocks:

- invalid JSON/form payload
- invalid payment terms, billing type, document type, intake mode
- invalid customer media files
- invalid LIFF token
- invalid fulfillment geolocation bounds
- incomplete tax invoice details

Reality status:

- Form validation is stronger than before.
- The form can still create a quote immediately if data is complete.
- Reference upload failure is non-blocking: lead/quote survives and customer receives warning.

Strict policy needed:

- LIFF form is not just an inquiry form; it is quote-triggering input.
- Any field that affects quote total, document identity, payment routing, or fulfillment cost must be explicit and reviewable.
- Tax invoice request only validates customer profile data today; it does not by itself guarantee the receiver can issue VAT documents.

UI issue to lock:

- Keep progressive disclosure, but each collapsed section must show a reliable summary chip.
- Required fields must be visible before submit when their condition is selected.
- Tax/document section should show: customer request is captured, final eligibility depends on receiver chosen by admin.
- Fulfillment mode should visibly affect required address/location fields.

### 4. Intake Submit To Quote Creation

Actual behavior:

```text
LIFF submit
-> verify identity
-> upsert customer
-> reuse or create conversation
-> optional fresh restart cancels/supersedes old work
-> create lead
-> upload media if present
-> if incomplete, move to ON_HOLD_CUSTOMER_INPUT
-> if complete, calculate price
-> resolve payment profile snapshot
-> create quote status=sent
-> create quote item
-> set conversation WAITING_QUOTE_APPROVAL
-> push quote link via LINE
```

Reality status:

- This is already a semi-automated sales flow.
- Pricing can come from product catalog or fallback calculator.
- Payment profile is selected at quote creation from settings using total, billing entity type, and payment terms.

Strict policy needed:

- Auto-quote is only safe for products/pricing rules the business trusts.
- If product/pricing is uncertain, quote should become admin review, not auto-sent.
- Payment profile snapshot is not the same as commercial receiver lock.

UI issue to lock:

- Customer submit success should clearly say whether quote was sent or staff review is needed.
- Admin queue should show whether a lead was auto-quoted or parked for review.
- Quote page should display why a payment profile was selected, but not imply commercial document eligibility is settled.

### 5. Public Quote Page Reality

Actual behavior:

- Displays bill-to data from lead/customer.
- Displays requested document type and tax ID if captured.
- Shows quote items, VAT, total, payment terms/status.
- Shows payment instructions from payment profile snapshot or current config fallback.
- Allows approve/reject/rescope depending on quote/job/payment state.
- If approved but payment still gates work, allows rescope but not approve again.

Reality status:

- Customer actions are reasonably policy-driven.
- Payment instructions can appear on quote page based on payment profile readiness.
- Commercial receiver policy is not yet customer-visible on quote page.

Strict policy needed:

- Quote page must not show payment instructions that conflict with receiver/document policy.
- Approval CTA must disappear after payment gate begins.
- Rescope should be allowed only while no job exists.
- Rejection should be blocked after job exists.

UI issue to lock:

- Payment panel must show the next customer action, not all possible accounting context.
- If receiver/document eligibility is missing, quote should direct customer to wait for admin payment instruction instead of showing risky account details.

### 6. Payment Routing Reality

Current payment routing supports:

- primary payment profile
- secondary payment profile
- secondary selection by total threshold
- secondary selection by customer type: person/company/all
- secondary selection by payment term: prepaid/deposit/credit/non-credit/all
- fallback to secondary when primary is missing

Reality gap:

```text
Payment profile routing chooses account display data,
but commercial policy needs receiver entity identity.
Those are related but not yet the same model.
```

Strict policy needed:

- Every payment profile/channel must map to a commercial receiver entity before fully automatic payment instructions are safe.
- If customer requests tax invoice, payment channel must map to a VAT-capable receiver.
- The invariant is: money receiver = document issuer.

UI issue to lock:

- Settings should not present payment profile configuration as complete unless receiver mapping is complete.
- Admin quote action should show receiver status before payment capture.
- Customer quote/payment panel should hide or soften account details when receiver is not safe.

### 7. Admin Operating Reality

Actual `/admin` behavior:

- Fetches runtime config, backoffice snapshot, automation snapshot, and overview page.
- Shows summary counts: system-managed, auto-flowing, needs human now, waiting on customer.
- Overview rows cover escalations, blocked conversations, waiting customer, quote, production review, and running job.
- Quote actions include payment term/status changes, deposit/paid capture, receiver selection, rescope, reject.

Actual `/dashboard` behavior:

- Uses demo components and `data.json`.
- It is not the operating truth.

Strict policy needed:

- Development should treat `/admin` as the backoffice operating surface.
- `/dashboard` should be renamed/removed/repositioned later, or made intentionally non-operational, to avoid duplicate admin concepts.

UI issue to lock:

- Admin UI must be queue-first, not chart-first.
- Each row should answer: what is the blocker, who owns it, what action is safe now.
- Actions should be blocked with reasons, not merely hidden.

### 8. Status Page Reality

Actual behavior:

- Status page resolves by quote public token.
- If quote is still sent, status page links back to quote approval.
- Shows current job status, fulfillment-aware labels, tracking code, job details, price, latest notes, design status/images, customer actions, and timeline.
- Customer can resolve hold, approve design, or request revision only when the current state allows it.

Reality gap:

- If no job exists yet, status display can be less meaningful because it is job-driven.
- Payment/commercial document state is not fully represented as a first-class status page step.

Strict policy needed:

- Status page must not look empty or confused before job exists.
- Payment confirmation and document issue should become visible steps once commercial gating is enforced.

UI issue to lock:

- Status page should be state-machine driven, not just job-driven.
- Timeline should include quote/payment/document milestones, not only job timeline.

## Policy Gates That Need To Be Strict

| Gate | Current reality | Required strict rule | UI implication |
| --- | --- | --- | --- |
| LINE re-entry | Mostly implemented | No generic intake CTA for mid-flow customers | One primary action per state |
| LIFF identity | Server blocks missing/invalid token in production | No anonymous production intake | Show identity readiness before submit |
| Auto quote | Complete form can auto-create quote | Only trusted product/pricing paths should auto-send | Admin review lane for uncertain pricing |
| Tax profile | Validates customer tax fields | Tax invoice still depends on receiver VAT capability | Show request captured, eligibility pending receiver |
| Payment profile | Snapshot selected at quote creation | Profile must map to receiver entity before safe auto-pay | Settings readiness warning and quote payment guard |
| Receiver lock | Admin receiver selection exists | Receiver selected before usable payment confirmation; locked after payment | Receiver badge/action before payment capture |
| Commercial documents | Policy says receiver=document issuer | Document issue must follow locked receiver | Customer status step for receipt/tax doc |
| AI prompt | Prompt composition exists, generation is explicit | AI draft is assistive, not final business action | Show AI ready/manual fallback, not magic automation |
| Production start | Quote workflow can unlock by payment terms | Production must also respect commercial gate | Block move-to-production with exact missing prerequisites |
| Completion | Job can complete | Completion must mean fulfillment/evidence/document path is resolved | Completion checklist before close |

## UI Lock Rules For Faster Coding

These are the UI rules that should be locked before more feature work. They are intentionally practical.

### Rule 1: One Canonical Surface Per Actor

| Actor | Canonical surface |
| --- | --- |
| Customer intake | LINE + `/liff/intake` |
| Customer quote decision | `/quote/[token]` |
| Customer progress/feedback | `/status/[token]` |
| Admin/operator | `/admin` |
| Settings owner | `/admin/settings` |
| Demo/dashboard experiments | `/dashboard` only if clearly marked non-operational |

No future code should add a second surface for the same actor/task without a decision record.

### Rule 2: Every State Has One Primary CTA

| State/context | Customer primary CTA | Admin primary CTA |
| --- | --- | --- |
| New/collecting | Open LIFF intake | Review latest message/intake |
| Requirements review | Wait or provide missing info | Prepare/send quote or mark hold |
| Waiting quote approval | Approve/rescope quote | Follow up or rescope |
| Waiting payment | Send payment proof / contact admin | Confirm receiver, payment, document gate |
| In design | Approve/request design revision only when preview is sent | Generate/manual design/send preview |
| In production | View status/contact admin | Upload/review production evidence |
| Ready for fulfillment | Coordinate pickup/delivery/install | Close fulfillment package |
| Completed | Start new work if needed | Audit/history only |

Secondary actions may exist, but they must be visually quieter and never compete with the primary action.

### Rule 3: Blockers Must Be Visible With Owner

Admin rows should expose these fields conceptually:

```text
current state
blocked reason
owner: customer | admin | owner | finance | design | dev
safe next action
unsafe actions and why they are blocked
```

This prevents UI from becoming odd because every button is justified by policy.

### Rule 4: Settings Need Readiness, Not Just Inputs

Settings should show readiness groups:

- LINE ready: channel token + secret + base URL + webhook URL.
- LIFF ready: LIFF ID + base URL + valid redirect behavior.
- Payment ready: primary/secondary channel data complete.
- Commercial ready: each channel mapped to receiver entity and VAT status.
- AI ready: enabled + provider + model + key present.
- Production ready: upload/review/send settings configured.

Each group should return:

```text
ready | missing | risky
```

### Rule 5: Customer UI Must Hide Internal Complexity

Customer should not see:

- provider names unless useful to the business
- database state labels
- commercial entity internals
- stack/provider failure details
- multiple conflicting next actions

Customer should see:

- what we received
- what is waiting
- what they need to do next
- when the team owns the next step

### Rule 6: Admin UI Must Show Policy Consequences

Admin can see complexity, but it must be structured:

- receiver affects receipt/tax invoice issuer
- payment term affects unlock behavior
- AI failure affects design path but not order existence
- production start depends on quote, payment, document, and design gates

### Rule 7: Do Not Let Demo UI Become Product UI

`/dashboard` currently reads as generic analytics/demo UI. It should not influence business workflow design.

If reused later, it must either:

- become a true owner analytics surface, or
- be removed/renamed to avoid confusing it with `/admin`.

## Immediate Gaps To Fix Before Final Flow Freeze

1. Map payment profiles to commercial receiver entities.
2. Decide whether quote page can show payment instructions before receiver is selected.
3. Add a policy-level customer/admin UI contract for payment/document gate.
4. Make status page show pre-job states cleanly: quote approval, waiting payment, document issue.
5. Add settings readiness indicators.
6. Make admin overview rows show blocker owner and safe next action consistently.
7. Decide how credit-term jobs pass commercial/document gate.
8. Define AI fallback UI: not configured, quota/billing failure, provider failure, storage failure, manual design path.

## Recommended Next Coding Packets

Work should continue in small packets from reality to policy to UI:

1. Policy packet: add payment/document gate to workflow policy and UI contract.
2. Settings packet: add readiness model for LINE/LIFF/payment/commercial/AI/production.
3. Commercial mapping packet: map payment profiles/channels to receiver entities.
4. Quote UI packet: hide or guard payment instructions until receiver/document risk is resolved.
5. Admin queue packet: show blocker owner and safe next action in `/admin` rows.
6. Status UI packet: make status page state-machine driven before job exists.
7. Dashboard cleanup packet: remove or reposition `/dashboard` as non-operational.

## How To Use This Map

Before coding a workflow/UI change, answer these questions:

1. Which actor owns this step?
2. Which canonical surface should change?
3. Which workflow state or policy gate controls the CTA?
4. What is the one primary action?
5. What action must be blocked, and what reason should the UI show?
6. Does this change affect payment receiver or document issuer?
7. Does this change create AI automation, or only AI assistance?

If the answer is unclear, update this map or create a decision doc before writing feature code.
