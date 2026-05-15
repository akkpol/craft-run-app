# Claude Lessons Learned

บทเรียนจากความผิดพลาดที่ AI agent (Claude) ทำในโปรเจกต์นี้ — เก็บไว้ให้ Claude session ถัดไปอ่านก่อนเริ่มงานเพื่อไม่พลาดซ้ำ

**กติกา:**
- เพิ่ม entry ใหม่ทุกครั้งที่ reviewer (Codex, มนุษย์) พบ pattern ที่เกิดจาก AI mistake
- ลบ entry ออกได้เมื่อแน่ใจว่าไม่ใช่ pattern ที่เกิดซ้ำแล้ว
- ต้องมี: ชื่อ pattern, สิ่งที่ทำผิด, สิ่งที่ควรทำ, ตัวอย่างจาก commit/PR จริง

---

## L1 — เปลี่ยน data source ห้ามลบ fallback เดิม

**Pattern:** เมื่อย้าย data source จาก global → per-entity (หรือกลับกัน) ห้าม `replace` ต้อง `override`

**ผิดอย่างไร:**
- PR #56, S1: เปลี่ยน `documentAppendix` จาก `app_settings.documentAppendixImageUrl` (global) → `lead.ai_generated_images` (per-order)
- ลืม fallback → order เก่าๆ ที่ไม่มี AI image **เงียบๆ สูญหาย** appendix ที่ admin ตั้งใน settings (เช่น bank QR)

**ทำอย่างไรให้ถูก:**
```ts
// ✗ ผิด: replace
const appendix = leadImage ? buildFromLead() : null;

// ✓ ถูก: override + fallback
const appendix = leadImage
  ? buildFromLead()
  : globalSetting
    ? buildFromSetting()
    : null;
```

**Reference fix:** `src/lib/commercial-document-appendix.ts` (commit `d47cc8d`)

---

## L2 — เปิด gate ที่ UI = ต้อง trace downstream ทุกตัว

**Pattern:** เวลาขยาย condition ที่ "ให้ admin ทำ X ได้เมื่อ Y" ห้ามดูแค่ UI ต้องตามไปดู endpoint/RPC ที่ถูกเรียกว่าทำงานถูกใน Y ใหม่หรือไม่ — โดยเฉพาะเรื่องเงิน/ภาษี/เอกสาร

**ผิดอย่างไร:**
- PR #56, C3: เปลี่ยน `canIssueCommercialDocument` ให้รองรับ `deposit + partial`
- ลืม trace ไปที่ `/api/commercial/documents/issue` ที่ยังใช้ `quoteTotal` (ยอดเต็ม) สร้างใบกำกับ → ใบกำกับออกเต็มยอด ทั้งที่ลูกค้าจ่ายแค่มัดจำ → **compliance bug**

**ทำอย่างไรให้ถูก:**
1. หา downstream consumer ทั้งหมดของ gate (grep ชื่อ field, route handler ที่อ่านค่าเดียวกัน)
2. ตรวจว่า edge case ใหม่ (e.g. partial) มี logic รองรับมั้ย
3. ถ้าไม่รองรับ — เลือก (a) ไม่ปลด gate หรือ (b) ปลด gate + แก้ downstream ใน PR เดียวกัน
4. **ห้าม** ปลด gate โดยมีแค่ part (a) แล้วฝากให้ "ทำ part (b) ทีหลัง"

**Reference:** Codex review บน PR #56 (P1)

---

## L3 — Plan เขียน "verify X" = ต้อง verify จริง ไม่ใช่ตรวจชื่อ

**Pattern:** เมื่อแผนสั่งให้ "verify policy" / "check schema" / "trace logic" — ต้องเปิดไฟล์อ่านจริง ไม่ใช่แค่ grep เจอชื่อแล้วผ่าน

**ผิดอย่างไร:**
- PR #56, C3 step 3: แผนเขียนว่า "ตรวจ `docs/workflow-policy.json` ว่ามีกฎกำกับมั้ย"
- ผม grep เจอคำว่า `issue_commercial_document` ในแค่ catalog list → คิดว่า "ไม่มีกฎเฉพาะ ผ่าน"
- ไม่ได้เปิดอ่านไฟล์ `commercial-document-issue.ts` ที่เป็น downstream logic จริง

**ทำอย่างไรให้ถูก:**
- "Verify X" = อ่านไฟล์ X เต็มๆ (หรืออย่างน้อยส่วนที่เกี่ยวข้อง) ไม่ใช่ grep ผ่าน
- ถ้าจะ grep ต้อง follow-up ด้วยการ Read context รอบๆ match

---

## L4 — ห้ามเขียน plan ซ้ำเมื่อยังไม่เข้าใจของเดิม

**Pattern:** เวลาเข้า session ใหม่ที่มี plan file อยู่แล้ว — อ่าน plan ทั้งหมดก่อน ห้ามเขียนทับด้วยสมมติฐานของตัวเอง

**ผิดอย่างไร:**
- Session บางครั้งผมเขียนทับ plan file 2 รอบก่อนได้ของถูก — ครั้งแรกใส่ของที่ไม่ได้คุยกันในแชท ครั้งสองตัดข้อมูลสำคัญที่อยู่ใน plan เดิมทิ้ง
- เปลือง token ผู้ใช้ และทำให้ผู้ใช้หงุดหงิด

**ทำอย่างไรให้ถูก:**
- ก่อนเขียน plan ใหม่ — Read plan file เดิมทั้งหมด
- ถ้าไม่ชัวร์ว่าจะใส่อะไร/ตัดอะไร — ใช้ `AskUserQuestion` ถามก่อน 1 รอบ ดีกว่าเขียนทับผิด

---

## L6 — Filter ด้วย enum value ต้องอ้าง canonical source ห้ามเดา case

**Pattern:** เมื่อ query ที่ filter ด้วย enum (status, type, role) ต้องเช็คค่าจริงจาก enum definition ก่อน ห้ามเดาจาก convention ทั่วไป (lowercase/camelCase/UPPER)

**ผิดอย่างไร:**
- PR #57, `dashboard-trends.ts`: filter `.eq("status", "completed")` แต่ canonical enum คือ `"COMPLETED"` (uppercase, ดู `JOB_STATUSES` ใน `src/lib/types.ts`)
- ผลคือ query ไม่ match row ไหนเลย — "Job ปิด" line ในกราฟจะเป็น 0 ตลอดใน production

**ทำอย่างไรให้ถูก:**
- Grep หา enum definition ก่อนเสมอ:
  ```
  grep -E "^export const (JOB|PAYMENT|STATE)_STATUSES" src/lib/types.ts
  ```
- Import จาก types เลย ห้ามเขียน string literal:
  ```ts
  // ✗ ผิด
  .eq("status", "completed")
  // ✓ ถูก
  .eq("status", JOB_STATUSES.COMPLETED)
  // หรืออย่างน้อย match case จริง
  .eq("status", "COMPLETED")
  ```

**Reference fix:** commit `c91d52a`

---

## L7 — Mix timezone ใน date query ทำให้ undercounted แถวขอบวัน

**Pattern:** ถ้า label หรือ aggregation key เป็น timezone หนึ่ง — bound ของ SQL filter ก็ต้องเป็น timezone เดียวกัน ห้ามผสม

**ผิดอย่างไร:**
- PR #57, `dashboard-trends.ts`: day keys คำนวณใน Asia/Bangkok แต่ `start.setUTCHours(0,0,0,0)` ใช้ UTC midnight
- ผลคือวันแรกของกราฟ undercount แถวที่ created 01:00–07:00 Bangkok (ซึ่งเป็น 18:00–00:00 UTC ของวันก่อนหน้า) — รอบ early morning ตกหล่นทุกครั้ง

**ทำอย่างไรให้ถูก:**
1. ทำ "วันใน timezone เป้าหมาย" → UTC offset → ส่งให้ SQL filter
   ```ts
   const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
   const bangkokMidnight = new Date(now.getTime() + BANGKOK_OFFSET_MS);
   bangkokMidnight.setUTCHours(0, 0, 0, 0);
   const utcLowerBound = new Date(bangkokMidnight.getTime() - BANGKOK_OFFSET_MS);
   ```
2. หรือใช้ Postgres `AT TIME ZONE 'Asia/Bangkok'` ใน SQL ฝั่ง DB เพื่อกัน drift

**Reference fix:** commit `c91d52a` + tests `tests/dashboard-trends.test.ts`

---

## L8 — `RETURNS TABLE` output column ชนกับ table column ใน `RETURNING`

**Pattern:** ถ้าฟังก์ชัน PL/pgSQL ประกาศ `RETURNS TABLE (col_name ...)` และในตัวฟังก์ชัน update table ที่มี column ชื่อเดียวกัน — `RETURNING col_name INTO var` จะ **ambiguous** เพราะ Postgres ไม่รู้ว่าหมายถึง table column หรือ output column (ที่กลายเป็น variable ใน PL/pgSQL scope)

**ผิดอย่างไร:**
- migration `20260515080000_add_payment_idempotency_rpc.sql` (จาก PR #54) สร้าง RPC `confirm_commercial_payment` ที่ `RETURNS TABLE (..., payment_receiver_locked_at timestamptz, ...)`
- ใน function body มี `update commercial_orders SET payment_receiver_locked_at = ... RETURNING payment_receiver_locked_at INTO v_locked_at`
- RPC **500 ทุกครั้ง** ที่ admin กด confirm payment: `ERROR: 42702: column reference "payment_receiver_locked_at" is ambiguous`
- Codex ไม่ได้ flag จาก static review (RPC syntax valid) — เจอตอน E2E live test เท่านั้น

**ทำอย่างไรให้ถูก:**
```sql
-- ✗ ผิด: ambiguous
update commercial_orders
   set payment_receiver_locked_at = v_paid_at
 where id = v_order.id
 returning payment_receiver_locked_at into v_locked_at;

-- ✓ ถูก: alias table
update commercial_orders co
   set payment_receiver_locked_at = v_paid_at
 where co.id = v_order.id
 returning co.payment_receiver_locked_at into v_locked_at;
```

**Prevention checklist เมื่อเขียน RPC ที่ใช้ `RETURNS TABLE`:**
- ตั้งชื่อ output column ให้ **ต่าง** จาก column ของ table ที่ update/insert (เช่น `out_payment_locked_at`) **หรือ**
- ใส่ **table alias** ในทุก `UPDATE` ที่มี `RETURNING` แล้วใช้ `alias.column` ใน returning
- เขียน **integration test** ที่เรียก RPC จริงๆ ไม่ใช่แค่ smoke test ที่ check signature เพราะ syntax-valid แต่ runtime fail

**Reference fix:** migration `20260515150000_fix_confirm_payment_ambiguous_column.sql`

---

## L11 — App-level cumulative/balance check มี race window — enforcement ต้องอยู่ใน lock

**Pattern:** ถ้า business rule คำนวณจาก sum/aggregate ของหลาย rows (e.g. cumulative payments ≤ quote.total) — pre-check ใน HTTP route **ก่อนเรียก write RPC** มี race window ที่ admin 2 คน confirm ปริมาณงานพร้อมกัน → ทั้งคู่ pass check → ทั้งคู่ insert → overpay/overcommit

**ผิดอย่างไร:**
- PR #64, `/api/quotes/[id]/commercial`: หลังตรวจ `validatePaymentAmount` ผมเพิ่ม app-level check:
  ```ts
  const balance = await getQuoteOutstandingBalance(supabase, id);
  if (amount > balance.outstanding + 0.01) return 422;
  // ...then call RPC
  ```
- Codex P2: admin A กับ admin B ส่ง 2 idempotency keys ในเวลาเดียวกัน — ทั้งคู่อ่าน outstanding=70 ก่อน RPC ตัวแรกจะ commit — RPC ตัวที่ 2 serialize บน order row lock แต่ **ไม่ได้ re-check cumulative** → insert payment row อีกหนึ่ง → sum > quote.total

**ทำอย่างไรให้ถูก:**
- ย้าย cumulative check **เข้าไปใน RPC** ที่ถือ row lock ของ commercial_orders
  ```sql
  -- inside confirm_commercial_payment after row lock
  select coalesce(sum(amount), 0) into v_paid_total
    from public.payments p
   where p.order_id = v_order.id and p.status = 'CONFIRMED';
  v_outstanding := v_quote_total - v_paid_total;
  if p_amount > v_outstanding + 0.01 then
    raise exception 'PAYMENT_AMOUNT_EXCEEDS_OUTSTANDING: ...';
  end if;
  ```
- HTTP route ยังคำนวณ balance ได้เพื่อแสดง UI แต่ **ห้ามใช้ enforce business rule**

**Prevention checklist:**
- ทุก aggregate-based business rule (sum, count, exists check) ที่ตัดสินใจ write → enforcement อยู่ใน DB transaction ที่ถือ lock เดียวกับ write
- HTTP/app-layer pre-check ใช้ได้แค่เพื่อให้ UX ดี (skip RPC call ที่จะ fail แน่นอน) ไม่ใช่เพื่อความถูกต้อง
- เขียน concurrent test (2 simultaneous requests) เพื่อ verify

**Reference fix:** commit `88a06ab` + migration `20260515171845_enforce_commercial_payment_balance_lock.sql`

---

## L12 — Status update ของ workflow ห้าม overwrite job-derived state

**Pattern:** เมื่อ payment route อัปเดต conversation.state แบบ unconditional ตาม `getQuoteApprovalState(terms, status)` — มันจะรีเซ็ต state ที่ job เคยขยับไปแล้ว (เช่น IN_PRODUCTION, READY_FOR_FULFILLMENT) กลับเป็น IN_DESIGN

**ผิดอย่างไร:**
- PR #64, balance payment: ลูกค้าจ่ายมัดจำ → IN_DESIGN → admin start job → IN_PRODUCTION → admin บันทึกรับชำระยอดที่เหลือ
- Route เดิม:
  ```ts
  if (quote.leads?.conversation_id && quote.status === "approved") {
    await supabase.from("conversations").update({ state: nextWorkflowState }).eq(...);
    // nextWorkflowState = getQuoteApprovalState("deposit", "paid") = "IN_DESIGN"
  }
  ```
- ผล: IN_PRODUCTION → IN_DESIGN ถอยหลัง workflow

**ทำอย่างไรให้ถูก:**
```ts
const existingJobs = Array.isArray(quote.jobs) ? quote.jobs : [];
const hasExistingJob = existingJobs.length > 0;

if (productionUnlocked) {
  if (hasExistingJob) {
    // reuse — don't recreate or rewind state
    jobId = existingJobs[0]?.id ?? null;
  } else {
    // first unlock: create job + transition state
    const jobResult = await createJobForApprovedQuote(...);
  }
} else if (conversation_id && quote.status === "approved" && !hasExistingJob) {
  // only update state when no job has taken over the workflow
  await supabase.from("conversations").update({ state: nextWorkflowState })...;
}
```

**Prevention checklist:**
- Payment updates ต้องตอบ "ใครเป็นเจ้าของ state ปัจจุบัน": ถ้ามี job แล้ว → job route เป็นเจ้าของ, payment route ห้ามแตะ
- Workflow transitions เป็น state machine — ห้ามมี edge ที่ทำให้ถอยหลังโดยไม่ตั้งใจ
- เขียน test: deposit → job → IN_PRODUCTION → balance payment → expect state ยังเป็น IN_PRODUCTION

**Reference fix:** commit `88a06ab` (`hasExistingJob` branch)

---

## L13 — เพิ่ม split field ใน paymentAmount (cash vs WHT) ต้องอัปเดต **validator** ด้วย ไม่ใช่แค่ amount เดียว

**Pattern:** เมื่อ feature ใหม่ทำให้ "ยอดที่ส่งไปยัง endpoint" แยกเป็น 2 ส่วน (เช่น cash + wht) — validator ทุกตัวที่เคยตรวจ `amount === amountDue` ต้องถูกอัปเดตให้ตรวจ `cash + wht === amountDue` ไม่งั้น flow ใหม่จะ fail ทันที

**ผิดอย่างไร:**
- PR #65, admin UI: ส่ง `paymentAmount = quoteTotal - whtAmount` (cash portion) + `whtAmount` แยก
- แต่ commercial route ยังเรียก `validatePaymentAmount({ paymentAmount: cash, amountDue: quote.total })` — สำหรับ prepaid logic คือ `amount === amountDue` exact
- ผล: B2B prepaid ที่มี WHT → cash < total → 422 `PAYMENT_AMOUNT_UNDERPAID` → flow ใช้ไม่ได้ทันทีตอนเปิด
- Codex P2 บน PR #65; แก้ใน commit `fe0e0c6` — ปรับ validator ให้ใช้ `cash + wht` ตอน prepaid

**ทำอย่างไรให้ถูก:**
```ts
// ✗ ผิด — ใช้ cash อย่างเดียว
validatePaymentAmount({
  paymentTerms,
  paymentAmount: cashAmount,
  amountDue: Number(quote.total || 0),
});

// ✓ ถูก — count credited amount เป็น cash + wht
validatePaymentAmount({
  paymentTerms,
  paymentAmount: cashAmount + whtAmount,
  amountDue: Number(quote.total || 0),
});
// RPC ยัง insert cash ไว้ใน payments.amount และ wht ใน payments.wht_amount แยก
```

**Prevention checklist เมื่อ split single field เป็นหลาย field:**
- Grep ทุก validator/check ที่อ่าน field เดิม → อัปเดตให้คำนวณ aggregate
- เขียน test สำหรับเคส **prepaid + split** ทุก term (prepaid/deposit/credit) — เพราะแต่ละ term มี validation rule ต่างกัน
- คิดจุดเปลี่ยน semantic: "amount ที่ user transfer มา" vs "amount ที่ credit ให้ลูกค้า" (cash + wht) — อย่าให้ปนกัน

**Reference fix:** commit `fe0e0c6` "Fix prepaid WHT payment validation"

---

## L14 — แก้ totals = ต้อง re-resolve snapshot ทุกตัวที่ถูก derive จาก totals

**Pattern:** ถ้า column `X` (e.g. `payment_profile_snapshot`) ถูก derive จาก quote totals ตอน issue — เมื่อ totals เปลี่ยน (item ถูกเพิ่ม/ลบ/ราคาเปลี่ยน) ต้อง **recompute snapshot** ในการ update เดียวกัน ไม่งั้น UI ที่ prefer snapshot จะแสดงของเก่า

**ผิดอย่างไร:**
- PR #66, `POST/DELETE /api/admin/quotes/[id]/items`: รอบแรกอัปเดตเฉพาะ `subtotal/vat/total` ลืม `payment_profile_snapshot`
- Customer page อ่าน `quote.payment_profile_snapshot` ก่อน fallback มา recompute → เห็นบัญชี/QR เก่า (ที่ถูกเลือกตอน threshold เดิม)
- Codex P2 บน #66: เพิ่ม item ทำให้ total ข้าม secondary-routing threshold → snapshot เก่า → ลูกค้าโอนเงินผิดบัญชี

**ทำอย่างไรให้ถูก:**
```ts
// ✗ ผิด — update เฉพาะ totals
await supabase.from("quotes").update({ subtotal, vat, total }).eq("id", id);

// ✓ ถูก — refresh derived snapshot ด้วย
const paymentProfileSnapshot = resolvePaymentProfileFromConfig(appConfig, {
  total,
  billingEntityType,
  paymentTerms,
});
await supabase.from("quotes")
  .update({ subtotal, vat, total, payment_profile_snapshot: paymentProfileSnapshot })
  .eq("id", id);
```

**Prevention checklist:**
- Grep `payment_profile_snapshot`, `customer_tax_profile`, `snapshot_json` ฯลฯ — ทุก derived snapshot ใน DB
- ถ้า column ที่จะ update มันเป็น input ให้ snapshot อื่น — recompute ใน transaction เดียว
- เขียน test ที่ verify snapshot ตรงกับ recompute สดๆ หลัง mutation

**Reference fix:** commit `cded588` "Fix quote item payment routing guards"

---

## L15 — Refuse-action guard ต้องทำงาน **ก่อน** mutation ไม่ใช่หลัง

**Pattern:** Guard ที่ปฏิเสธ destructive action (delete last item, prevent over-spend, etc.) ต้องตรวจ + return 409 **ก่อน** เรียก mutation จริง ไม่ใช่ทำ mutation แล้วค่อย rollback — restore path มักจะหายข้อมูลและ buggy

**ผิดอย่างไร:**
- PR #66, `DELETE /api/admin/quotes/[id]/items/[itemId]`: รอบแรกทำ DELETE ก่อน → count rows → ถ้า 0 ก็ re-insert ด้วย `{ id, label, qty: 1, unit_price: 0 }`
- ปัญหา: restore data เก็บแค่ `id + label` ไม่เก็บ qty/unit_price ของจริง → กด delete รายการสุดท้าย → 409 ตอบ "refused" แต่ row จริงๆ ถูกแก้เป็น qty=1, unit_price=0 → ลูกค้าเห็น item เพี้ยน
- Codex P2 บน #66

**ทำอย่างไรให้ถูก:**
```ts
// ✗ ผิด — delete แล้วค่อย check + restore แบบสูญข้อมูล
await supabase.from("quote_items").delete().eq("id", itemId).select(...);
const { count } = await supabase.from("quote_items").select("id", { count: "exact", head: true });
if (count === 0) {
  await supabase.from("quote_items").insert({ id, label }); // ← lose qty/unit_price
  return 409;
}

// ✓ ถูก — count ก่อน, delete หลัง
const { data: existingItems } = await supabase.from("quote_items").select("id").eq("quote_id", id);
if (!existingItems.some(i => i.id === itemId)) return 404;
if (existingItems.length <= 1) return 409 LAST_ITEM_PROTECTED;
await supabase.from("quote_items").delete()...;
```

**Prevention checklist สำหรับ destructive endpoints:**
- ตรวจ pre-condition จาก state ที่ stable (read ก่อน mutate)
- ถ้าต้อง read+mutate atomically → ใช้ transaction (Postgres function หรือ rpc) — ไม่ใช่ rollback-via-restore
- restore-after-mutate มักจะลืม column → corrupt data

**Reference fix:** commit `cded588` "Fix quote item payment routing guards"

---

## L5 — `next-env.d.ts` ห้าม commit

**Pattern:** ไฟล์นี้ Next.js auto-generate แตกต่างระหว่าง `next dev` กับ `next build` (toggle `.next/types` ↔ `.next/dev/types`) — ไม่ใช่ source code

**ทำอย่างไรให้ถูก:**
- ถ้าเจอ `next-env.d.ts` เป็น modified ใน `git status` → `git checkout -- next-env.d.ts` ทิ้งทันที
- ไม่ stage ไฟล์นี้เข้า commit ไม่ว่ากรณีใด

---

## Reference Format สำหรับเพิ่ม entry ใหม่

```markdown
## L{N} — {ชื่อ pattern สั้นๆ}

**Pattern:** {ประโยคเดียวบอก rule}

**ผิดอย่างไร:**
- {PR/commit reference}: {อธิบายสิ่งที่ทำผิด}

**ทำอย่างไรให้ถูก:**
- {step หรือ code pattern ที่ถูก}

**Reference:** {link/path ของ fix หรือ review comment}
```
