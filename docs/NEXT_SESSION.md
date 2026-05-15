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
| #73 | docs: L22–L26 lessons from PR #71 + #72 Codex review | 2026-05-16 |
| #72 | feat(install): auto-flip jobs.fulfillment_status to delivered on install done | 2026-05-15 |
| #71 | feat(admin): commercial entities editor | 2026-05-15 |
| #70 | docs: P0 backlog closed + L19/L20 from PR #69 Codex | 2026-05-15 |
| #69 | feat(quotes): clone (reorder) existing quote for returning customers | 2026-05-15 |

**P0 backlog ทั้ง 7 ตัวปิดครบ** (PR #62–#69) — รายละเอียดดู `docs/SALES_JOB_FULL_FLOW.md` §"P0 gaps"

---

## In-flight (ค้างกลางทาง)

_ไม่มี — main เป็น clean state, ทุก PR merged แล้ว_

---

## Next up (P1 backlog — pick top of list)

ลำดับตามคุ้มค่า business + ความง่ายของ implementation:

### 1. Pickup proof of delivery 🎯 **(เริ่มอันนี้ก่อน)**

- **Gap:** mode `pickup` ใน `jobs.fulfillment_mode` ไม่มี evidence ของการส่งมอบ — ลูกค้ามารับ admin manual confirm
- **Why first:** pattern proven แล้ว (เหมือน install proof #67) + ปิดงานนี้คือปิด fulfillment proof ครบทุก mode (install ✅ delivery ✅ pickup ❌)
- **Scope:**
  - Schema: เพิ่มคอลัมน์ลง `jobs` — `pickup_proof_paths text[]`, `picked_up_at timestamptz`, `pickup_recipient_name text`
  - RPC: `record_pickup_proof(p_job_id, p_storage_path, p_recipient_name)` — append photo + flip `fulfillment_status='delivered'` atomic
  - API: `POST /api/admin/jobs/[id]/pickup-proof` — multipart upload (อันนี้ admin only เพราะ pickup เกิดที่หน้าร้าน)
  - UI: `/admin/jobs/[id]/fulfillment` panel — สำหรับ `fulfillment_mode='pickup'` แสดงปุ่ม "บันทึกส่งมอบ" + รูป + ชื่อผู้รับ
- **Lessons ต้องใช้:** L16 (atomic array append), L17 (storage cleanup on DB fail), L20 (server-side gate), L23 (system actor for auto-transition)

### 2. 50ทวิ certificate PDF generation

- **Gap:** ระบบเก็บ wht_amount ครบแล้ว (PR #65) แต่ไม่มี PDF cert ให้ลูกค้า/บัญชี
- **Scope:** PDF template ตามฟอร์ม กรมสรรพากร + `/api/commercial/documents/wht-cert/[paymentId]` route
- **Skill ต้องมี:** Thai tax form layout, React PDF / Puppeteer (เคยใช้แล้วใน PR ก่อน)

### 3. Accounting CSV/Excel export

- **Gap:** Finance ต้องเข้า Supabase query เอง
- **Scope:** `/admin/accounting/export` page → filter period → render table → download CSV
- **ขนาดงาน:** ~3 ชม. (mostly query + sheet format)

### 4. Per-item discount / unit (sqm vs piece)

- **Gap:** `quote_items` ตอนนี้มี flat unit_price — ไม่รองรับ discount/item หรือ pricing by sqm
- **Scope:** schema migration + admin items editor + recompute totals helper
- **ขนาดงาน:** ~5 ชม. — touches `compute-totals.ts`, `quote-items` CRUD, snapshot logic

---

## งานที่ **อย่าทำ** (เพราะเลื่อนเป็น Wave 5 ตามมติเดิม)

- OCR for bank slips
- Lalamove/Grab API integration (book + status polling)
- Customer signature canvas in install page
- R2 media storage rollout
- First-class staff ownership model
- LIFF intake repeater UI (multi-item at submit)

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

## Reference สำคัญ

| ไฟล์ | บทบาท |
|---|---|
| `docs/CLAUDE_LESSONS.md` | บทเรียน L1–L26 จาก past PRs — **อ่านก่อนเริ่มทุก session** |
| `docs/SALES_JOB_FULL_FLOW.md` | E2E flow + gap analysis + P0/P1 backlog |
| `docs/workflow-policy.json` | Canonical workflow contract |
| `AI_WORKFLOW_GUARD.md` | อ่านก่อนแก้ workflow logic |
| `CLAUDE.md` | Codebase quick reference |
