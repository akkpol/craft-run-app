---
title: FOGUS B2B Operations Model v1
date: 2026-05-03
status: owner-model
scope: operating model for multi-channel lead intake, CRM ownership, queue design, automation boundaries, and admin IA
branch: dev/commercial-document-core
depends_on:
  - docs/FOGUS_REALITY_ANALYSIS_MAP_V1.md
  - docs/FOGUS_AUTOMATION_BRAINSTORM_V1.md
  - docs/workflow-policy.json
---

# FOGUS B2B Operations Model v1

This document is the owner-level operating model for the B2B system.

It sits above packet-level implementation and above any single admin table. Its job is to define how the business should operate across channels, who owns each stage, which queue should receive each case, and where automation is allowed to act.

This is not the runtime state machine and not a UI freeze.

Use this document to answer questions like:

- Is `/admin` a backoffice queue or a CRM inbox?
- Which team owns each stage?
- Which blockers belong to customer vs internal staff?
- Which actions can be automated safely?
- Which menu and queue labels should exist?

## Position In The Source Hierarchy

| Layer | Source | How to treat it |
| --- | --- | --- |
| Owner operating model | `docs/B2B_OPERATIONS_MODEL_V1.md` | Canonical for channel/stage ownership, queue families, automation boundaries, and admin IA intent |
| Business reality map | `docs/FOGUS_REALITY_ANALYSIS_MAP_V1.md` | Canonical for what the system actually does today |
| Commercial business policy | `docs/COMMERCIAL_DOCUMENT_POLICY_V1.md`, `docs/COMMERCIAL_DOCUMENT_BUSINESS_FLOW_V1_FREEZE.md` | Canonical for payment/document/issuer rules |
| Runtime workflow policy | `docs/workflow-policy.json`, `src/lib/workflow-policy-core.mjs`, `src/lib/workflow-policy.ts` | Canonical for state transitions, CTA rules, and runtime guards |
| Human-readable workflow summary | `docs/WORKFLOW_TRANSITION_TABLE.md` | Readable derivative of runtime policy |
| Packet implementation scope | `plan/feature-commercial-documents-1.md` | Canonical for the current packet boundary and definition of done |
| Current admin projection | `src/lib/admin-overview.ts`, `src/app/admin/admin-dashboard-sections.tsx`, `src/app/admin/admin-sidebar.tsx` | Projection of the operating model into the current UI, not the source of truth |

## Operating Thesis

FOGUS should treat `/admin` as an operations CRM inbox, not just a passive backoffice dashboard.

That means:

- many channels can create or enrich the same lead record
- each stage has a clear owner
- each blocker is routed to the smallest correct queue
- automation advances work only when policy is satisfied and the next owner is clear
- the customer should not be bounced back to LIFF for internal blockers

Working definition:

```text
/admin is the operator-facing CRM inbox for leads, quotes, payments, commercial gates, design, production, and exceptions.
It is not the source of state truth.
It is the primary operational surface that projects the current truth and assigns next actions.
```

## Core Business Objects

The operating model should revolve around these objects:

| Object | Meaning | Main owner surface |
| --- | --- | --- |
| lead draft | pre-quote working record collected from any channel | CRM / intake ops |
| quote | priced commercial offer waiting for acceptance/payment | sales / admin |
| commercial order | receiver/document/payment policy anchor | finance / admin |
| payment | evidence that money is expected or received | finance |
| job | execution record for design/production/fulfillment | operations |
| conversation | channel context used for customer re-entry and support | CRM / support |
| document | immutable commercial evidence after issue | finance |

## Channel Model

All channels are adapters into one shared operating pipeline.

| Channel | Role | What it can do | Must not do |
| --- | --- | --- | --- |
| LINE | entry, re-entry, notifications | route customer to the next correct action, collect lightweight deltas, show status links | become the primary place for internal resolution |
| LIFF intake | structured self-service capture | collect requirements, files, billing intent, identity-linked submissions | ask customer to solve internal finance/admin blockers |
| admin quick-add | manual assisted intake | create lead for walk-in, phone, or offline requests | bypass required policy fields silently |
| quote page | customer commercial decision surface | approve/reject/rescope, read payment instructions | expose internal queue complexity |
| status page | customer progress surface | show current state, next customer action, design/progress requests | carry internal-only operational detail |
| accounting/admin tools | internal commercial control | confirm payment, lock receiver, issue document | redefine business policy locally |
| future web form / sales import / marketplace | external adapters | normalize into the same lead draft contract | fork a separate workflow model |

## Stage Ownership Model

Each stage needs one primary owner even if other teams can assist.

| Stage family | Primary owner | Supporting owners | Success condition |
| --- | --- | --- | --- |
| intake qualification | CRM / sales ops | admin, support | enough validated data to price or ask only missing delta |
| quote decision | sales / admin | owner for exceptions | customer approves/rejects or a clear revision path exists |
| payment readiness | finance / admin | owner for exception rules | correct receiver, payment instruction, and payment terms are ready |
| commercial gate | finance | admin | required document type is issuable by the selected receiver |
| design handoff | design ops | admin | brief and assets are good enough to produce a proof |
| production execution | production ops | delivery/install | work order is clear and unblocked |
| fulfillment | delivery/install ops | production, support | handoff to customer is complete |
| exception handling | owner or designated reviewer | finance, admin, design, dev | blocker is resolved or rerouted with clear accountability |

## Queue Families

The queue system should be derived from ownership, not from tables that happen to exist today.

Recommended queue families:

| Queue family | Purpose | Typical rows |
| --- | --- | --- |
| `new-leads` | new or incomplete leads that need qualification | LIFF submits, admin quick-add, re-opened collection cases |
| `customer-waiting` | cases waiting for customer input | missing size, missing address, design feedback pending |
| `quote-decision` | quotes waiting for commercial action | sent quote, rescope required, expired quote follow-up |
| `payment-ops` | quotes waiting for payment confirmation or payment correction | payment slip review, payment status mismatch |
| `commercial-gate` | cases blocked by receiver/document policy | receiver not selected, receiver lock mismatch, issued doc missing |
| `design-ops` | design preparation and proof workflow | prompt prep, proof review, send preview |
| `production-ops` | work in production and fulfillment execution | ready to print, install schedule, delivery evidence |
| `exceptions` | issues that do not belong to the normal path | escalation, policy conflicts, provider failures, owner review |

## Admin IA Proposal

The sidebar should express the owner operating model, not internal implementation history.

Current naming is still mixed between monitoring, backoffice, and profile/configuration language.

Recommended primary navigation:

| Current | Proposed | Why |
| --- | --- | --- |
| Backoffice | CRM Inbox | makes `/admin` read as the main operational inbox |
| Follow Up | Customer Waiting | emphasizes customer-owned blockers/SLA |
| LIFF Monitor | Intake Ops | treats LIFF as one intake adapter, not a silo |
| Accounting | Finance & Documents | makes payment/commercial gate/document work explicit |
| Profile | Teams & Profiles | clarifies that this surface is about actor profiles, not only the current user |

Recommended secondary navigation:

| Current | Proposed | Why |
| --- | --- | --- |
| Settings | Automation Settings | settings should be tied to routing, AI, payment, and document controls |
| Workflow | Flow Reference | this is a human-readable canonical reference, not a vague workflow link |

Recommended top-level sections inside `/admin`:

| Section | Purpose |
| --- | --- |
| Inbox summary | owner-facing counts by queue family and SLA |
| My team queues | queues filtered by the current operator role/team |
| Critical blockers | finance/commercial/design/production issues that stop revenue or execution |
| Customer commitments | quotes, proofs, deliveries, and follow-ups due today |
| System exceptions | automation failures, provider incidents, unresolved escalations |

## Stage-To-Surface Rule

The system should follow one primary operator surface per stage family.

| Stage family | Primary operator surface | Customer surface |
| --- | --- | --- |
| intake qualification | `/admin` CRM Inbox -> `new-leads` or `customer-waiting` | LINE + LIFF |
| quote decision | `/admin` CRM Inbox -> `quote-decision` | quote page |
| payment readiness | `/admin` CRM Inbox -> `payment-ops` | quote/status page |
| commercial gate | `/admin` CRM Inbox -> `commercial-gate` | quote/status notice only |
| design handoff | `/admin` CRM Inbox -> `design-ops` | status page + proof reply |
| production execution | `/admin` CRM Inbox -> `production-ops` | status page |
| exceptions | `/admin` CRM Inbox -> `exceptions` | customer sees only the next approved action |

Rule:

```text
The customer should see the next action.
The operator should see the blocker, owner, and queue.
```

## Channel -> Stage -> Owner -> Queue -> Automation Matrix

This matrix is the working planning reference for B2B automation.

| Channel trigger | Stage | Primary owner | Queue | Expected automation |
| --- | --- | --- | --- | --- |
| new LINE message from unknown customer | intake qualification | CRM / sales ops | `new-leads` | create/reuse conversation, identify customer, send LIFF entry |
| returning LINE message in early collection state | intake qualification | CRM / sales ops | `new-leads` or `customer-waiting` | resume existing intake, ask only missing delta |
| LIFF submit with complete pricing data | quote decision | sales / admin | `quote-decision` | normalize data, generate quote draft, send quote link |
| LIFF submit with missing critical data | intake qualification | CRM / sales ops | `customer-waiting` | compute missing fields, ask only the smallest missing delta |
| admin quick-add from offline request | intake qualification | CRM / sales ops | `new-leads` | create normalized lead draft with source tagged as assisted |
| customer approves quote but payment still pending | payment readiness | finance / admin | `payment-ops` | send payment instructions, set follow-up timers |
| payment evidence uploaded or marked paid | payment readiness | finance | `payment-ops` | validate proof, confirm payment, lock receiver when policy passes |
| confirmed payment but receiver not selected or mismatched | commercial gate | finance | `commercial-gate` | block production, request internal finance action only |
| confirmed payment with requested tax doc but receiver cannot issue | commercial gate | finance | `commercial-gate` | hard block, escalate to owner/finance policy path |
| commercial gate cleared and design needed | design handoff | design ops | `design-ops` | build design brief/package, suggest prompt or proof workflow |
| design proof waiting for customer feedback | design handoff | design ops | `customer-waiting` | notify customer, track SLA, avoid restarting intake |
| design approved and execution ready | production execution | production ops | `production-ops` | open work order, prepare production checklist |
| production finished waiting delivery/pickup | fulfillment | delivery/install ops | `production-ops` | notify readiness, collect handoff evidence |
| escalation keyword or policy conflict | exception handling | owner or designated reviewer | `exceptions` | assign reviewer, preserve audit, stop unsafe automation |
| automation/provider failure | exception handling | dev or owner depending on cause | `exceptions` | capture incident, suppress unsafe retries, route for review |

## Automation Boundary Rules

Automation is allowed only when the following questions are all answered:

1. Is the data valid enough for the next step?
2. Is the business policy already explicit?
3. Is the next owner clear?
4. Is there an audit trail?
5. Can the action be reversed or safely corrected?

If any answer is no, route to a queue instead of forcing the customer through another form.

High-value automations that should exist early:

- normalize and dedupe new leads across channels
- compute missing customer fields and ask only for the delta
- auto-generate quote drafts when pricing confidence is high
- auto-route payment and commercial blockers into finance queues
- auto-open design/production queues when previous gates are satisfied
- auto-notify customer on state changes using approved templates

Automations that should stay approval-gated:

- receiver selection override
- tax invoice eligibility override
- issuing immutable commercial documents
- cancellation/refund after payment
- customer-facing AI proof for high-risk jobs

## Decision Rule For Future Packets

When a future packet proposes a new admin screen, queue, or automation, evaluate it against this order:

1. Does it fit the owner operating model in this document?
2. Does it match the business reality map?
3. Does it respect commercial policy and runtime workflow policy?
4. Does it belong to the current packet scope?

If not, update the owner model first or declare that the packet is intentionally narrow.

## Immediate Derivatives

This document implies three near-term follow-up workstreams:

1. rename `/admin` navigation and summary labels around CRM inbox ownership
2. split current overview filters into owner-based queue families
3. centralize readiness and next-action ownership so all channels consume one contract