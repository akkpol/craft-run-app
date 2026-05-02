# Commercial Document Business Flow v1 Freeze

Date: 2026-05-03
Owner: Akkapol / Business Owner
Implementation packet: `plan/feature-commercial-documents-1.md`
Policy source: `docs/COMMERCIAL_DOCUMENT_POLICY_V1.md`

## Purpose

This decision record locks the commercial-document business flow for v1 so development does not drift between document policy, payment behavior, tax handling, and production unlock rules.

Core invariant remains unchanged:

```text
เงินเข้าใคร -> เอกสารออกชื่อนั้น
```

## Locked v1 Scope

Commercial documents v1 starts after payment confirmation.

v1 issues only:

- `RECEIPT`
- `TAX_INVOICE_RECEIPT`

v1 does not issue these as first-release runtime documents:

- `BILLING_NOTE`
- `INVOICE`
- standalone `TAX_INVOICE`
- commercial `QUOTATION` replacement

Existing quote/payment behavior remains the upstream workflow until a separate packet explicitly changes it.

## Locked Business Flow

```text
LIFF intake captures billing/tax intent
-> quote is created and approved through the existing quote flow
-> admin selects the payment receiver entity before payment instructions are used
-> payment is created as PENDING for that receiver
-> payment is confirmed only if payment.receiver_entity_id matches order.selected_receiver_entity_id
-> receiver is locked on the commercial order
-> document engine issues RECEIPT or TAX_INVOICE_RECEIPT from locked payment/order/customer snapshots
-> commercial unlock occurs only after the required receipt/tax document is issued
-> production can proceed
```

## Locked Decisions

### 1. Runtime Document Types

Decision: v1 runtime document issuance is after payment only.

- If receiver can issue a tax document and customer requested a tax invoice: issue `TAX_INVOICE_RECEIPT`.
- Otherwise: issue `RECEIPT`.

### 2. Pre-payment Billing Documents

Decision: `BILLING_NOTE` and `INVOICE` are not in v1 runtime scope.

The existing quote/payment flow remains the pre-payment business surface. Any B2B billing note or invoice flow requires a follow-up packet.

### 3. Tax Invoice Blocking

Decision: block before payment.

If the customer requests a tax invoice but the selected receiver cannot issue one, the app must block that receiver choice before payment instructions are used. Admin must select a VAT-capable receiver or change the requested document outcome before payment.

Do not allow the customer to pay into a non-tax-capable receiver and silently downgrade to a company tax document later.

### 4. Commercial Unlock

Decision: commercial unlock happens after document issue, not merely after payment confirmation.

Production unlock requires either:

- the required `RECEIPT` or `TAX_INVOICE_RECEIPT` is issued, or
- a separate audited waiver flow is implemented in a future packet.

No implicit waiver is part of v1.

### 5. Correction Flow

Decision: correction documents are out of v1 runtime scope.

v1 behavior:

- issued documents are immutable
- no silent edit of issued data
- no `VOID`, `CREDIT_NOTE`, or `DEBIT_NOTE` runtime flow in v1

Corrections require a follow-up packet.

### 6. VAT Mode

Decision: default VAT mode for VAT-capable entity tax documents is `EXCLUSIVE`.

For v1:

```text
subtotal = base amount before VAT
vat_amount = subtotal_after_discount * 0.07
grand_total = subtotal_after_discount + vat_amount
```

Non-VAT or personal-account receivers use `NO_VAT` and cannot issue tax invoice documents.

## Required Product Behavior

### Before Payment

- LIFF must collect tax-document intent and required tax profile fields when customer requests a tax invoice.
- Admin must select receiver entity before payment instructions are treated as usable.
- UI must warn/block when receiver cannot satisfy the requested tax outcome.

### Payment Confirmation

- Payment receiver must match selected receiver.
- Receiver lock must be written after confirmation.
- Receiver mismatch must block confirmation.

### Document Issue

- Document issuer is always the locked payment receiver.
- Document uses locked snapshot data, not live mutable customer/quote/entity data.
- Document number is non-reused and allocated by entity, document type, and year.
- Issued document is immutable.

### Production Gate

- Production should not unlock from payment confirmation alone.
- Production can unlock only after the required commercial document is issued, unless a future audited waiver flow exists.

## Explicit Follow-up Packets

These are not part of v1 unless a new packet says otherwise:

- billing note / invoice before payment
- standalone tax invoice
- void / credit note / debit note correction flow
- manual commercial-unlock waiver
- e-Tax/legal compliance claims beyond tax-ready

## Stop Rules

Stop development if a proposed change allows any of these:

- payment into a personal account and company tax invoice issuance
- payment receiver and document issuer mismatch
- tax invoice from a non-VAT receiver
- production unlock before required commercial document issue
- silent edits to issued document data
- automatic downgrade of requested tax invoice after payment without explicit pre-payment block