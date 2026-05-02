---
title: Commercial Document Design Reference
date_created: 2026-04-26
last_updated: 2026-04-26
owner: Delivery Engineering
status: Draft reference
---

# Commercial Document Design Reference

This document captures the visual and structural patterns from the commercial document examples provided on 2026-04-26. Treat these examples as design references for future FOGUS quotation, billing, invoice, receipt, and tax-ready document work.

This is a presentation reference. It does not override workflow policy, numbering rules, legal/tax requirements, or schema constraints.

## 1. Document Family To Support

The examples show one coherent family of commercial documents with the same print skeleton and small per-document differences.

- `ใบเสนอราคา / Quotation`
- `ใบวางบิล / ใบแจ้งหนี้ / Billing Slip / Invoice`
- `ใบเสร็จรับเงิน / Receipt`
- `ใบกำกับภาษี / Tax Invoice`

FOGUS should treat these as one shared document system rather than four unrelated page designs.

## 2. Core Design Direction

### 2.1 Print-first skeleton

- A4 document first, screen preview second.
- Dense but calm layout with wide white space and tight alignment.
- Top-left seller identity block.
- Top-right document title and metadata block.
- Middle item table with a restrained grid.
- Right-aligned totals summary.
- Footer notes and signature area.

### 2.2 Shared frame, different accents

The examples keep the layout almost identical across document types and change identity using:

- document title
- corner ribbon color
- a few metadata fields specific to the document type

Recommended accent mapping from the references:

- `Quotation`: orange
- `Billing / Invoice`: purple
- `Receipt`: green
- `Tax Invoice`: blue

FOGUS should reuse one commercial-document shell and vary accent tokens by document type instead of redesigning each document from scratch.

### 2.3 Document, not dashboard

- Use table and document composition, not cards or dashboard panels.
- Preserve thin rules, compact text, and formal grouping.
- Mobile preview can be scrollable, but the document itself should remain visually faithful to an A4 page.

## 3. Shared Anatomy

Every commercial document should be modeled around these sections.

### 3.1 Seller block

Top-left block should support:

- business logo
- legal business name
- company address
- tax ID
- branch or head-office label when available
- phone, email, or contact channel as needed

### 3.2 Buyer block

Customer block should support:

- customer or company name
- customer address
- tax ID if present
- branch if present
- contact name
- phone and email if present

### 3.3 Metadata block

Top-right metadata area should support a small, readable list of fields such as:

- document number
- issue date
- due date or credit term
- reference quote or invoice number
- payment due date
- customer code if the business later needs it

### 3.4 Item table

Table should include:

- running number
- item or service description
- quantity
- unit price
- line total

The examples show a visually restrained table. Borders should stay light and the row count should scale without breaking the page rhythm.

### 3.5 Totals block

The right summary area should consistently support:

- subtotal
- discount
- amount after discount
- VAT 7%
- grand total
- withholding tax only if the business logic later supports it

### 3.6 Notes area

The lower content area should support:

- payment terms
- service notes
- validity notes
- delivery or billing notes
- receipt remarks

### 3.7 Signature area

The examples keep a formal footer signature zone for issuer and customer. FOGUS should support:

- seller signature label
- customer signature label
- printed name placeholder
- signing date placeholder
- optional digital stamp or signature image when supported

## 4. Per-Document Differences

### 4.1 Quotation

Primary purpose:

- confirm scope, pricing, tax, and validity before approval

Key fields from the examples:

- quote number
- issue date
- valid-until date
- customer summary
- service or item list
- totals and VAT
- quotation note area
- acceptance signature area

### 4.2 Billing / Invoice

Primary purpose:

- notify the customer of the payable amount and due date

Key fields from the examples:

- invoice or billing number
- issue date
- due date
- credit term
- reference quote number when applicable
- totals and VAT
- payment-related note area

### 4.3 Receipt

Primary purpose:

- confirm money received against a billed amount

Key fields from the examples:

- receipt number
- receipt date
- reference invoice number
- payment amount
- payment method indicators or notes
- totals and received amount

### 4.4 Tax Invoice

Primary purpose:

- formal tax-ready commercial document with seller and buyer tax identity

Key fields from the examples:

- tax invoice number
- seller tax ID and branch
- buyer tax ID and branch
- issue date
- taxable amount
- VAT amount
- grand total

Important guardrail:

FOGUS should treat this as a `tax-ready design reference` until legal fields, numbering policy, seller registration data, customer tax identity, and compliance workflow exist in schema and operations.

## 5. Mobile Editing And Preview Lessons

The mobile examples are useful for more than print layout. They show a good pattern for document editing and preview on a phone.

### 5.1 What to copy

- strong document title at the top
- compact metadata just below title
- line items shown in a clean editable list
- totals area grouped together and easy to scan
- a direct path into preview
- one visual family across all document types

### 5.2 What FOGUS should avoid

- turning the document editor into a long admin form without structure
- making mobile preview look like cards instead of document pages
- mixing quotation, invoice, receipt, and tax invoice into one ambiguous screen

## 6. FOGUS Adaptation Rules

### 6.1 Shared shell

Build one reusable commercial-document shell and inject:

- title
- accent token
- metadata rows
- legal blocks
- item table data
- totals
- notes
- signatures

### 6.2 Runtime data boundaries

Current FOGUS quote data can already support much of the quotation layout in `src/app/quote/[token]/download/page.tsx`, but billing, receipt, and tax invoice documents will need additional structured fields.

Do not fake legal data. Use visible placeholders where the system lacks:

- tax ID
- branch
- company address
- customer tax profile
- compliant document numbering
- payment receipt evidence

### 6.3 Route guidance

Recommended route family once the schema exists:

- `/quote/[token]/download`
- `/invoice/[token]`
- `/billing/[token]`
- `/receipt/[token]`
- `/tax-invoice/[token]`

### 6.4 Print behavior

- Keep `@page` A4 behavior explicit.
- Hide toolbars in print.
- Preserve page fidelity in browser print preview.
- Keep screen preview usable on mobile without distorting the underlying A4 composition.

## 7. Implementation Checklist For Future Work

Before building runtime invoice, billing, receipt, or tax-invoice surfaces, confirm:

- document numbering source is defined
- seller legal identity fields exist in runtime config or schema
- customer billing and tax identity fields exist
- payment state and receipt state are explicit
- preview and print flows are separated from workflow state transitions
- LINE customer pages remain token-based and login-free

## 8. Relationship To Existing Files

- `docs/INVOICE_FLOW_PATCH.md` defines the proposed workflow and billing flow direction.
- `src/app/quote/[token]/download/page.tsx` is the current quotation print/download implementation anchor.
- This file defines the visual reference for future commercial document surfaces so the implementation stays consistent with the provided examples.