# Next Session Handoff

> อ่านไฟล์นี้ก่อนเริ่ม session ใหม่ — ป้องกัน context loss ตอนย้าย session

## วิธีใช้

- ก่อนจบ session: อัปเดตไฟล์นี้ให้ตรงกับสถานะปัจจุบัน
- เริ่ม session ใหม่: อ่านไฟล์นี้ + `docs/CLAUDE_LESSONS.md` ก่อนทำงาน
- ถ้าเริ่มงานใหม่หมด → ลบ section "In-flight" และอัปเดต "Next up"

---

## เพิ่งจบ (most recent merged PRs)

| PR | Title | Merged |
|---|---|---|
| #79 | feat(quotes): per-line discount on quote_items + inline admin editor | 2026-05-16 |
| #78 | feat(accounting): tax-ledger CSV export (document + payment centric) | 2026-05-16 |
| #77 | fix(wht): prefer locked customer_tax_profile + L29/L30 lessons | 2026-05-16 |
| #76 | feat(wht): 50 ทวิ withholding tax certificate print page | 2026-05-16 |
| #75 | fix(pickup): REVOKE PUBLIC + tighten mark_done gate | 2026-05-16 |
| #74 | feat(pickup): admin proof-of-pickup + auto-flip fulfillment | 2026-05-16 |
| #73 | docs: L22–L26 lessons from PR #71 + #72 Codex review | 2026-05-16 |

**P0 backlog ปิดครบ 7/7** (PR #62–#69) — รายละเอียดดู `docs/SALES_JOB_FULL_FLOW.md` §"P0 gaps"
**P1 backlog ปิดครบ 4/4** (PR #74–#79) — pickup proof, 50ทวิ, accounting export, per-item discount

---

## In-flight (ค้างกลางทาง)

_ไม่มี — main เป็น clean state, ทุก PR merged แล้ว_

---

## Next up (Wave 5 / P2 backlog)

ระบบ MVP พร้อมรัน end-to-end แล้วทุก scenario (prepaid/deposit/credit × pickup/delivery/install × person/company × WHT/no-WHT). งานที่เหลือเป็น Wave 5 หรือ "nice-to-have" — เลือกตามลำดับ business value:

### Quality-of-life (medium impact)

1. **Unit-aware pricing (sqm vs piece)** — `quote_items.unit` column + intake price calc supports area-based pricing for products like vinyl banners. Touches `/api/intake`, `product_catalog_items`, manual-intake.
2. **LIFF intake repeater UI** — multi-item submit (e.g. "ไวนิล 2 ขนาด + สติกเกอร์") in one form. Today admin uses `/admin/manual-intake` or adds items after intake.
3. **Quote-level discount UI** — `quotes.discount` column exists but has no UI. PR #79 added line-level discount; this is the complement.
4. **Rush fee / priority surcharge** — for urgent jobs. Schema + UI knob, applies to totals.
5. **Native .xlsx export** (PR #78 follow-up) — currently both accounting CSVs are UTF-8 BOM CSV; some accountants want true `.xlsx`. Use `xlsx` npm package or SheetJS.
6. **Customer signature canvas** in `/install/[token]` and admin pickup page — replaces "name typed by admin" with electronic signature.

### Integrations (high effort, deferred till MVP traction)

7. **OCR for bank slips** — auto-fill amount/date/account from upload.
8. **Bank statement auto-reconciliation** — match incoming payments to invoices.
9. **Lalamove/Grab API integration** — book deliveries from admin without leaving the app.
10. **ERP push** (Express, FlowAccount, AutoCount, etc.) — push commercial documents + payments out.
11. **Quote clone with overrides** (qty/dimensions) — currently clone is exact copy.

### Infra / hardening

12. **R2 media storage rollout** (TASK-033) — move from Supabase storage to Cloudflare R2 for cost.
13. **First-class staff ownership model** (TASK-025) — sales rep + designer + production assigned to jobs.
14. **Persisted WHT certificate numbering** — current scheme `WHT-<id>-<date>` is derived. For legal records use a sequential number per receiver entity.
15. **Workflow policy: BILLING_NOTE / INVOICE / standalone TAX_INVOICE** — v1 only ships RECEIPT + TAX_INVOICE_RECEIPT.

---

## งานที่ **อย่าทำซ้ำ** (กี้อยู่แล้ว / ตัดสินใจไว้แล้ว)

- VOID / CREDIT_NOTE / DEBIT_NOTE → frozen out of v1
- C3 deposit document issuance → blocked until v2 packet ships Thai partial-tax-invoice rule

---

## Workflow checklist สำหรับทุก PR

1. Branch off `main` ที่ sync ล่าสุด
2. Schema migration (ถ้ามี) → apply to prod via Supabase MCP `apply_migration`
3. API route → admin/customer UI → tests
4. `npm run lint` + `npx tsc --noEmit` + `npm run build` clean (อ้าง L21)
5. Push → wait CI → auto-merge `gh pr merge <n> --merge --delete-branch` เมื่อ green
6. Sync main → study Codex inline comments → append to `CLAUDE_LESSONS.md` ถ้ามี P1/P2 finding ใหม่
7. อัปเดต `docs/NEXT_SESSION.md` (ไฟล์นี้) ก่อนจบ session

---

## Lessons learned so far (อ่านก่อนเขียนโค้ดใหม่)

`docs/CLAUDE_LESSONS.md` มีบทเรียน L1–L30 ครอบ:
- Migration: signature change ต้อง DROP ก่อน (L8 L22)
- RPC security: REVOKE EXECUTE FROM PUBLIC + grant to service_role (L27)
- Workflow gates ต้องอยู่ใน DB ไม่ใช่แค่ UI (L20 L28)
- Atomic array append / cumulative balance check (L11 L16)
- Storage cleanup on DB write fail (L17)
- Multi-table writes ต้อง atomic หรือ cleanup-on-fail (L19)
- Server-side gates ต้องบังคับ business rule แม้ admin UI ซ่อนปุ่ม (L20)
- System auto-transition ห้าม log ผ่าน logHumanAction (L23)
- POST + PATCH validators ต้อง symmetric (L24)
- Deactivation guard ต้องครอบทุก downstream gate (L25)
- VAT receiver ต้อง address ไม่ใช่แค่ tax_id (L26)
- Tax form code (ภ.ง.ด.3/53) มาจาก payee (L29)
- Tax document ใช้ locked tax profile exclusive ห้าม mix กับ lead (L30)

---

## Reference สำคัญ

| ไฟล์ | บทบาท |
|---|---|
| `docs/CLAUDE_LESSONS.md` | บทเรียน L1–L30 — **อ่านก่อนเริ่มทุก session** |
| `docs/SALES_JOB_FULL_FLOW.md` | E2E flow + gap analysis |
| `docs/workflow-policy.json` | Canonical workflow contract |
| `AI_WORKFLOW_GUARD.md` | อ่านก่อนแก้ workflow logic |
| `CLAUDE.md` | Codebase quick reference |
