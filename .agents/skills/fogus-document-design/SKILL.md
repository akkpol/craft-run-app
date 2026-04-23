---
name: fogus-document-design
description: Design or refactor FOGUS quotation, invoice, billing, receipt, and tax-ready document surfaces. Use when working on `/quote/[token]/download`, print/PDF layouts, customer-facing quotation documents, invoice or tax-invoice planning, or when an agent might otherwise replace the canonical FOGUS document design with a generic card UI.
---

# FOGUS Document Design

## Overview
Use this skill to keep FOGUS commercial documents consistent with the approved quotation template while preserving the existing LINE/LIFF/quote workflow. Treat document design as a presentation layer over current quote data unless the user explicitly asks for invoice or tax schema work.

## Canonical Direction
- Use the old quotation template as the visual source of truth: `scripts/generate_quote_template_pdf.py`, `output/pdf/quotation-template-standard.pdf`, and `tmp/pdfs/quotation-template-standard-page-1.png`.
- Keep `/quote/[token]` as the customer action page for approve/reject/rescope.
- Keep `/quote/[token]/download` as the printable/downloadable A4 quotation document.
- Prefer HTML print for runtime documents in v1 because it can bind directly to Supabase quote data without adding server-side PDF generation risk.
- Do not change `src/lib/quote-workflow.ts`, payment gates, approval behavior, or workflow state transitions for document-only work.

## Required Quotation Structure
Every quotation print/download surface should include:
- Thai/English title: `ใบเสนอราคา / Quotation`.
- Document number, issue date, and valid-until date.
- Seller block with business name, contact channels, and placeholders for missing legal fields.
- Bill-to block with customer name and contact fields from the runtime customer record.
- Project or service summary derived from product, dimensions, and quantity.
- Item table with number, description, quantity, unit price, and amount.
- Subtotal, discount, VAT 7%, and grand total.
- Payment terms, payment status, quote status, notes, reference info, contact line, authorized signature, and customer acceptance.

## Invoice And Tax-Invoice Guardrails
- Treat FlowAccount quotation, invoice, and tax-invoice pages as product-shape references: quotation data should carry forward into later billing documents without re-keying.
- Do not implement invoice or tax-invoice runtime behavior until the repo has explicit schema and policy for document sequence, tax ID, branch, seller/customer address, VAT registration, receipt/payment state, and e-Tax handling.
- Label tax-invoice work as `tax-ready design reference` unless legal/tax fields and numbering rules are present. Do not claim the app issues compliant tax invoices from the current quote schema alone.
- If invoice or tax-invoice work is requested, first map what can be derived from `quotes`, `quote_items`, `leads`, `customers`, and `app_settings`, then list the missing legal/accounting fields before adding UI.

## Design Rules
- Design for A4 print first, then make the screen preview usable on desktop and mobile.
- Use document-like borders, compact typography, and table layout rather than dashboard cards.
- Hide action toolbars in print with `print:hidden`.
- Use real runtime data where available and visible placeholders only where the current schema lacks legal fields.
- Preserve Thai copy first, with concise English labels where useful for document clarity.

## Validation
- Check `/quote/[token]/download` in screen preview and browser print preview.
- Verify `@page` is A4, print margins are controlled, and no toolbar appears in print.
- Verify totals and VAT come from existing quote fields rather than recalculating incompatible business logic.
- Run typecheck/build after changes. Run workflow-policy smoke only if workflow policy or state surfaces changed.
