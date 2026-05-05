# Production Owner Review - 2026-05-04

Scope: Browser review on `https://craft-run.vercel.app` from an owner/operator perspective. This is a QA note only; no code fixes were made in this pass.

## Executive Read

Production UAT is up and the core shell is usable. Admin, status lookup, flow reference, studio, product catalog API, and LIFF handoff all respond. I did not see a system-wide blocker such as blank pages, auth loops on admin after login, or broken production build behavior.

The main issues are launch-polish and customer trust issues: customer-facing invalid links fall into a generic English 404, full LIFF form review is gated by LINE Login in production browser, product catalog is currently served from fallback data, and some owner/staff surfaces still read like internal prototypes rather than final Thai operations screens.

## Verified On Production Browser

- `/` without browser session redirects to `/auth/login?next=%2F`.
- `/admin` without browser session redirects to `/auth/login`.
- Authenticated `/admin` loads the operations dashboard.
- `/admin/customers`, `/admin/follow-up`, `/admin/liff-monitor`, `/admin/manual-intake`, `/admin/accounting`, `/admin/settings`, `/admin/prompts`, `/admin/staff`, `/admin/profile` all returned 200 in the logged-in browser session.
- `/flow` returned 200 and rendered the workflow reference.
- `/status` returned 200 and empty tracking input shows Thai validation.
- `/studio` returned 200 and rendered the ops board.
- `/api/intake/product-catalog` returned 200 with active product data.
- `/liff` redirects to `/liff/intake`; `/liff/intake` opens the LIFF shell and then redirects to LINE Login on desktop browser.
- PR #41 checks were green when reviewed.
- Supabase data health for the new document array migration: `empty_document_type_arrays = 0`, `invalid_document_type_arrays = 0`.

## Findings

### P1 - Invalid Customer Links Show Generic English 404

Routes checked:

- `/status/OWNER-REVIEW-NOT-FOUND`
- `/quote/OWNER-REVIEW-NOT-FOUND`

Observed: both show the default Next.js English page: `404 This page could not be found.`

Owner impact: if a customer mistypes or opens an expired/bad tracking code, the experience looks like the website is broken, not like FOGUS handled the case. This should become a Thai recovery page with a clear path back to `/status`, LINE contact, and maybe a short explanation that the tracking code was not found.

### P1 - Production Browser Cannot Fully Review LIFF Form Without LINE Login

Observed: `/liff/intake` and `/liff/intake?devNoLiff=1` both redirect to LINE Login in production browser. `/flow` still mentions `/liff/intake?devNoLiff=1` as if it were a browser-review surface.

Owner impact: fast production QA of the full LIFF form is not possible from a normal browser. Real LINE WebView testing is still required. Either the docs should stop presenting `devNoLiff=1` as a production review path, or we should add an authenticated admin-only preview mode that renders the LIFF form without identity submission.

### P2 - Product Catalog API Is Serving Fallback Data

Route checked: `/api/intake/product-catalog`.

Observed: response includes product data, but `source` is `fallback`.

Owner impact: the customer intake can work, but runtime catalog configuration may not be the active source. Before real customer handoff, confirm whether the production catalog should be admin-managed. If yes, seed/verify runtime catalog settings so staff changes are reflected in LIFF.

### P2 - Studio Surface Still Feels Like Internal Prototype Copy

Route checked: `/studio`.

Observed copy includes `CUTE STUDIO V1`, `Scan the floor`, `Critical path`, `Cashier Gate`, `Playfield`, `Inspector`, and mixed English station language.

Owner impact: the visual idea is useful, but the copy does not yet feel like a Thai owner/operator production screen. If this will be shown to staff or customer-side stakeholders, translate and harden the language around ownership, blockers, and next actions.

### P2 - Staff Page Has A Broken-Looking Empty Heading

Route checked: `/admin/staff`.

Observed headings included `พนักงานและสิทธิ์หลังบ้าน`, `""`, and `akkapol.kumpapug`.

Owner impact: the `""` heading looks like an empty staff display name or data formatting bug. This should be cleaned before handoff because staff/admin pages are trust surfaces.

### P3 - Settings Is Powerful But Dense For Operations

Route checked: `/admin/settings`.

Observed: page renders and has major sections for organization, payment routing, LINE OA/LIFF, product catalog, production upload, and AI. It also has many inputs on one screen.

Owner impact: this is usable for setup, but risky for day-to-day operations because a staff user can easily change sensitive runtime behavior. Consider stronger section-level warnings, save summaries, or separating launch-critical settings from routine settings.

### P3 - Flow Page Mixes Documentation, Internal Hints, And Customer/Agent Language

Route checked: `/flow`.

Observed: useful reference page, but it includes mixed English/internal terms such as `inspect_policy`, `inspect_transition_table`, and `flow page is read-only documentation for customers and agents`.

Owner impact: fine as an internal engineering reference, but too technical if the owner expects it to train shop operators. Either keep it clearly internal or make a Thai operator-friendly version.

### P3 - Vercel Vitals Requests Abort During Rapid Navigation

Observed: repeated `POST /63c411eff223f772/vitals net::ERR_ABORTED` during automated page navigation.

Owner impact: not user-visible in the tested pages and likely caused by rapid route changes. Keep as low-priority monitoring only unless it appears in real user logs.

## Persona Review

### Persona A - Admin / Owner Using Dashboard And Menus

What works:

- The left navigation is structurally clear: CRM, manual intake, customers, follow-up, LIFF monitor, accounting, prompt/AI, staff, profile, settings, and flow are all reachable from one place.
- `/admin` gives a good owner-level summary: total active work, auto-flow count, manual-decision count, customer-waiting count, and commercial-gate count.
- The dashboard shortcuts match the real operating areas instead of generic analytics-only cards.

What feels off from an owner perspective:

- The dashboard still mixes Thai operational copy with English lane names such as `New Leads`, `Quote Decision`, `Payment Ops`, `Design Ops`, `Production Ops`, and `Exceptions`. For a Thai owner/operator surface, that still feels half-finished.
- Some shortcut descriptions are still internal phrasing rather than owner-facing action language. Example: `allowlist`, `prompt`, `runtime`, and `commercial gate` need either clearer Thai or stronger explanation.
- `/admin/settings` is powerful but heavy. It looks like a control room for a technical operator, not a calm owner setup surface. A wrong edit here could change production behavior too easily.
- `/admin/staff` still shows a broken-looking empty heading (`""`), which weakens trust.

Admin conclusion:

- Good enough for internal use right now.
- Not yet polished enough to feel like a final owner-facing backoffice.

### Persona B - Design Team / Preview Team

Primary surfaces reviewed:

- `/studio`
- `/admin/prompts`

What works:

- `/admin/prompts` is the clearest real working surface for design/AI preview today. It shows design brief, prompt override, final prompt, and image-generation state in one place.
- The prompt screen exposes practical actions: `แก้พรอมพ์` and `สร้างภาพตัวอย่าง`.
- `/studio` is useful as an awareness board. It shows where design sits relative to quote, payment, hold, review, and production.

What feels off for a design operator:

- `/studio` still reads like an experimental concept board, not a production design queue. Copy like `Cute Studio V1`, `Scan the floor`, `Critical path`, `Playfield`, and `Inspector` sounds prototype-like.
- The design operator still needs to mentally translate the board into action. `/studio` is good for situational awareness, but `/admin/prompts` looks like the actual work surface.
- `/admin/prompts` is useful but customer identity repetition is visually noisy. Several cards read as the same customer name over and over, which makes scanning harder than it should be.
- The design flow is not yet “approve image and go” only. Someone still has to decide when to edit prompt, when to generate preview, and when to handle failed/pending states.

Design-team conclusion:

- Real work can happen in production now.
- But the design workflow is still semi-manual, not yet a clean assembly line with just approval checkpoints.

### Persona C - Minimal-Human / Auto-Run System

Interpretation:

- The target state is that flow should run automatically as far as possible, with humans only stepping in for image approval or real exceptions.

What currently supports that model:

- Dashboard already separates `ไหลต่ออัตโนมัติ` from `ต้องให้คนตัดสินใจ`, which is the right operating model.
- Commercial gate count can hit zero, meaning payment/doc lock is not always blocking.
- LIFF monitor exists, so failures can be inspected without guessing from customer complaints only.

What still blocks a true minimal-human flow:

- `/admin/follow-up` is explicitly manual. A user must preview recipients, tick a confirmation box, then send follow-up. This is not auto-chase yet.
- `/admin/prompts` is explicitly manual. A user still has to choose whether to edit prompt and when to generate preview.
- `/admin/accounting` is still a review/export surface, not an auto-close commercial document engine. It is good for control, but not “lights out” automation.
- `/admin/liff-monitor` shows incident review and debugging surfaces, which is good operationally, but also confirms that LIFF issues are still expected to be handled by people.
- The queue model on `/admin` shows `ต้องให้คนตัดสินใจ = 7` in the reviewed session. That is too high if the intended operating model is nearly fully automatic.

Minimal-human conclusion:

- The product is not “no people in system” yet.
- The current reality is: auto-assisted operations with clear human checkpoints, especially for follow-up, preview generation, accounting/doc handling, and exception review.
- If the desired end-state is “maybe one human only approves image”, then the biggest remaining gap is not routing. It is manual intervention surfaces that still assume an operator is present throughout the day.

## Not Fully Verified In This Browser Pass

- Real LINE WebView post-deploy LIFF form submission, because production desktop browser is correctly gated by LINE Login.
- True mobile viewport behavior, because the current browser automation did not actually resize below desktop width even when requested.
- Real quote/status pages with valid customer tokens, to avoid opening or logging customer-specific public links in this review pass.
- End-to-end payment/approval/production state mutations, because this pass was review-only and did not intentionally mutate production data.

## Recommended Next Pass

1. Fix customer-safe not-found pages for quote/status tokens.
2. Add or document a safe production LIFF review mode for authenticated admin/browser QA.
3. Confirm runtime product catalog source and seed it if fallback is not intended.
4. Polish `/studio` and `/flow` language for Thai operator/owner use.
5. Clean the empty staff display heading on `/admin/staff`.
6. Run real mobile LINE WebView submit test on the current production alias.
