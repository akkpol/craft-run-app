---
title: Standard Workflow Full Gates
version: 0.1
date: 2026-05-14
owner: Delivery Engineering
status: Draft
---

# Standard Workflow Full Gates

This document describes the full customer/admin/system workflow with explicit gates, branches, loops, and stop conditions.

It is a readable workflow contract, not a replacement for source-of-truth policy files.

## Source-of-Truth Hierarchy

If this document conflicts with source-of-truth files, the source-of-truth files win.

1. Workflow behavior:
   - `docs/workflow-policy.json`
   - `src/lib/workflow-policy-core.mjs`

2. Agent guard:
   - `AI_WORKFLOW_GUARD.md`

3. Commercial / financial document policy:
   - `docs/COMMERCIAL_DOCUMENT_POLICY_V1.md`
   - `docs/COMMERCIAL_DOCUMENT_BUSINESS_FLOW_V1_FREEZE.md`

4. Operator / launch runbooks:
   - `docs/OPERATOR_RUNBOOK.md`
   - `docs/PROJECT_NAVIGATION_MATRIX.md`
   - `docs/GO_NOGO_REVIEW.md`

---

# 1. LINE Webhook Entry

## Event

Customer sends a LINE message.

## Actor

Customer

## Entry

`POST /api/webhook`

## Gate Logic

```text
IF LINE signature is invalid
  THEN reject request with 401
  STOP

IF event is duplicate or LINE redelivery already processed
  THEN ignore safely
  STOP

IF customer message is escalation intent / wants human admin
  THEN set conversation.state = HUMAN_REVIEW_REQUIRED
  AND create escalation record
  AND reply acknowledgement
  STOP automated flow

IF customer has active conversation
  THEN resume active conversation

ELSE
  create customer/conversation if needed
  set conversation.state = COLLECTING_REQUIREMENTS
  reply LINE message with LIFF intake link
```

## Notes

- Do not reuse `COMPLETED` or `CANCELLED` conversations for new intake work.
- Completed customer can start a new conversation/intake.
- Escalation exits the automated path and becomes human-owned.

---

# 2. LIFF Intake

## Event

Customer opens LIFF in LINE app and submits intake form.

## Actor

Customer

## Entry

`POST /api/intake`

## Inputs

```text
line user id
display name
product type
product/catalog item
width / height / quantity
total
phone
requested document type
billing entity type: person/company
payment terms: prepaid/deposit/credit
billing name
tax id
branch type
branch code/name
billing address
```

## Gate Logic

```text
IF production LIFF context is invalid
  THEN show LINE-only / invalid context message
  STOP

IF returning customer
  THEN prefill known phone/document/billing defaults

IF required product/dimension/quantity data is missing
  THEN set state = ON_HOLD_CUSTOMER_INPUT
  AND ask customer for missing info
  STOP

IF customer requests company tax document
  IF tax id is missing
    THEN show Thai validation error
    STOP

  IF branch type = BRANCH
    AND branch code/name is missing
      THEN show Thai validation error
      STOP

IF selected product/catalog item is invalid or not found
  THEN show validation error
  STOP

ELSE
  create/update customer
  create lead
  create quote
  calculate total
  resolve payment profile
  save payment_profile_snapshot
  push LINE quote/status link
```

## Outputs

```text
customer
lead
quote
conversation
payment_profile_snapshot
quote/status token
LINE push message
```

---

# 3. Payment Profile Routing

## Event

Quote is created.

## Actor

System

## Gate Logic

```text
IF quote total <= secondary payment threshold
  THEN payment profile = secondary
  reason = secondary_total_threshold

ELSE IF customer/company scope matches secondary rule
  THEN payment profile = secondary
  reason = secondary_customer_scope

ELSE IF payment term matches secondary rule
  THEN payment profile = secondary
  reason = secondary_payment_terms

ELSE
  payment profile = primary
  reason = default

THEN
  snapshot selected payment profile into quote
```

## Rules

```text
Payment profile snapshot must be stored on quote.
Do not silently recompute payment receiver after quote is issued.
```

## Covered By Scenario Runner

```text
200 THB -> secondary profile
10000 THB -> primary profile
company/customer scope -> secondary profile
payment-term scope -> secondary profile
```

---

# 4. Quote Approval

## Event

Customer opens `/quote/[token]` and approves quote.

## Actor

Customer

## Gate Logic

```text
IF quote token is invalid
  THEN show invalid/404 state
  STOP

IF quote is rejected/void/expired
  THEN block approval
  STOP

IF quote already approved
  THEN show current status
  STOP duplicate approval

IF payment_terms = credit
  THEN approve quote
  AND create job immediately if allowed
  AND set job/conversation to IN_DESIGN

IF payment_terms = deposit
  THEN approve quote
  AND set state = WAITING_PAYMENT
  AND wait for required partial/paid amount

IF payment_terms = prepaid
  THEN approve quote
  AND set state = WAITING_PAYMENT
  AND wait for full payment
```

## Rule

```text
Quote approval does not always create a job.
Payment-gated quotes must wait for the payment unlock rule.
```

---

# 5. Payment Confirmation

## Event

Admin confirms customer payment.

## Actor

Admin

## Gate Logic

```text
IF selected receiver entity is missing
  THEN block payment confirmation
  AND ask admin to select receiver
  STOP

IF receiver entity is inactive
  THEN block payment confirmation
  STOP

IF payment receiver entity != selected receiver entity
  THEN block with PAYMENT_RECEIVER_MISMATCH
  STOP

IF amount does not match payable amount
  THEN block or require manual review
  STOP

IF payment proof is invalid/unreadable
  THEN keep payment pending review
  STOP

ELSE
  set payment.status = CONFIRMED
  lock receiver_entity_id
  lock paid amount
  update quote_payment_records
  update quote.payment_status = paid
  write action_log
```

## Outputs

```text
payment confirmed
receiver locked
quote payment status updated
quote_payment_records updated
action_log written
```

---

# 6. Commercial Document Gate

## Core Rule

```text
เงินเข้าใคร → เอกสารออกชื่อนั้น

Payment receiver entity = Document issuer entity
```

## Event

Payment is confirmed and commercial document must be issued.

## Actor

System/Admin

## Gate Logic

```text
IF payment is not confirmed
  THEN block document issuance
  STOP

IF receiver entity is not locked
  THEN block document issuance
  STOP

IF issuer entity != payment receiver entity
  THEN block with DOCUMENT_ISSUER_MISMATCH
  STOP

IF requested document type = RECEIPT
  THEN issue RECEIPT
  AND create immutable snapshot
  AND push LINE document link
  AND commercial unlock

IF requested document type = TAX_INVOICE_RECEIPT
  IF receiver entity is not VAT registered
    THEN block with ENTITY_NOT_VAT_REGISTERED
    STOP

  IF customer tax profile is missing
    THEN block with CUSTOMER_TAX_PROFILE_REQUIRED
    STOP

  IF customer branch data is invalid
    THEN block with BRANCH_CODE_REQUIRED
    STOP

  ELSE
    issue TAX_INVOICE_RECEIPT
    create immutable snapshot
    push LINE document link
    commercial unlock
```

## Forbidden Cases

```text
Money enters personal account -> do not issue company tax invoice.
Money enters company A -> do not issue document under company B.
Non-VAT receiver -> do not issue TAX_INVOICE_RECEIPT.
Issued document -> do not silently edit.
```

## Current Runtime Boundary

```text
Current runtime-supported path should be treated as:
- RECEIPT
- TAX_INVOICE_RECEIPT

Do not claim full commercial document suite unless verified:
- BILLING_NOTE
- standalone INVOICE
- standalone TAX_INVOICE
- CREDIT_NOTE
- DEBIT_NOTE
```

---

# 7. Commercial Unlock / Job Creation

## Event

Payment and required commercial document pass.

## Actor

System

## Gate Logic

```text
IF payment_terms = credit
  AND quote is approved
    THEN job may already exist
    AND continue IN_DESIGN

IF payment is required
  IF payment is confirmed
    AND required commercial document is issued
      THEN create job if missing
      AND set state = IN_DESIGN

  ELSE
    remain WAITING_PAYMENT / COMMERCIAL_GATE
    STOP

IF required commercial document is missing
  THEN block production
  STOP
```

---

# 8. AI Preview / Design Generation

## Event

Admin triggers AI preview.

## Actor

Admin

## Entry

`POST /api/leads/[id]/ai-preview`

## Gate Logic

```text
IF AI image generation is disabled
  THEN set ai_image_status = failed
  AND show operator configuration error
  AND allow manual design fallback
  STOP AI path

IF provider API key is missing
  THEN set ai_image_status = failed
  AND show configuration error
  STOP AI path

IF provider returns auth/quota/billing error
  THEN set ai_image_status = failed
  AND stop retry storm
  AND escalate key/billing issue
  STOP

IF provider succeeds but storage upload fails
  THEN set ai_image_status = failed
  AND classify as storage incident
  STOP

ELSE
  generate preview
  upload preview asset to R2 app-assets public bucket
  set ai_image_status = generated
  set design_status = drafting
  wait for admin to review and send preview
  (design_status = preview_sent is set by POST /api/leads/[id]/send-preview)
```

## Scenario Runner Behavior

```text
Scenario runner does not call real AI.
It uses deterministic fake AI preview URL.
```

---

# 9. Admin Sends Preview

## Event

Admin approves/sends preview to customer.

## Actor

Admin

## Gate Logic

```text
IF no generated/manual preview asset exists
  THEN block send preview
  STOP

IF lead/job is not in valid design state
  THEN block invalid transition
  STOP

ELSE
  push LINE preview to customer
  set design_status = preview_sent
  set conversation/state = waiting for customer response
  write action_log
```

---

# 10. Customer Design Decision Loop

## Event

Customer reviews design preview.

## Actor

Customer

## Gate Logic

```text
IF customer approves design
  THEN set design_status = approved
  AND unlock production gate

IF customer requests revision
  THEN set design_status = revision_requested
  AND assign work back to team/admin/designer
  AND create/send revised preview
  AND loop back to customer review

IF customer is silent
  THEN remain waiting
  AND optionally send follow-up/reminder
```

## Rule

```text
revision_requested is team-owned until preview_sent returns.
```

---

# 11. Production State Machine

## Event

Admin moves job through production.

## Actor

Admin

## Gate Logic

```text
IF payment is required but not confirmed
  THEN block production
  STOP

IF required commercial document is not issued
  THEN block production
  STOP

IF design_status != approved
  THEN block production
  STOP

IF current state = IN_DESIGN
  AND target state = IN_PRODUCTION
    THEN allow transition

IF current state = IN_PRODUCTION
  AND target state = READY_FOR_FULFILLMENT
    THEN allow transition

IF current state = READY_FOR_FULFILLMENT
  AND target state = COMPLETED
    THEN allow transition

IF transition is not allowed by workflow policy
  THEN block invalid transition
  STOP

ON COMPLETED
  set job.status = COMPLETED
  set lead.status = completed
  set conversation.state = COMPLETED
  push status update if configured
  write action_log
```

---

# 12. Customer Tracking

## Event

Customer opens public tracking pages.

## Actor

Customer

## Entry Points

```text
/quote/[token]
/status/[token]
/quote/[token]/download
commercial document link
design/status link
```

## Gate Logic

```text
IF token is invalid
  THEN show 404 / invalid link
  STOP

IF quote exists
  THEN show quote/payment/current workflow state

IF payment is pending
  THEN show payment instruction/status

IF document is issued
  THEN show document/download link

IF design preview is sent
  THEN show preview/status

IF production is active
  THEN show current production status

IF completed
  THEN show completed status
```

---

# 13. Four Main Operational Loops

## 13.1 Intake Loop

```text
LINE message
→ LIFF intake
→ validation
→ missing info
→ LINE ask more info
→ customer submits again
```

## 13.2 Money Loop

```text
quote
→ payment profile
→ payment proof
→ admin confirm
→ receiver lock
→ document issue
→ commercial unlock
```

## 13.3 Design Loop

```text
AI/manual preview
→ admin review
→ customer approve/revision
→ revision loops back to design
→ approved unlocks production
```

## 13.4 Production Loop

```text
IN_DESIGN
→ IN_PRODUCTION
→ READY_FOR_FULFILLMENT
→ COMPLETED
```

---

# 14. Scenario Runner Coverage

## Covered

```text
fake LINE inbound
webhook processor
new lead
escalation
quote scenario
payment scenario
payment routing matrix
receipt full lifecycle 200
tax invoice full lifecycle 10000
fake AI preview
customer design approval
production complete
action_log simulation tagging
```

## Not Fully Covered

```text
real LINE app
real LIFF WebView
real Supabase RLS/constraints
real AI provider
real storage provider failure
real PDF/browser rendering
real accounting/legal compliance
```

## Meaning

```text
Scenario runner is deterministic lifecycle simulation.
It is regression coverage, not full production E2E proof.
```

---

# 15. Do-Not-Bypass Rules

```text
Do not bypass workflow-policy.
Do not skip payment receiver lock.
Do not issue tax invoice if receiver is not VAT registered.
Do not issue document under a different entity than the payment receiver.
Do not move to production before payment/design/commercial gates pass.
Do not treat Supabase migration-history drift as LINE/runtime failure.
Do not treat fake scenario success as proof of real LINE/LIFF production smoke.
```
