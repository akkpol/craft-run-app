# Commercial Document Policy v1 — FOGUS

> Purpose: กำหนดคำศัพท์, policy, workflow, validation, document numbering, VAT/branch rules, และ payment-to-receipt behavior สำหรับระบบ commercial document ของ FOGUS
> Core invariant: **เงินเข้าใคร → เอกสารออกชื่อนั้น**

---

## 0) Current Status

FOGUS มี quote/payment/job/status flow แล้ว แต่ commercial document ยังต้องปิด policy ให้ชัดก่อน Go-Live เต็มระบบ

ระบบเอกสารต้องไม่เป็น PDF ลอย ๆ แต่ต้องผูกกับ workflow จริง:

```text
LINE → LIFF → API Gateway → ERP Core → Payment → Document Engine → Production
```

---

## 1) Document Vocabulary

### 1.1 Quotation / ใบเสนอราคา

ใช้ก่อนลูกค้ายืนยันงาน

| Field | Policy |
|---|---|
| Thai label | ใบเสนอราคา |
| English label | Quotation |
| Doc prefix | `QT` |
| Timing | หลังสร้างราคา / ก่อนลูกค้า approve |
| Accounting meaning | ยังไม่ใช่การรับเงิน ยังไม่ใช่ใบกำกับภาษี |
| Status | `DRAFT → ISSUED → ACCEPTED → REJECTED → VOID` |

Rule:

```text
Quotation is a commercial offer, not a receipt, not an invoice, not a tax invoice.
```

---

### 1.2 Billing Note / ใบวางบิล / ใบแจ้งหนี้

ใช้เมื่อแจ้งให้ลูกค้าชำระเงิน โดยเฉพาะ B2B หรือเครดิต

| Field | Policy |
|---|---|
| Thai label | ใบวางบิล/ใบแจ้งหนี้ |
| English label | Billing Note |
| Doc prefix | `BN` |
| Timing | หลัง quote approved แต่ยังไม่จ่าย |
| System status | `WAITING_PAYMENT` |
| Meaning | ขอให้ลูกค้าชำระเงิน แต่ยังไม่ใช่หลักฐานรับเงิน |

Rule:

```text
Billing note requests payment but does not prove payment received.
```

ห้ามใช้คำว่า “ใบเสร็จ” หรือ “รับเงินแล้ว” ในเอกสารนี้

---

### 1.3 Invoice / ใบแจ้งหนี้

ในระบบนี้ให้ใช้ `Invoice` เป็น “เอกสารเรียกเก็บเงิน” ไม่ใช่ tax invoice

| Field | Policy |
|---|---|
| Thai label | ใบแจ้งหนี้ |
| English label | Invoice |
| Doc prefix | `INV` |
| Timing | เมื่อถึงจุดเรียกเก็บเงิน |
| Status | `DRAFT → ISSUED → PAID → VOID` |

Rule:

```text
Invoice is not Tax Invoice unless explicitly generated as TAX_INVOICE by a VAT-registered seller entity.
```

---

### 1.4 Receipt / ใบเสร็จรับเงิน / ใบรับเงิน

ใช้หลังได้รับเงินจริงแล้ว

| Receiver | Label |
|---|---|
| Company / juristic entity | ใบเสร็จรับเงิน |
| Personal account / individual | ใบรับเงิน |

| Field | Policy |
|---|---|
| English label | Receipt |
| Doc prefix | `RE` |
| Timing | หลัง payment confirmed |
| Required relation | receipt issuer = payment receiver |

Rule:

```text
Receipt proves payment received. Receipt issuer must equal payment receiver.
```

---

### 1.5 Tax-ready

ใช้สำหรับ internal/admin เท่านั้น หมายถึง “ระบบเก็บข้อมูลครบพอจะทำเอกสารภาษี” แต่ยังไม่ claim compliance

ใช้คำนี้ได้เมื่อมีครบ:

```text
seller tax id
seller branch
seller VAT registration status
customer tax profile
document number series
VAT calculation rule
payment receiver binding
document immutable snapshot
```

ห้ามแสดงลูกค้าว่า:

```text
ออกใบกำกับภาษีถูกต้องแล้ว
```

ถ้ายังไม่ได้ accounting/legal sign-off

---

### 1.6 Tax Invoice / ใบกำกับภาษี

ใช้เฉพาะ entity ที่จด VAT และมีสิทธิออกเท่านั้น

| Field | Policy |
|---|---|
| Thai label | ใบกำกับภาษี |
| English label | Tax Invoice |
| Doc prefix | `TAX` หรือ `TINV` |
| Timing | หลังเงื่อนไขออกเอกสารภาษีผ่าน |
| Required | seller entity ต้อง VAT registered |
| Lock | issued แล้วห้ามแก้เงียบ |

Rule:

```text
Tax invoice can only be issued by VAT-registered entity that is also the payment receiver.
```

---

### 1.7 Tax Invoice + Receipt / ใบเสร็จรับเงิน/ใบกำกับภาษี

ใช้เป็นเอกสารรวม เมื่อรับเงินแล้วและ entity ที่รับเงินจด VAT

| Field | Policy |
|---|---|
| Thai label | ใบเสร็จรับเงิน/ใบกำกับภาษี |
| English label | Receipt / Tax Invoice |
| Doc prefix | `RECTAX` หรือ `TAXRE` |
| Timing | หลัง payment confirmed |
| Required | receiver entity VAT registered |

Rule:

```text
Use combined receipt/tax invoice only when payment is confirmed and issuer is VAT registered.
```

---

## 2) Master Rule

```text
Payment receiver entity = Document issuer entity
```

ตัวอย่าง:

```text
เงินเข้าบริษัทหลัก → เอกสารบริษัทหลัก
เงินเข้าบริษัทรอง → เอกสารบริษัทรอง
เงินเข้าบัญชีบุคคล → ใบรับเงิน/receipt ของบุคคลนั้น
```

ห้าม:

```text
เงินเข้าบัญชีบุคคล → ออกใบกำกับภาษีชื่อบริษัท
เงินเข้าบริษัท A → ออกเอกสารบริษัท B
เงินเข้าบริษัทรอง → เอายอดไปนับในเอกสารบริษัทหลัก
```

---

## 3) Entity Policy

### 3.1 Entity Types

```ts
type EntityType = "COMPANY" | "PERSON";

type EntityRole =
  | "MAIN_COMPANY"
  | "SUB_COMPANY"
  | "PERSONAL_ACCOUNT";
```

### 3.2 Document Permission Matrix

| Payment Receiver | VAT Registered | Allowed Documents | Forbidden Documents |
|---|---:|---|---|
| Main company | Yes | Quotation, Billing Note, Invoice, Receipt, Tax Invoice, Receipt/Tax Invoice | Documents issued by another entity |
| Main company | No | Quotation, Billing Note, Invoice, Receipt | Tax Invoice |
| Sub company | Yes | Quotation, Billing Note, Invoice, Receipt, Tax Invoice, Receipt/Tax Invoice | Documents issued by main company if money did not enter main company |
| Sub company | No | Quotation, Billing Note, Invoice, Receipt | Tax Invoice |
| Personal account | No / unclear | Personal receipt / payment note | Company tax invoice |
| Individual VAT registered | Yes | Receipt / Tax Invoice under that person’s name | Company document if money entered personal account |

---

## 4) VAT Policy

### 4.1 VAT must come from seller entity

ห้ามให้ admin เปิดปิด VAT ด้วย toggle แบบไม่มี rule

```ts
vatEnabled = sellerEntity.isVatRegistered === true;
```

ถ้าไม่จด VAT:

```ts
vat_amount = 0;
document_type !== "TAX_INVOICE";
document_type !== "TAX_INVOICE_RECEIPT";
```

ถ้าจด VAT:

```ts
vat_rate = 0.07;
tax_invoice_allowed = true;
```

---

### 4.2 VAT Mode

```ts
type VatMode = "INCLUSIVE" | "EXCLUSIVE" | "NO_VAT";
```

#### EXCLUSIVE

```text
subtotal = 1,000
vat = 70
grand_total = 1,070
```

#### INCLUSIVE

```text
grand_total = 1,070
vat = 70
net_before_vat = 1,000
```

#### NO_VAT

```text
subtotal = 1,000
vat = 0
grand_total = 1,000
```

Rule:

```text
VAT must be calculated from stored numeric values, not from rendered text.
```

---

## 5) Branch Policy

### 5.1 Seller Branch

ทุก seller entity ต้องมี branch profile

```ts
type BranchType = "HEAD_OFFICE" | "BRANCH";

interface BranchProfile {
  branch_type: BranchType;
  branch_code?: string;
  branch_name?: string;
}
```

ถ้าเป็นสำนักงานใหญ่:

```text
สำนักงานใหญ่
```

ถ้าเป็นสาขา:

```text
สาขา <branch_name> / <branch_code>
```

### 5.2 Customer Branch

ถ้าลูกค้าขอเอกสารภาษีในนามบริษัท ต้องบังคับข้อมูล:

```text
customer legal name
customer tax id
customer branch type
customer address
```

ถ้า `customer_branch_type = BRANCH` ต้องมี:

```text
branch_code หรือ branch_name
```

Rule:

```text
If customer requests tax document as company, require customer tax id + branch type.
If customer branch type is BRANCH, require branch code/name.
```

---

## 6) Document Number Policy

เอกสารทุกชนิดต้องมีเลขรันแยกตาม:

```text
entity
document_type
year
```

Format แนะนำ:

```text
QT-MAIN-2026-000001
BN-MAIN-2026-000001
INV-MAIN-2026-000001
RE-MAIN-2026-000001
TAX-MAIN-2026-000001

QT-SUB01-2026-000001
BN-SUB01-2026-000001
INV-SUB01-2026-000001
RE-SUB01-2026-000001
TAX-SUB01-2026-000001

RE-PERSON01-2026-000001
```

Rule:

```text
ห้าม reuse
ห้ามแก้เลขย้อนหลัง
ห้ามลบเอกสารที่ issued แล้ว
ถ้าผิด → VOID / CREDIT_NOTE / DEBIT_NOTE
```

---

## 7) Payment-to-Receipt Behavior

### 7.1 Required Workflow

```text
QUOTE_CREATED
→ QUOTE_APPROVED
→ PAYMENT_RECEIVER_SELECTED
→ PAYMENT_PENDING
→ PAYMENT_CONFIRMED
→ RECEIPT_OR_TAX_DOCUMENT_ISSUED
→ COMMERCIAL_UNLOCK
→ PRODUCTION
```

### 7.2 Payment Receiver Validation

เมื่อ payment confirmed:

```ts
if (payment.receiver_entity_id !== order.selected_receiver_entity_id) {
  block("PAYMENT_RECEIVER_MISMATCH");
}
```

### 7.3 Document Generation After Payment

```ts
if (receiver.isVatRegistered && customer.requestTaxInvoice) {
  issue("TAX_INVOICE_RECEIPT");
} else {
  issue("RECEIPT");
}
```

### 7.4 Locking

หลัง `PAYMENT_CONFIRMED`:

```text
receiver_entity_id locked
payment amount locked
customer tax profile snapshot locked
document number locked
```

ถ้าลูกค้าขอเปลี่ยนข้อมูลภายหลัง:

```text
Do not edit issued document silently.
Use VOID / CREDIT_NOTE / DEBIT_NOTE or issue corrected document according to accounting policy.
```

---

## 8) LIFF / Admin UI Policy

### 8.1 Before Payment

ต้องถาม:

```text
ต้องการเอกสารแบบไหน?

[ ] ไม่ต้องการเอกสารภาษี
[ ] ใบเสร็จ/ใบรับเงิน
[ ] ใบกำกับภาษี / ใบเสร็จรับเงิน
```

ถ้าเลือกเอกสารภาษี ต้องเก็บ:

```text
ชื่อบริษัท/บุคคล
เลขผู้เสียภาษี
สำนักงานใหญ่/สาขา
ที่อยู่
อีเมลรับเอกสาร
```

### 8.2 Receiver Selection

ก่อนสร้าง QR / ช่องทางจ่ายเงิน ต้องเลือก:

```text
รับเงินผ่าน:

[ ] บริษัทหลัก
[ ] บริษัทรอง
[ ] บัญชีบุคคล
```

หลังจ่ายเงินแล้ว lock ทันที

### 8.3 UI Warning

ถ้าเลือกบัญชีบุคคลและลูกค้าขอใบกำกับภาษี:

```text
บัญชีรับเงินนี้ไม่สามารถออกใบกำกับภาษีในนามบริษัทได้
กรุณาเลือกช่องทางรับเงินของบริษัทที่จด VAT หรือเปลี่ยนเป็นใบรับเงิน
```

ถ้า receiver ไม่จด VAT:

```text
ผู้รับเงินนี้ไม่ได้ตั้งค่า VAT registered จึงออกได้เฉพาะใบเสร็จ/ใบรับเงิน ไม่สามารถออกใบกำกับภาษีได้
```

---

## 9) Database Minimum Schema

### 9.1 entities

```ts
entities {
  id: string
  type: "company" | "person"
  role: "MAIN_COMPANY" | "SUB_COMPANY" | "PERSONAL_ACCOUNT"
  legal_name: string
  display_name: string
  tax_id?: string
  is_vat_registered: boolean
  branch_type: "HEAD_OFFICE" | "BRANCH"
  branch_code?: string
  branch_name?: string
  address?: string
  bank_account_owner?: string
  active: boolean
}
```

### 9.2 customer_tax_profiles

```ts
customer_tax_profiles {
  id: string
  customer_id: string
  legal_name: string
  tax_id?: string
  branch_type: "HEAD_OFFICE" | "BRANCH"
  branch_code?: string
  branch_name?: string
  address: string
  email?: string
  phone?: string
}
```

### 9.3 payments

```ts
payments {
  id: string
  order_id: string
  receiver_entity_id: string
  amount: number
  currency: "THB"
  status: "PENDING" | "CONFIRMED" | "REJECTED" | "REFUNDED"
  paid_at?: string
  proof_url?: string
  bank_account_owner?: string
  reconciliation_status: "UNMATCHED" | "MATCHED" | "MISMATCHED"
}
```

### 9.4 commercial_documents

```ts
commercial_documents {
  id: string
  order_id: string
  quote_id?: string
  payment_id?: string
  issuer_entity_id: string
  customer_id: string
  customer_tax_profile_id?: string

  document_type:
    | "QUOTATION"
    | "BILLING_NOTE"
    | "INVOICE"
    | "RECEIPT"
    | "TAX_INVOICE"
    | "TAX_INVOICE_RECEIPT"
    | "CREDIT_NOTE"
    | "DEBIT_NOTE"

  document_number: string
  status: "DRAFT" | "ISSUED" | "PAID" | "VOID"

  vat_mode: "INCLUSIVE" | "EXCLUSIVE" | "NO_VAT"
  vat_rate: number
  subtotal: number
  discount_amount: number
  vat_amount: number
  grand_total: number

  issued_at?: string
  locked_at?: string
  voided_at?: string

  pdf_url?: string
  snapshot_json: object
}
```

### 9.5 document_number_sequences

```ts
document_number_sequences {
  id: string
  entity_id: string
  document_type: string
  year: number
  current_number: number
  prefix: string
  updated_at: string
}
```

---

## 10) API / Service Requirements

### 10.1 Select Receiver

```http
POST /api/commercial/select-receiver
```

Input:

```json
{
  "order_id": "order_123",
  "receiver_entity_id": "entity_main"
}
```

Validation:

```text
order not paid
receiver active
receiver supports selected payment method
```

---

### 10.2 Confirm Payment

```http
POST /api/payments/confirm
```

Validation:

```text
payment receiver entity must equal selected receiver entity
amount must match payable amount
receiver must be locked after confirmation
```

---

### 10.3 Issue Document

```http
POST /api/commercial/documents/issue
```

Input:

```json
{
  "order_id": "order_123",
  "document_type": "TAX_INVOICE_RECEIPT"
}
```

Validation:

```text
issuer = payment receiver
document type allowed for issuer entity
VAT registration required for tax invoice
customer tax profile required for tax document
document number unique
snapshot created
document locked after issue
```

---

## 11) PDF Template Requirements

### 11.1 Shared Layout

Every commercial PDF must include:

```text
company logo
seller legal name
seller address
seller tax id
seller branch
document title
document number
document date
customer name
customer address
customer tax id / branch if tax document
item table
subtotal
discount
VAT amount if applicable
grand total
amount in Thai text
issuer signature area
customer signature area if needed
document status watermark if draft/void
page number
```

### 11.2 Tax Invoice Specific

Tax invoice PDF must include:

```text
คำว่า “ใบกำกับภาษี” ชัดเจน
seller tax id
seller branch
customer tax id if provided/required
VAT 7%
tax base
VAT amount
grand total
document number
issue date
```

### 11.3 Receipt Specific

Receipt PDF must include:

```text
คำว่า “ใบเสร็จรับเงิน” หรือ “ใบรับเงิน”
payment date
payment method
receiver entity
paid amount
reference to invoice/quote if applicable
```

### 11.4 Combined Receipt / Tax Invoice

Use title:

```text
ใบเสร็จรับเงิน/ใบกำกับภาษี
```

Required only when:

```text
payment confirmed
issuer VAT registered
issuer = payment receiver
```

---

## 12) Audit Log Events

ต้อง log ทุกเหตุการณ์สำคัญ:

```text
commercial.receiver_selected
payment.confirmed
payment.receiver_mismatch
commercial.document_issued
commercial.document_voided
commercial.document_number_generated
commercial.customer_tax_profile_changed
commercial.vat_mode_changed
commercial.branch_validation_failed
commercial.tax_invoice_blocked
```

Each log should include:

```ts
{
  actor_id,
  actor_type,
  order_id,
  payment_id,
  document_id,
  issuer_entity_id,
  receiver_entity_id,
  previous_value,
  new_value,
  reason,
  created_at
}
```

---

## 13) Error Codes

```text
PAYMENT_RECEIVER_MISMATCH
DOCUMENT_ISSUER_MISMATCH
ENTITY_NOT_VAT_REGISTERED
CUSTOMER_TAX_PROFILE_REQUIRED
BRANCH_CODE_REQUIRED
DOCUMENT_ALREADY_ISSUED
DOCUMENT_NUMBER_CONFLICT
ISSUED_DOCUMENT_IMMUTABLE
INVALID_VAT_MODE
PERSONAL_ACCOUNT_CANNOT_ISSUE_COMPANY_TAX_INVOICE
```

---

## 14) Codex Implementation Prompt

```md
Implement Commercial Document Policy v1 for FOGUS.

Goal:
Build a strict commercial document system for quotation, billing note, invoice, receipt, and tax invoice.

Core invariant:
Payment receiver entity must equal document issuer entity.

Document naming:
- QUOTATION = ใบเสนอราคา
- BILLING_NOTE = ใบวางบิล/ใบแจ้งหนี้
- INVOICE = ใบแจ้งหนี้, not tax invoice
- RECEIPT = ใบเสร็จรับเงิน / ใบรับเงิน
- TAX_INVOICE = ใบกำกับภาษี
- TAX_INVOICE_RECEIPT = ใบเสร็จรับเงิน/ใบกำกับภาษี

Rules:
1. Before payment, require selected receiver entity.
2. After payment confirmation, lock receiver entity.
3. Receipt issuer must equal payment receiver.
4. Tax invoice can only be issued if issuer entity is VAT registered.
5. If money is paid to a personal account, do not issue company tax invoice.
6. Document numbers must be unique by entity + document type + year.
7. Issued documents are immutable. Corrections require VOID, CREDIT_NOTE, or DEBIT_NOTE.
8. Store document snapshot JSON at issue time.
9. VAT must be calculated from seller entity VAT status, not from a manual toggle.
10. Branch validation is required for company tax profiles.
11. PDF generation must use locked snapshot data, not live mutable records.
12. Commercial unlock can happen only after required receipt/tax document is issued or explicitly waived.

Workflow:
QUOTE_CREATED
→ QUOTE_APPROVED
→ PAYMENT_RECEIVER_SELECTED
→ PAYMENT_PENDING
→ PAYMENT_CONFIRMED
→ RECEIPT_OR_TAX_DOCUMENT_ISSUED
→ COMMERCIAL_UNLOCK
→ PRODUCTION

Add:
- database schema/migrations
- service layer validation
- document number generator
- PDF template rendering
- LIFF/admin UI validation
- audit logs
- tests for receiver/entity mismatch and VAT restrictions

Do not generate tax invoice unless all required issuer/customer/tax fields pass validation.
```

---

## 15) Executive Summary

Policy ที่ใช้:

```text
ใบเสนอราคา = เสนอราคา
ใบวางบิล/ใบแจ้งหนี้ = เรียกเก็บเงิน
ใบเสร็จ/ใบรับเงิน = รับเงินจริงแล้ว
tax-ready = ระบบพร้อมเก็บข้อมูลภาษี แต่ยังไม่ claim compliance
ใบกำกับภาษี = เฉพาะ entity ที่จด VAT และรับเงินจริงตรง entity นั้น
```

กฎเหล็ก:

```text
เงินเข้าใคร → เอกสารออกชื่อนั้น
จด VAT เท่านั้น → ออกใบกำกับภาษีได้
ออกแล้ว → ห้ามแก้เงียบ
ผิด → void / credit note / debit note
```
