---
title: FOGUS Automation Brainstorm v1
date: 2026-05-03
status: brainstorm
scope: automation opportunities across CRM, LIFF, quote, payment, commercial documents, design, production, fulfillment, and operations
branch: dev/commercial-document-core
depends_on: docs/FOGUS_REALITY_ANALYSIS_MAP_V1.md
---

# FOGUS Automation Brainstorm v1

This is a long-form brainstorm, not an implementation freeze.

The goal is to maximize automation without making the system unsafe, confusing, or expensive to operate. Automation should reduce customer back-and-forth, reduce admin typing, and keep business policy strict. It should not hide blockers, bypass approvals, or send customers back to LIFF for problems owned by admin, finance, owner, dev, provider, or production.

Core idea:

```text
Automate when data is valid, policy is known, confidence is high, rollback/audit exists, and the next action owner is clear.
Escalate when any of those are missing.
```

## Automation Operating Principle

Automation should be built around a shared CRM lead draft/table. LINE, LIFF, admin quick-add, web forms, and future channels are input adapters. They collect or edit data, but the CRM readiness engine decides what happens next.

The system should avoid full resubmission. Every step should ask for the smallest missing delta.

```mermaid
flowchart TD
	A[Channel input] --> B[Validated intake envelope]
	B --> C[Shared CRM lead draft/table]
	C --> D[Readiness engine]
	D --> E{Can auto advance?}
	E -->|yes| F[Run automated next action]
	E -->|no, customer data missing| G[Ask only missing customer fields]
	E -->|no, internal decision needed| H[Admin/finance/owner/dev queue]
	F --> I[Audit + notify + update status]
	G --> C
	H --> C
	I --> C
```

## Automation Ladder

Not all automation has the same risk. Use this ladder to decide what can be automatic first.

| Level | Name | What the system can do | Risk | Example |
| --- | --- | --- | --- | --- |
| A0 | capture | store incoming data and files | low | save LINE profile, form fields, uploaded media |
| A1 | normalize | clean, dedupe, validate, classify | low | normalize phone, map product keyword to catalog |
| A2 | suggest | propose action but require staff click | medium | suggest quote price, suggested receiver entity |
| A3 | reversible auto action | auto do something that can be safely corrected | medium | assign queue, send missing-info link, mark draft incomplete |
| A4 | business auto action | auto send customer-facing or money-related action | high | send quote, payment instruction, status message |
| A5 | restricted action | never fully auto until policy and audit are mature | critical | receiver lock, tax invoice issue, refund, cancellation with payment |

Default stance:

- Start A0 to A2 everywhere.
- Use A3 for operational routing and customer delta requests.
- Use A4 only when product, price, fulfillment, payment, and document policy are explicit.
- Keep A5 behind human/owner/finance approval until the system has enough proof.

## Central Data Contract

The shared CRM lead draft should become the automation contract. Each channel writes to the same shape.

Suggested CRM draft fields:

| Group | Fields | Used for automation |
| --- | --- | --- |
| source | source_channel, source_detail, source_message_id, source_url, created_by_actor_id | dedupe, audit, resume/fresh decisions |
| identity | customer_id, line_user_id, display_name, phone, email, tax_id, company_name | customer matching and contactability |
| contact | primary_contact_method, contact_verified_at, preferred_language, latest_reply_at | follow-up automation and SLA |
| product | product_catalog_id, manual_product_name, category, pricing_model, custom_description | smart form and quote readiness |
| dimensions | width, height, area, qty, unit, material, finish, options | price calculation and production planning |
| fulfillment | mode, pickup_branch, address, map_pin, recipient, phone, site_photos, access_notes | delivery/install requirements and completion |
| document | document_request_type, billing_name, tax_id, branch_type, branch_code, billing_address | receipt/tax profile validation |
| media | uploaded_file_ids, reference_links, brief_text, ai_allowed, design_style | AI prompt, designer handoff, proof review |
| readiness | edge_validated, crm_normalized, missing_fields, blocking_reason, next_action_owner | anti-ping-pong routing |
| automation | automation_level, confidence_score, policy_version, auto_quote_allowed | decide auto vs review |
| commercial | receiver_entity_id, payment_profile_id, receiver_lock_status, credit_terms | money/document safety |
| lifecycle | workflow_state, quote_id, job_id, status_token, last_customer_action_at | status page and LINE replies |
| audit | created_at, updated_at, last_changed_by, last_change_reason | traceability |

Important rule:

```text
Do not let each screen invent its own readiness check.
Store readiness once, then let LIFF, admin, quote, payment, production, and status screens consume it.
```

## R2 Media Asset Lifecycle

The system must answer which image/file type is stored where, who is allowed to send it to the customer, and which actions are audited. Current code already has a useful foundation: customer intake media can store `storage_provider` as `supabase` or `r2`, and R2 is used when Cloudflare R2 environment variables are configured. Production/job media currently has a separate `job-media` flow and should eventually use the same provider-aware asset contract.

Strict rule:

```text
R2 stores the file.
Database stores the asset record, owner, lifecycle state, permission, audit links, and signed-url policy.
Customer-facing delivery must never depend on a raw object URL.
```

Recommended asset classes:

| Asset class | Example | Owner | Storage path intent | Customer-visible? | Automation stance |
| --- | --- | --- | --- | --- | --- |
| customer_reference | รูปแบบที่อยากได้, โลโก้, รูปหน้างาน, PDF brief | customer/admin-assisted | `leads/{leadId}/customer-reference/...` | yes, as evidence/reference | auto upload + validate file type/size |
| ai_generated_draft | draft image generated by AI for internal preview | ai/system | `leads/{leadId}/ai-preview/...` | no by default | auto generate/store, human review before customer |
| ai_customer_preview | AI output intentionally sent to customer | ai + approving staff/system | `leads/{leadId}/ai-customer-preview/...` | yes | only auto-send in green-zone cases |
| designer_proof | proof/mockup sent by design team | staff/designer | `jobs/{jobId}/design-proof/...` or event package | yes | staff review/send action required |
| production_evidence | production photo, ready photo, install/delivery evidence | staff/production | `jobs/{jobId}/events/{eventId}/...` | sometimes | review before customer unless configured safe |
| payment_proof | customer payment slip | customer/admin-assisted | `quotes/{quoteId}/payment-proof/...` | internal/finance mostly | finance review before confirmation |
| document_asset | receipt/tax invoice PDF/image | system/finance | `commercial-documents/{documentId}/...` | yes | issue only after commercial gate |

Minimum metadata per asset:

| Field | Why |
| --- | --- |
| `asset_id` | stable DB identity |
| `asset_class` | reference, AI draft, designer proof, evidence, payment proof, document |
| `entity_type` / `entity_id` | lead, quote, job, document, customer |
| `storage_provider` / `storage_bucket` / `storage_path` | R2/Supabase locator without exposing public URL |
| `mime_type` / `file_size_bytes` / `width_px` / `height_px` | validation, preview, production readiness |
| `created_by_actor_type` / `created_by_actor_id` | customer, staff, ai, system |
| `visibility` | internal, customer_preview, customer_sent, archived |
| `review_status` | pending, approved, rejected, sent |
| `approved_by_actor_id` / `sent_by_actor_id` | audit for customer-facing delivery |
| `source_prompt_id` / `source_media_ids` | AI lineage and design traceability |
| `expires_at` / `deleted_at` | retention and cleanup |

Customer-facing media rule:

```text
The customer sees a signed URL or status page package.
The system stores the durable asset record.
The audit log records who created, approved, and sent it.
```

## Customer Reference, AI Preview, And Designer Proof Decisions

The three customer-facing design-image questions should be answered separately.

| Question | Use what | Who owns it | Can AI do it directly? | Must audit |
| --- | --- | --- | --- | --- |
| customer uploads แบบที่อยากได้ | LIFF/admin upload to R2-backed customer reference asset | customer/admin-assisted | no, this is source material | upload, validation, link to lead |
| AI creates draft for staff | AI generated draft asset in R2 | ai/system | yes, internal only | prompt, model, input assets, cost/quota, generated asset |
| AI sends preview to customer | approved AI customer preview package | ai/system + approver | only green-zone, policy-configured cases | approval/send event, message payload, signed asset package |
| design team sends proof | designer proof package tied to job/design event | staff/designer | no, staff is owner | upload, approval, send, customer response |

Green-zone AI can send to customer only when all are true:

- Product type is allowed for AI customer preview.
- No legal/tax/company identity text is being generated from scratch.
- Customer-supplied text has been validated or staff-approved.
- Dimensions/aspect ratio are suitable for preview, not final production proof.
- AI provider/model/cost/quota is inside settings.
- Required asset lineage exists: prompt, model, input reference files, output file.
- Customer message template is approved.
- Auto-send setting is enabled for that product/channel.
- Rollback is possible by sending a corrected preview and preserving history.

AI must stay internal/staff-reviewed when any are true:

- Customer logo/brand usage is unclear.
- Artwork includes phone number, address, legal name, tax id, QR code, bank info, or price.
- Job is install, signage, large format, safety-sensitive, or expensive to rework.
- Product catalog marks `requires_admin_review`.
- Customer asks for exact production-ready artwork.
- Confidence is low or multiple interpretations are possible.
- Model quota/cost setting is exceeded or provider fallback was used.

Designer proof should be the default customer-facing path for higher-risk jobs. AI can prepare the brief and draft, but the design team owns the proof that becomes customer-visible.

AI direct-action matrix:

| Case | AI can generate? | AI can send to customer automatically? | Required path |
| --- | --- | --- | --- |
| simple style moodboard from customer reference | yes | maybe, only if product policy allows | AI draft -> optional auto preview |
| background/mockup idea with no legal/customer text | yes | maybe, green-zone only | AI preview package with audit |
| resize/crop/reference cleanup for internal design brief | yes | no need to send | internal asset only |
| product with exact catalog template and approved text | yes | yes, if auto-send enabled | AI customer preview with audit + status link |
| logo/brand-heavy artwork | yes | no | staff/designer approval required |
| artwork containing phone/address/legal/company/tax text | yes | no | staff verifies text before send |
| install/large signage/high rework cost | yes | no | designer proof path |
| unclear customer instruction | maybe | no | ask customer delta or admin review |
| provider quota/cost/fallback triggered | maybe | no | owner/dev/provider review or manual design |
| final production-ready file | no as final authority | no | designer/production owned artifact |

## Customer And Staff Profiles

Automation needs real actor identity. Customer profile and staff profile are not just UI pages; they are how the audit log explains who did what.

Customer profile should hold:

| Profile area | Examples | Automation use |
| --- | --- | --- |
| identity | customer id, LINE user id, display name, phone, email | dedupe, resume flow, contact method |
| relationship | B2C/B2B, company, tax profile, branch info | document readiness, payment terms |
| preferences | preferred channel, language, pickup/delivery tendency | message routing and defaults |
| history | leads, quotes, jobs, documents, complaints | repeat-customer automation |
| consent/source | LIFF consent, admin-created source, latest verified profile snapshot | audit and privacy safety |

Staff profile should hold:

| Profile area | Examples | Automation use |
| --- | --- | --- |
| identity | staff id, email, display name, auth provider id | actor lookup for audit |
| role | admin, finance, owner, designer, production, delivery, dev | allowed actions and approval matrix |
| branch/team | branch, team, working hours | assignment and SLA routing |
| permission flags | can approve quote, confirm payment, issue document, send design proof | guard high-risk actions |
| notification prefs | LINE/email/internal queue | assignment alerts |
| status | active, suspended, offboarding | prevent stale staff actions |

Strict profile rule:

```text
No high-risk action should be performed by an anonymous admin string.
Resolve the actor to a staff profile or service profile before writing the audit event.
```

Service profiles are also needed for automation:

| Service actor | Example action | Audit identity |
| --- | --- | --- |
| workflow_engine | recompute readiness, assign queue | `system:workflow_engine` |
| line_webhook | receive/reply to LINE event | `system:line_webhook` |
| ai_designer | generate prompt/output | `ai:{provider}:{model}` or generated service id |
| media_worker | sign URL, cleanup expired asset | `system:media_worker` |
| commercial_engine | validate receiver/document gate | `system:commercial_engine` |

## Audit Log For Every Action

Current schema already has `action_log` with `entity_type`, `entity_id`, `action_type`, `actor_type`, `actor_id`, `actor_label`, `note`, and JSON `payload`. That is the right backbone, but maximum automation requires a stricter rule: every state-changing action and every customer-visible media/message action writes an audit event.

Strict rule:

```text
If it changes state, changes money/document risk, creates/sends media, asks the customer, or approves/rejects something, it must write action_log.
```

Audit event classes:

| Event class | Examples | Required actor |
| --- | --- | --- |
| intake | lead created, manual add, draft edited, missing-info link generated | customer/staff/system |
| media | customer reference uploaded, AI image generated, proof uploaded, proof sent, asset expired | customer/staff/ai/system |
| AI | prompt generated, provider selected, quota fallback, output rejected/approved | ai/staff/system |
| quote | quote drafted, quote sent, quote approved/rejected/rescoped | staff/system/customer |
| payment | payment instruction generated, proof uploaded, payment confirmed/rejected | customer/staff/finance/system |
| commercial | receiver selected, receiver locked, document drafted/issued/blocked | finance/owner/system |
| production | job created, checklist generated, production status changed | staff/system |
| fulfillment | ready for pickup, delivery evidence uploaded, install evidence approved | staff/system/customer where applicable |
| profile | customer merged, tax profile changed, staff role changed, staff suspended | staff/owner/system |
| notification | LINE push sent, customer status link sent, send failed | system/staff |

Minimum audit payload by action:

| Payload field | Why |
| --- | --- |
| `policy_version` | know which rules allowed the action |
| `from_state` / `to_state` | state transition trace |
| `readiness_before` / `readiness_after` | explain automation decision |
| `asset_ids` | media lineage without exposing raw URLs |
| `approval_required` / `approved_by` | proof for customer-visible or high-risk action |
| `blocking_reason` | why automation stopped |
| `next_action_owner` | who must act next |
| `service_actor` | exact service/model/provider for automated actions |
| `redaction_note` | confirm payload avoids unnecessary PII |

Do not put raw secrets, raw signed URLs, full tax addresses, bank details, or full payment proof OCR text into `action_log.payload`. Store sensitive records in the proper table and reference IDs in audit.

Audit-backed automation rule:

```text
No audit event, no automation trust.
```

## Settings Required Before Deep Automation

Automation depends more on settings than on AI. If settings are weak, AI will only move confusion faster.

| Setting area | Required decisions | Automation unlocked |
| --- | --- | --- |
| product catalog | pricing_model, required fields, active products, admin review flags | smart LIFF questions, auto quote eligibility |
| price rules | per sqm, per piece, fixed, min charge, material add-ons, rush fee | quote draft and safe auto quote |
| fulfillment rules | pickup branches, delivery area, install area, address/photo/map requirements | fulfillment validation and schedule routing |
| branch/team rules | branch owner, available staff, working hours, holidays | assignment and SLA automation |
| document rules | receipt vs tax invoice, receiver VAT capability, required customer tax fields | document readiness and customer messaging |
| payment rules | receiver to payment profile mapping, credit terms, thresholds | payment instruction and finance review |
| approval matrix | who approves quote, discount, manual price, receiver mismatch, urgent job | admin queue routing |
| AI provider rules | allowed models, quota, cost limit, fallback provider, manual mode | AI prompt routing and quota-safe design flow |
| message templates | LINE copy by workflow state and blocker type | consistent auto replies |
| escalation rules | human-support keywords, SLA, stuck-state thresholds | human review queue |
| evidence rules | payment proof, delivery proof, install proof, completion photo | closure automation |

## Channel Automation

### LINE

Automate:

- Detect returning customer by LINE user and latest active conversation.
- Choose state-specific reply instead of generic intake.
- Show one primary action per state.
- Send only the relevant deep link: resume draft, missing info, quote, payment/status, design review, production status.
- Convert free-text human-support keywords into escalation.
- Detect common customer intents: new order, ask price, send proof, ask status, approve, reject, rescope, complain, request invoice.

Do not fully automate:

- Promising delivery date when fulfillment mode/site risk is unresolved.
- Giving payment instructions when receiver/payment mapping is unsafe.
- Treating new photos as final design approval without explicit customer action.

### LIFF

Automate:

- Prefill identity and known contact data.
- Resume draft instead of starting over.
- Open only missing section when CRM says customer-owned data is missing.
- Hide irrelevant sections based on catalog and fulfillment mode.
- Validate tax profile only when tax invoice is requested.
- Convert uploads into design/media records tied to the CRM draft.
- Show progress as readiness, not as generic steps.

Do not fully automate:

- Asking every possible question just in case.
- Showing admin/internal blockers to the customer.
- Creating a new duplicate lead when the customer is only correcting old data.

### Admin Manual Add

Automate:

- Quick-add customer with minimal fields.
- Search/dedupe by phone, LINE, email, tax id, company name.
- Auto-create customer, conversation, and lead draft together.
- Suggest catalog match from free text.
- Suggest missing fields and next action owner.
- Generate focused customer follow-up link.
- Save incomplete draft safely with readiness chips.

Do not fully automate:

- Overwriting customer identity without staff confirmation.
- Merging customers when evidence is weak.
- Marking quote-ready if staff entered vague product text.

## CRM Readiness Engine

The readiness engine should return a compact decision object, not scattered booleans.

Suggested output:

```json
{
  "status": "admin_review_required",
  "confidence": 0.72,
  "missing_fields": ["install.site_photos", "install.map_pin"],
  "blocking_reason": "install_site_risk_incomplete",
  "next_action_owner": "customer",
  "allowed_actions": ["request_missing_install_info", "admin_edit_draft"],
  "blocked_actions": ["auto_send_quote", "create_job"],
  "policy_version": "workflow-policy-2026-05-03"
}
```

Readiness states:

| State | Meaning | Next action |
| --- | --- | --- |
| draft_created | row exists but not enough to route | admin/customer continue intake |
| edge_validated | source payload is structurally valid | CRM normalize |
| crm_normalized | customer/lead/conversation are joined | readiness check |
| customer_info_missing | only customer-owned fields are missing | send focused LIFF/web/admin-assisted request |
| admin_review_required | product, pricing, catalog, site risk, or manual decision needed | admin queue |
| quote_ready | enough data for quote draft or auto quote | quote create/send |
| commercial_review_required | receiver, payment, document, or credit safety unresolved | finance/owner |
| production_ready | quote/payment/document gates allow job start | production queue |
| fulfillment_ready | job done and fulfillment evidence path known | pickup/delivery/install flow |
| completed_ready | fulfillment, evidence, and document path are resolved | close job |

## Product And Quote Automation

### Pricing Formula Strategy

Current reality is simple: the runtime product catalog has `per_sqm` and `min_charge`, and `calculateProductCatalogPrice` computes area-based pricing. That is enough for vinyl-like products, but not enough for all product types.

Strict rule:

```text
Product catalog chooses the pricing model.
Pricing profile defines the formula and variables.
Quote stores the formula snapshot used at the time of pricing.
End customers adjust inputs/options, not the business formula.
Business owner/admin adjusts formulas through versioned settings with audit.
```

Pricing model examples:

| Pricing model | Formula shape | Customer inputs | Auto quote safety |
| --- | --- | --- | --- |
| `fixed` | fixed price | selected product/options | safe if product/options locked |
| `per_sqm` | area * rate, then min charge | width, height, qty | safe for standard flat print/signage |
| `per_piece` | qty * unit price, then min charge | qty | safe for standard pieces |
| `linear_meter` | length * rate | length, qty | safe for rolls/trim/linear material |
| `area_tier` | area chooses tier rate | width, height, qty | safe only if tiers are locked |
| `qty_tier` | qty chooses tier unit price | qty | safe only if tiers are locked |
| `material_addon` | base formula + material/finish add-ons | material, finish, options | amber unless all add-ons are locked |
| `delivery_install` | base + distance/site/labor rules | fulfillment details | review for install/site risk |
| `manual` | staff-defined price | request details | never auto-send |
| `composite` | multiple line formulas | multiple products/options | review until stable |

What to add on top of the current catalog contract:

| Field | Why |
| --- | --- |
| `pricing_model` | tells LIFF/admin which inputs matter |
| `pricing_profile_id` | points to reusable formula/profile settings |
| `pricing_formula_version` | makes quote snapshots auditable |
| `formula_status` | `draft`, `active`, `deprecated`, `manual_review` |
| `base_price` / `unit_price` / `rate` / `min_charge` | simple formula parameters |
| `tier_rules` | JSON/preset rows for area or quantity tiers |
| `addon_rules` | material, finish, rush, delivery, install add-ons |
| `required_inputs` | controls LIFF/admin required fields |
| `customer_adjustable_inputs` | fields end customer can change safely |
| `allow_auto_quote` | green-zone quote automation gate |
| `requires_admin_review` | blocks auto-send when formula is not locked |
| `manual_override_allowed` | lets staff override price with reason/audit |

Do not implement arbitrary raw formula strings first. Use a safe formula builder/preset model before allowing custom expressions.

Safe formula builder idea:

```text
price = base
	+ area_component
	+ quantity_component
	+ selected_addons
	+ fulfillment_component
	+ rush_component
then apply min_charge / rounding / tax display rules
```

Formula edit ownership:

| Actor | Can edit formula? | Can edit inputs? | Notes |
| --- | --- | --- | --- |
| end customer | no | yes | can change size, qty, material choice, fulfillment mode, deadline |
| admin/staff | no or limited | yes | can override price only with reason and permission |
| owner/manager | yes | yes | can publish active pricing profiles |
| system/AI | suggest only | no final authority | can propose formula/profile but cannot publish |
| developer | migration/tools only | no business decision | builds safe formula engine and validation |

If the formula cannot be locked now:

- Set `pricing_model = manual` or `formula_status = manual_review`.
- Set `allow_auto_quote = false`.
- Set `requires_admin_review = true`.
- Let admin/owner create a quote draft manually.
- Store any manual override reason in audit.
- Keep the customer-facing flow light: customer provides variables/options, not formula decisions.

Formula lifecycle:

| Stage | Meaning | Allowed action |
| --- | --- | --- |
| draft | owner/admin is still designing formula | test only, no auto quote |
| test | formula is run against sample jobs | compare, tune, no customer auto-send |
| active | approved for selected products | auto quote allowed if other gates pass |
| snapshot | quote captured formula version/result | immutable for quote/payment/document trace |
| deprecated | no longer used for new quotes | existing quote snapshots remain valid |

Audit events to add later:

- `pricing.profile_created`
- `pricing.profile_updated`
- `pricing.profile_approved`
- `pricing.profile_deprecated`
- `pricing.quote_calculated`
- `pricing.manual_override_applied`
- `pricing.auto_quote_blocked`

The practical answer: yes, formulas must be configurable, but by business owner/admin with versioning and audit. End customers should only adjust the variables that feed the formula.

### Catalog-Driven Smart Intake

Catalog should control questions and auto quote safety.

Automate:

- Choose required fields based on product.
- Hide size fields for fixed-price products.
- Require qty for piece-based products.
- Require address/map/photo only for fulfillment modes that need them.
- Mark manual/custom products as admin review.
- Compute area and min charge.
- Apply rush fee, material add-on, finish add-on, and branch-specific rules when settings exist.

Need human review:

- Product is not matched to catalog.
- Manual pricing model.
- Special material, unknown finish, unclear dimensions, unusual deadline.
- Install with incomplete site risk.
- Discount, override, or B2B special price.

### Auto Quote Eligibility

Use green/amber/red classification.

| Zone | Condition | Action |
| --- | --- | --- |
| green | catalog product, pricing rule, required fields, fulfillment, and customer contact are valid | auto create and optionally auto send quote |
| amber | mostly valid but manual check is useful | create quote draft, admin approves send |
| red | missing policy, manual product, receiver risk, site risk, or unclear pricing | block auto quote and route review |

Auto quote should include:

- Price snapshot.
- Product snapshot.
- Customer request snapshot.
- Fulfillment snapshot.
- Payment profile candidate, but not final unsafe payment instruction if receiver mapping is not settled.
- Policy version.

## Payment And Commercial Automation

The commercial invariant stays strict:

```text
Money receiver -> document issuer.
```

Automate:

- Select payment profile candidate from settings.
- Validate that payment profile maps to a commercial receiver entity.
- Show finance/admin warning when receiver mapping is incomplete.
- Generate customer-facing payment instruction only when safe.
- Parse payment proof metadata and attach it to quote/order.
- Create payment confirmation draft for admin/finance review.
- Lock receiver after confirmed payment.
- Trigger required document issue after payment or approved credit policy.

Human/finance/owner approval required:

- Receiver/payment profile mismatch.
- Customer requests tax invoice but selected receiver cannot issue tax invoice.
- Payment proof ambiguous or partial.
- Overpayment, underpayment, refund, split payment.
- Credit terms outside configured policy.
- Receiver change after payment request was sent.

Commercial auto actions should be conservative. Wrong money/document automation is worse than slow manual review.

## Document Automation

Automate:

- Capture document request at intake.
- Validate customer tax profile fields.
- Wait for receiver eligibility before promising tax invoice.
- Generate document draft from locked receiver, customer snapshot, quote/order snapshot, and payment snapshot.
- Generate receipt or tax invoice/receipt number after approval/issue rules pass.
- Write immutable document snapshot.
- Show document status on customer status page.

Do not fully automate yet:

- Issuing tax invoice when receiver VAT capability is uncertain.
- Editing issued document snapshots.
- Changing receiver after payment confirmation.

## AI And Design Automation

AI should accelerate design preparation, not become the legal/business actor.

Automate:

- Build structured design brief from CRM draft, product, dimensions, fulfillment, media, and customer notes.
- Generate prompt variants by product type and style.
- Route to model/provider based on settings, cost, quota, and required output.
- Fall back to manual design queue when provider quota is low or request is too complex.
- Store generated prompt, model, provider, cost estimate, output references, and staff decision.
- Show admin a preview queue: use, revise prompt, regenerate, send to designer, request customer clarification.

Human/design approval required:

- Customer supplied brand/logo with unclear usage.
- Text spelling, phone number, legal name, or address appears in artwork.
- AI output has incorrect dimensions, wrong language, wrong product, or bad typography.
- Large/signage/install job where production risk is high.
- Model quota/cost exceeds setting.

AI provider setting ideas:

| Setting | Why |
| --- | --- |
| default_provider | normal route for generated design/prompt |
| fallback_provider | keep operation moving if quota is exhausted |
| max_cost_per_draft | prevent runaway generation |
| daily_quota_warning | owner/dev knows before work stops |
| allowed_product_types | avoid using AI where output is unsafe |
| require_human_approval | force approval for customer-facing artifacts |

## Production Automation

Automate after quote/payment/commercial gates pass:

- Create job from quote snapshot.
- Create production checklist from product catalog.
- Compute material estimate.
- Assign branch/team based on product, fulfillment, and workload.
- Create due date suggestion from SLA, production time, and customer preferred date.
- Notify production queue.
- Generate internal work order.
- Request missing production media only when customer-owned.
- Move status page timeline as job events happen.

Human review required:

- Custom material or special install.
- Unclear artwork approval.
- Rush deadline outside SLA.
- Material stock conflict.
- Production blocker not owned by customer.

## Fulfillment Automation

Automate:

- Pickup: choose branch, pickup window, pickup contact, ready notification, pickup evidence.
- Delivery: validate address, map pin, recipient, phone, delivery note, route/fee candidate.
- Install: require site contact, map pin, photos, access notes, preferred window, site-risk checklist.
- Show fulfillment readiness before job completion.
- Trigger customer notification when ready for pickup/delivery/install.
- Capture evidence before completion.

Human review required:

- Install risk unclear.
- Address outside service area.
- Customer wants exact promise before schedule is confirmed.
- Delivery/installation failed or evidence missing.

## Notification Automation

Every workflow state should map to a safe message.

Automate notifications for:

- Intake received.
- Missing customer data.
- Quote sent.
- Quote approved/rejected/rescope.
- Payment instruction ready.
- Payment proof received.
- Payment confirmed.
- Document issued or pending review.
- Design proof ready.
- Design approved/revision requested.
- Production started.
- Ready for fulfillment.
- Completion and aftercare.

Message rules:

- One primary action.
- No internal blocker details.
- No promise beyond current policy state.
- If customer action is not required, do not ask them to open LIFF.
- Link to status page when passive tracking is enough.

## Admin UI Automation

The admin CRM table should show automation state clearly.

Recommended columns/chips:

| Column/chip | Purpose |
| --- | --- |
| source | LINE, LIFF, admin, web, phone, walk-in, B2B |
| customer | customer identity and contact method |
| request summary | product and key dimensions |
| readiness | missing, review, quote ready, commercial review, production ready |
| next owner | customer, admin, finance, owner, dev, system, external_provider |
| blocker | compact reason such as missing address or receiver mismatch |
| age/SLA | aging and urgency |
| next action | one-click allowed action |
| audit | latest actor/change |

One-click admin actions:

- Send missing info link.
- Edit draft.
- Match product catalog.
- Create quote draft.
- Approve/send quote.
- Assign review owner.
- Select receiver entity.
- Confirm payment.
- Issue required document.
- Create production job.
- Request customer design approval.
- Mark fulfillment evidence.

Each action should be allowed or blocked by policy, not by UI guesswork.

## Human Approval Matrix

| Area | Can auto? | Human approval when |
| --- | --- | --- |
| customer dedupe | suggest first | weak identity match or tax/company conflict |
| product match | auto for exact catalog | free text, unknown material, multiple possible products |
| quote price | auto for green zone | manual pricing, discount, B2B special terms |
| payment instruction | auto if receiver mapping safe | mismatch, split/partial payment, high value threshold |
| receiver lock | after confirmed payment rule | any receiver ambiguity |
| receipt | auto draft/issue when safe | payment ambiguity or customer data conflict |
| tax invoice | strict gate | receiver VAT capability or tax profile uncertainty |
| AI design draft | auto generate if quota/policy allows | customer-facing send, brand/legal text, expensive generation |
| production start | auto when gates pass | rush, custom install, missing approval |
| completion | auto only with evidence | missing delivery/install/document evidence |

## Anti-Ping-Pong Patterns

Use these to stop repeated customer/admin loops.

- Store raw answers and validation results together.
- Ask deltas, not full forms.
- Use section-specific links.
- Keep blocker owner explicit.
- Never send customer to LIFF for internal policy blockers.
- Keep admin edits on the same draft row.
- Recompute readiness after every write.
- Persist policy version for every automated decision.
- Show exactly why an action is blocked.
- Let status page show progress without requiring action.

## Automation Roadmap Brainstorm

### Phase 0: Media, Profile, And Audit Foundation

- Define unified media asset contract across customer reference, AI output, designer proof, production evidence, payment proof, and document assets.
- Make R2/provider-aware storage the target for customer/design media while preserving signed URL access only.
- Ensure every customer-visible media send has asset record, review status, actor, and audit event.
- Define customer profile, staff profile, and service actor identities.
- Require `action_log` for every state-changing, media, approval, and notification action.

### Phase 1: Make CRM Draft The Center

- Define shared CRM draft/table contract.
- Normalize LIFF/admin/web into the same contract.
- Store readiness result and next action owner.
- Add admin quick-add and edit draft UX.
- Add one-click missing-info request.

### Phase 2: Catalog-Driven Intake

- Extend product catalog contract.
- Drive LIFF/admin fields from catalog.
- Add auto quote green/amber/red classification.
- Add admin review queue for amber/red.

### Phase 3: Commercial Safety Automation

- Require payment profile to receiver mapping.
- Show commercial readiness before payment instruction.
- Add receiver lock on confirmed payment.
- Draft required receipt/tax document from locked receiver.

### Phase 4: AI Prompt And Design Assist

- Generate design brief from CRM data.
- Route provider/model by setting and quota.
- Store prompt/output/audit.
- Require human approval for customer-facing design.

### Phase 5: Production And Fulfillment Automation

- Create production job from quote snapshot.
- Generate work order/checklist.
- Add fulfillment-specific readiness and evidence.
- Complete only when fulfillment/document/evidence path is resolved.

## Final Brainstorm Rule

Maximum automation does not mean every action is automatic. It means the system always knows the next smallest safe action.

```text
If data is missing, ask the right person for only that data.
If policy is missing, send it to the owner/admin/dev queue.
If confidence is high and audit exists, auto advance.
If money, document, legal, or production risk is high, require approval.
```
