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

## L16 — Append element ลง array column ต้องใช้ atomic operator ใน DB ห้าม read-then-write ใน JS

**Pattern:** ถ้า column เป็น array/jsonb และต้อง **append** จากหลาย client ที่ concurrent ได้ — ห้ามอ่าน array มาแล้วเขียนทับด้วย `[...old, new]` ใน app code เพราะ 2 request พร้อมกัน → ทั้งคู่อ่าน array เดียวกัน → ทั้งคู่ write back → **append ตัวหลังหายเสมอ**

**ผิดอย่างไร:**
- PR #67, `/api/install/[token]/proof`: รอบแรกใช้ pattern:
  ```ts
  const nextPaths = [...install.photo_proof_paths, uploadResult.storagePath];
  await supabase.from("installations").update({ photo_proof_paths: nextPaths })...
  ```
- L9 conditional update ที่ผมทำ (`.in("status", [...])`) ป้องกันแค่ **status transition** ไม่ได้ป้องกัน **array overwrite**
- 2 ทีมงาน upload พร้อมกัน → คนแรก append `['a','b','new1']`, คนสองอ่านเห็น `['a','b']` แล้ว append `['a','b','new2']` → **new1 หายไป**
- Codex P2 บน PR #67

**ทำอย่างไรให้ถูก:**
```sql
-- ✓ ถูก — atomic ภายใน Postgres
UPDATE installations SET
  photo_proof_paths = array_append(photo_proof_paths, $1),
  status = CASE WHEN $2 THEN 'done' ELSE status END,
  updated_at = NOW()
WHERE public_token = $3 AND status IN ('scheduled', 'in_progress')
RETURNING id, status, cardinality(photo_proof_paths);
```

ห่อเป็น RPC `SECURITY DEFINER` ที่ GRANT EXECUTE เฉพาะ service_role เพื่อให้ app เรียกผ่าน `supabase.rpc(...)`

**Prevention checklist เมื่อ mutate array/jsonb column:**
- ใช้ `array_append`, `array_remove`, `jsonb_set`, `jsonb_insert` ใน DB เสมอ
- ห้าม read-modify-write ใน JS ถ้ามีโอกาส concurrent
- เขียน test concurrent (Promise.all 2-3 calls) เพื่อ verify ไม่หาย element

**Reference fix:** migration `20260516101000_append_installation_proof_rpc.sql` + commit `d512fb2`

---

## L17 — Storage upload + DB write = ต้องมี cleanup เมื่อ DB ล้มเหลว

**Pattern:** ถ้า endpoint ทำ 2 ขั้น "upload file → write DB row อ้างถึง file" — ถ้า DB step ล้ม → **file ค้างอยู่ใน storage ไม่มี ref → orphan ที่ใช้พื้นที่/cost ฟรีๆ ตลอดไป**

**ผิดอย่างไร:**
- PR #67, `/api/install/[token]/proof`: ขั้น upload สำเร็จ → ขั้น update DB fail (เช่น status changed concurrent) → return 409 แต่ **file ยังอยู่ใน bucket** ไม่มี row อ้าง

**ทำอย่างไรให้ถูก:**
```ts
let uploadResult;
try {
  uploadResult = await uploadProofFile(installId, file);
} catch (err) { return 500; }

const { data: rpcData, error: dbError } = await supabase.rpc("append_proof", {...});
if (dbError) {
  await deleteProofFile(uploadResult.storagePath).catch(() => null); // cleanup
  return 500;
}
const updated = parseRpc(rpcData);
if (!updated) {
  await deleteProofFile(uploadResult.storagePath).catch(() => null); // cleanup
  return 409 STATE_CHANGED;
}
```

**Prevention checklist สำหรับ "upload then DB write" patterns:**
- รักษา reference ของ storage path ที่ upload แล้ว
- ทุก error branch หลัง upload → delete file (catch + ignore secondary error)
- ใช้ Promise.allSettled / try-finally ถ้า cleanup ต้องวิ่งคู่กับ error response
- พิจารณา deferred cleanup job (lifecycle policy) สำหรับ orphan files ที่อาจเล็ดลอด

**Reference fix:** `deleteInstallProofFile` ใน `src/lib/install-proof-storage.ts` + commit `d512fb2`

---

## L18 — Visibility predicate ที่อาศัยหลาย columns ต้องครอบทุกคอลัมน์ที่เกี่ยวข้อง

**Pattern:** UI ตัดสินใจแสดง/ซ่อน section จาก "มีข้อมูลใน data set นี้รึยัง" — ต้องเช็คทุกคอลัมน์ที่ผู้ใช้กรอกได้ ไม่ใช่แค่บางส่วน ไม่งั้น user ป้อนข้อมูลแค่ subset แล้ว UI ไม่แสดง → ข้อมูลค้างเงียบๆ ใน DB

**ผิดอย่างไร:**
- PR #68, `/status/[token]` หน้า customer: รอบแรกใช้:
  ```ts
  fulfillmentMode === "delivery" && (job.delivery_provider || job.delivery_tracking_url || job.delivery_tracking_number)
  ```
- ลืม `delivery_dispatched_at` กับ `delivery_notes` — ถ้า admin ป้อนแค่ "notes" หรือ "dispatchedAt" → ลูกค้าไม่เห็น section ทั้งๆ ที่ข้อมูลถูกบันทึก
- เจอเองหลังจาก self-review (ไม่ใช่ Codex)

**ทำอย่างไรให้ถูก:**
```ts
// ✓ ถูก — extract helper ที่ list ทุก column ของ feature
export function hasDeliveryTrackingDetails(job: DeliveryTrackingFields | null | undefined) {
  return Boolean(
    job?.delivery_provider ||
      job?.delivery_tracking_url ||
      job?.delivery_tracking_number ||
      job?.delivery_dispatched_at ||
      job?.delivery_notes
  );
}

// Usage
{fulfillmentMode === "delivery" && hasDeliveryTrackingDetails(job) ? (...) : null}
```

**Prevention checklist:**
- ถ้า feature เพิ่มหลาย column → helper "isFeatureXPresent" ที่อ่านทั้งหมด
- เขียน unit test ที่ flip ทีละ column → expect predicate ตอบ true
- ห้ามใช้ ad-hoc OR ใน JSX สำหรับ predicate ที่ใช้ซ้ำได้ — extract เป็น helper

**Reference fix:** commit `7fd6322` + `src/lib/delivery-tracking.ts` `hasDeliveryTrackingDetails`

---

## L19 — Multi-step writes ข้ามหลาย tables = ต้อง atomic transaction หรือ cleanup-on-fail

**Pattern:** ถ้า endpoint ต้อง insert/update หลายตารางตามลำดับ (conversation → lead → quote → items) — ห้ามใช้ chained inserts ทีละครั้งโดยไม่มี rollback mechanism เพราะ ถ้า step N ล้ม → step 1..N-1 commit ไปแล้ว → **orphan rows** ค้างใน DB ที่ user มองว่า "request failed" แต่จริงๆ มี partial data + retry จะ duplicate

**ผิดอย่างไร:**
- PR #69, `POST /api/admin/quotes/[id]/clone`: รอบแรก insert conversations → insert leads → insert quotes → insert quote_items
- ถ้า items insert ล้มเหลว → endpoint return 500 แต่ conversation/lead/quote ใหม่ยังอยู่ใน DB → ลูกค้าเห็น "WAITING_QUOTE_APPROVAL" ของเปล่าใน /admin
- Admin retry → สร้างซ้ำอีกชุด → ยิ่งสร้าง orphan
- Codex P2 บน PR #69

**ทำอย่างไรให้ถูก:**

```ts
// ✓ Option A — cleanup-on-fail (acceptable when each step is small)
const createdIds: { conversationId?: string; leadId?: string; quoteId?: string } = {};
try {
  const conv = await insertConversation(...);
  createdIds.conversationId = conv.id;
  const lead = await insertLead(conv.id);
  createdIds.leadId = lead.id;
  const quote = await insertQuote(lead.id);
  createdIds.quoteId = quote.id;
  await insertItems(quote.id);
  return success;
} catch (err) {
  // Reverse-order cleanup (children first to satisfy FK if not CASCADE)
  await supabase.from("quotes").delete().eq("id", createdIds.quoteId);
  await supabase.from("leads").delete().eq("id", createdIds.leadId);
  await supabase.from("conversations").delete().eq("id", createdIds.conversationId);
  return 500;
}

// ✓ Option B (preferred for stronger atomicity) — Postgres function
CREATE FUNCTION public.clone_quote(...) RETURNS TABLE(...) AS $$
BEGIN
  -- all inserts inside one transaction; on EXCEPTION rolls back automatically
  ...
END $$;
```

**Prevention checklist สำหรับ multi-step write:**
- ถ้ามี >1 insert ที่ depend on previous result → ต้องมี cleanup branch หรือใช้ RPC
- เขียน test ที่ inject failure ในแต่ละ step → expect DB clean
- พิจารณา idempotency key สำหรับ retry-safe (ลูกค้า client retry ไม่สร้างซ้ำ)

**Reference fix:** commit `4b7d1c1` + helper `cleanupFailedClone` / `failCloneAfterPartialWrite`

---

## L20 — Server-side action gate ต้องบังคับ business rule แม้ admin UI ซ่อนปุ่ม

**Pattern:** Admin UI hide ปุ่ม action ตาม business rule (e.g., เฉพาะ status='sent') ไม่พอ — admin endpoint ต้อง enforce rule เดียวกันใน server เพราะ:
1. Stale browser cache ของ client มี action ที่ UI ใหม่ซ่อนแล้ว
2. Admin ใช้ curl / Postman / DevTools console ยิงตรงๆ ได้
3. Bug ใน UI conditional อาจหลุดให้ปุ่มโผล่

L10 พูดถึง public-token endpoint ที่ stranger ยิงได้ — L20 ขยายมาที่ **admin** endpoint ที่ stale/malicious admin client ยิง action ที่ไม่ควรทำได้

**ผิดอย่างไร:**
- PR #69, `POST /api/admin/quotes/[id]/clone`: UI ซ่อนปุ่ม "ทำใบใหม่จากใบนี้" ถ้า `quoteStatus === "draft"` แต่ server **ไม่ได้ select quotes.status เลย** — admin ที่ POST ตรงๆ ก็ clone draft ได้ → ใบ unissued กลายเป็น sent quote ใหม่ใส่ลูกค้า
- Codex P2 บน PR #69 — แก้โดย:
  ```ts
  if (sourceQuote.status === "draft") {
    return NextResponse.json({ error: "QUOTE_CLONE_NOT_ALLOWED", ... }, { status: 409 });
  }
  ```

**Prevention checklist สำหรับ admin endpoints:**
- ทุก action ที่ UI conditional แสดง → server ต้อง enforce condition เดียวกัน
- Select fields ที่ใช้ enforce business rule (e.g., status, payment_status) แม้ไม่ใช้ใน response
- เขียน test: เรียก endpoint ใน edge state ที่ UI ซ่อน → expect 409/422
- ถือ admin client เป็น untrusted เช่นเดียวกับ public — เพราะ session อาจ stale หรือถูก replay

**Reference fix:** commit `4b7d1c1` (draft status guard)

---

## L21 — `npm run build` ไม่ครอบ lint — ต้องรัน `npm run lint` แยกก่อน push

**Pattern:** Next.js production build (`npm run build`) ไม่ fail บน eslint errors โดยตรง (ขึ้นกับ config) — แต่ CI workflow ของ repo นี้รัน `npm run lint` แยก. ทำให้ "build ผ่านที่เครื่อง" → push → "CI fail ที่ lint step" → ต้องเพิ่ม commit เพื่อแก้

**ผิดอย่างไร:**
- PR #71, `admin/commercial-entities/page.tsx`: ใช้ literal `"..."` ใน JSX text — `react/no-unescaped-entities` ตรวจเจอ 2 errors
- ผมรัน `npm run build` ผ่าน (Next ไม่ fail) → push → CI lint step fail → ต้องแก้ + force push หรือเพิ่ม fix commit

**ทำอย่างไรให้ถูก:**
- รัน **ทั้ง 3 commands** ก่อน push ทุกครั้ง:
  ```bash
  npx tsc --noEmit       # type check
  npm run lint           # eslint
  npm run build          # production build
  ```
- หรือใช้ `npm run check:release` ถ้ามี (รวมทั้งหมด + scenario tests)
- ใน JSX: หลีกเลี่ยง literal `"..."`, `'...'`, `>`, `<` ใน text content — ใช้ Thai quotes `"..."` `'...'` หรือ HTML entity (`&quot;` `&apos;` `&gt;` `&lt;`)

**Prevention checklist ก่อน push PR:**
- [ ] `npx tsc --noEmit` clean
- [ ] `npm run lint` 0 errors (warnings ที่ถูก document ไว้ใน repo ok)
- [ ] `npm run build` ผ่าน + route ใหม่อยู่ใน output

**Reference:** CI workflow `.github/workflows/build.yml` runs lint + build sequentially

---

## L5 — `next-env.d.ts` ห้าม commit

**Pattern:** ไฟล์นี้ Next.js auto-generate แตกต่างระหว่าง `next dev` กับ `next build` (toggle `.next/types` ↔ `.next/dev/types`) — ไม่ใช่ source code

**ทำอย่างไรให้ถูก:**
- ถ้าเจอ `next-env.d.ts` เป็น modified ใน `git status` → `git checkout -- next-env.d.ts` ทิ้งทันที
- ไม่ stage ไฟล์นี้เข้า commit ไม่ว่ากรณีใด

---

## L22 — เปลี่ยน `RETURNS TABLE` ของ function เดิม ต้อง DROP ก่อน CREATE OR REPLACE

**Pattern:** Postgres ไม่ยอมให้ `CREATE OR REPLACE FUNCTION` เปลี่ยน return row type / OUT columns — ต้อง `DROP FUNCTION IF EXISTS ...(arg_signature)` ก่อน

**ผิดอย่างไร:**
- PR #72 migration `20260516300000_auto_fulfillment_on_install_done.sql`: เพิ่มคอลัมน์ที่ 5 (`job_fulfillment_status text`) เข้า `RETURNS TABLE` ของ `append_installation_proof` ด้วย `CREATE OR REPLACE` เฉยๆ
- Production ผ่าน เพราะ Supabase MCP `apply_migration` จัดการให้ — แต่ **Supabase Preview Branch รัน migration ใหม่ทั้งหมดจากศูนย์** → fail ด้วย error `cannot change return type of existing function`

**ทำอย่างไรให้ถูก:**
- ก่อน `CREATE OR REPLACE FUNCTION` ที่เปลี่ยนคอลัมน์ใน `RETURNS TABLE` ให้เพิ่ม:
  ```sql
  DROP FUNCTION IF EXISTS public.fn_name(arg_type1, arg_type2, ...);
  ```
- ต้องระบุ argument signature ให้ครบ (Postgres distinguish function โดย name + arg types)
- ถ้า function เดิมมี GRANT → ต้อง re-grant หลัง CREATE ด้วย

**Reference:**
- PR #72 Codex P1: <https://github.com/akkpol/craft-run-app/pull/72#discussion_r3250979392>
- Fix commit: เพิ่ม `DROP FUNCTION IF EXISTS public.append_installation_proof(TEXT, TEXT, BOOLEAN, TIMESTAMPTZ);`

---

## L23 — Auto-transition จาก system ต้อง log ผ่าน system actor ไม่ใช่ `logHumanAction`

**Pattern:** ถ้า server-side code (RPC, trigger, scheduled job) auto-flip state — ห้าม log ด้วย `logHumanAction()` เพราะ `action_log.actor_type='human'` จะทำให้ audit / timeline / reporting classify ผิด

**ผิดอย่างไร:**
- PR #72 `src/app/api/install/[token]/proof/route.ts`: เมื่อ `mark_done=true` ทำให้ RPC auto-flip `jobs.fulfillment_status='delivered'` แล้วเขียน audit row ใหม่ผ่าน `logHumanAction` ที่ตั้ง `actorLabel: "System"` — แต่ `actor_type` ยังเป็น `human`
- Reporting ใดที่กรอง `actor_type='system'` เพื่อแยก automated mutation ออกจาก install-team/admin actions → จะนับ row นี้ผิด

**ทำอย่างไรให้ถูก:**
- มี/สร้าง `logSystemAction()` helper ที่ set `actor_type='system'`
- เก็บ `logHumanAction()` ไว้สำหรับ event ที่มี user agency ตรงๆ (install team กดถ่ายรูป, admin กดปุ่ม) เท่านั้น
- Cascading auto-transitions (ที่ trigger จาก human event แต่เป็น side-effect ของ RPC) = system action

**Reference:** PR #72 Codex P2: <https://github.com/akkpol/craft-run-app/pull/72#discussion_r3251330302>

---

## L24 — Validation rule ต้อง symmetric ระหว่าง POST (create) กับ PATCH (update)

**Pattern:** ถ้า PATCH route validate enum/business rule แล้ว return 400 → POST route ต้อง validate เหมือนกัน — ห้าม silently coerce ไป default

**ผิดอย่างไร:**
- PR #71 `src/app/api/admin/commercial-entities/route.ts` (POST): รับ `branchType` ที่ไม่รู้จัก → fall through เป็น `HEAD_OFFICE` แบบเงียบๆ
- PATCH route ของ entity เดียวกัน return 400 ถ้า `branchType` ผิด enum
- ผล: ถ้า UI/API caller พิมพ์ผิด → branch ถูกบันทึกเป็น HEAD_OFFICE ในข้อมูลภาษี ผิด business

**ทำอย่างไรให้ถูก:**
- Extract validator function (e.g., `validateBranchType`) ใช้ร่วมระหว่าง POST + PATCH
- หรือสร้าง zod/yup schema เดียวที่ใช้ทั้งสอง endpoint
- เวลาเพิ่ม enum value ใหม่ → update validator เดียวก็พอ

**Reference:** PR #71 Codex P2: branch type validation asymmetry

---

## L25 — Deactivation guard ต้องครอบทุก state ที่ยัง depend ของ in-flight orders

**Pattern:** ก่อนปิด receiver / entity / resource ที่ผูกกับ orders → ตรวจ in-flight state **ทั้งหมด** ไม่ใช่แค่ unpaid/partial

**ผิดอย่างไร:**
- PR #71 `src/app/api/admin/commercial-entities/[id]/route.ts` deactivation guard:
  - ตรวจแค่ `payment_status IN ('unpaid','partial')`
  - **พลาด case 1:** deposit ที่ partial แล้ว lock `payment_receiver_locked_at` → balance payment ขั้นต่อมาเรียก `confirm_commercial_payment` ซึ่ง re-check ว่า entity active → fail
  - **พลาด case 2:** order ที่ paid แล้วแต่ยังไม่ออก document → `buildCommercialDocumentIssuePlan` เรียก `validateReceiverEntityActive` → reject `RECEIVER_ENTITY_INACTIVE`

**ทำอย่างไรให้ถูก:**
- เขียน "in-flight" definition ให้ครอบทุก downstream gate ที่ check `is_active`:
  - quote.payment_status ใดๆ ก็ตามที่ยังต้องใช้ entity (unpaid / partial / paid-but-no-doc / locked-receiver)
  - หรือดีกว่า: ตรวจ `payment_receiver_locked_at IS NOT NULL AND completed_at IS NULL` (lifecycle ของ receiver)
- เพิ่ม unit test ครอบทุก case ที่ guard ต้องบล็อก deactivation

**Reference:**
- PR #71 Codex P1: balance payment after deactivation
- PR #71 Codex P2: paid receiver before document issuance

---

## L26 — VAT-registered receiver ต้องมี **address** ครบไม่ใช่แค่ tax_id

**Pattern:** ถ้า business จะใช้ snapshot field ลง print document → validate ครบทุก required field ของ snapshot ไม่ใช่แค่ identifier

**ผิดอย่างไร:**
- PR #71 commercial-entities POST: validate ว่า `vatRegistered=true` ต้องมี `taxId` ถูกแล้ว
- แต่ลืม `address` — tax_invoice/receipt print model render `ที่อยู่ / Address: -` ถ้าว่าง → ใบกำกับภาษีออกมาขาด required field ตามกฎหมาย

**ทำอย่างไรให้ถูก:**
- รวบรวม "VAT receiver required snapshot fields" เป็น list เดียว: `taxId`, `address`, `legalName`, …
- Validate ทั้งหมดใน create + update path
- พิจารณาเขียน DB CHECK constraint ด้วย ถ้า business rule ไม่ค่อยเปลี่ยน

**Reference:** PR #71 Codex P2: VAT entity require address

---

## L27 — SECURITY DEFINER RPC ใน public schema ต้อง REVOKE EXECUTE FROM PUBLIC

**Pattern:** Postgres function ที่สร้างใหม่ใน `public` schema ได้ `EXECUTE` privilege เป็น `PUBLIC` ตาม default — Supabase exposed ผ่าน PostgREST ให้ `anon` + `authenticated` role เลย เรียกได้จาก client โดยไม่ต้องผ่าน server

**ผิดอย่างไร:**
- PR #74 `record_pickup_proof` — สร้างเป็น `SECURITY DEFINER` ใน `public` ไม่ revoke → anon/auth client ที่รู้ job UUID เรียก RPC ตรง ๆ ได้ ทำ proof pollution ได้
- เคยทำถูกใน `append_installation_proof` (มี REVOKE + GRANT to service_role) — pickup ลืม mirror

**ทำอย่างไรให้ถูก:**
- หลัง `CREATE OR REPLACE FUNCTION` ทุก SECURITY DEFINER ใน `public` ใส่:
  ```sql
  REVOKE EXECUTE ON FUNCTION public.fn_name(arg1, arg2, ...)
    FROM public, anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.fn_name(arg1, arg2, ...)
    TO service_role;
  ```
- ระบุ argument signature เต็มในทั้ง REVOKE + GRANT (เป็น token เดียวกับใน DROP/COMMENT)
- `createAdminClient()` ใช้ `sb_secret_*` ซึ่ง impersonate `service_role` — เรียก RPC ได้แม้ถูก revoke จาก anon

**Reference:** PR #74 Codex P1 — fix PR #75

---

## L28 — Workflow gate ต้อง enforce ใน RPC ไม่ใช่แค่ใน UI

**Pattern:** Action ที่ขึ้นกับ job/conversation state — ต้องเช็ค state ใน RPC ก่อนเขียนข้อมูล ไม่ใช่หวังว่า admin UI จะ "ไม่เห็นปุ่ม"

**ผิดอย่างไร:**
- PR #74 `record_pickup_proof`: ให้ `p_mark_done=true` flip `fulfillment_status='picked_up'` จากทั้ง `not_ready` และ `ready`
- ผลคือ admin ปิด pickup ได้ตั้งแต่ตอน job ยังอยู่ใน design/production — `picked_up_at` ถูก set ทั้งที่งานยังไม่จบ
- ต่อมา production transition ปกติอาจ overwrite status กลับ → workflow inconsistent

**ทำอย่างไรให้ถูก:**
- หา prerequisite state ของ action นี้ (e.g. pickup ต้องการ `fulfillment_status='ready'` แสดงว่า production เสร็จแล้ว)
- เพิ่ม guard ใน RPC ที่ refuse กับ Postgres error code:
  ```sql
  IF p_mark_done AND v_prev_status = 'not_ready' THEN
    RAISE EXCEPTION 'JOB_NOT_READY_FOR_PICKUP' USING ERRCODE = 'P0005';
  END IF;
  ```
- Map error code → 409 ใน route handler
- UI side แค่ disable ปุ่ม (UX) แต่ source of truth อยู่ที่ RPC (L20)
- จำกฎ: state machine ที่อยู่ทั้ง UI + API + DB → DB ต้องเป็น last line of defense

**Reference:** PR #74 Codex P2 — fix PR #75

---

## L29 — Tax form code มาจาก **payee** ไม่ใช่ withholder

**Pattern:** ในระบบภาษีไทย แบบยื่นรายการ (ภ.ง.ด.3 vs ภ.ง.ด.53) ถูก derive จาก legal form ของ **ผู้รับเงิน (payee)** ไม่ใช่ผู้จ่าย:
- บุคคลธรรมดา (person payee) → ภ.ง.ด.3
- นิติบุคคล (company payee) → ภ.ง.ด.53

**ผิดอย่างไร:**
- PR #76 `wht-certificate-print.ts`: ตอนเลือก formType ใช้ `withholder.billing_entity_type` (= customer)
- เคส broken: company customer จ่ายให้ personal account receiver → render ภ.ง.ด.53 ทั้งที่ payee เป็นบุคคล (ต้อง ภ.ง.ด.3)
- กลับด้านก็พัง: individual customer จ่ายให้ company receiver → render ภ.ง.ด.3 ทั้งที่ payee เป็นนิติบุคคล

**ทำอย่างไรให้ถูก:**
- Form code มาจาก `receiver_entity.type` ('person' | 'company') บน commercial_entities
- คนที่อ่าน Thai tax law: payer/withholder filing form = follow payee's legal status เสมอ
- เวลาเขียน tax-form logic ต้อง verify ทั้ง 4 combinations (person→person, person→company, company→person, company→company)

**Reference:** PR #76 Codex P2 — fix in same PR

---

## L30 — Tax document ต้องใช้ **locked tax profile** ของ order ไม่ใช่ lead snapshot

**Pattern:** เมื่อ `commercial_orders.customer_tax_profile_id` ถูก set → snapshot นั้นคือ source of truth ของ customer identity (legal_name / tax_id / branch / address) — เอกสารภาษีต้องใช้ profile ที่ lock ไว้ ไม่ใช่ lead.billing_*

**ผิดอย่างไร:**
- PR #76 `/admin/payments/[id]/wht-cert/page.tsx`: load แค่ `lead.billing_*` แล้วใช้เป็น withholder identity
- ถ้า admin เปลี่ยน customer tax profile ก่อนยืนยัน payment (เช่น ลูกค้าบอกใหม่ว่าจะออกใบกำกับชื่อบริษัทแม่) — order.customer_tax_profile_id จะ point ไป profile อื่น
- เอกสาร tax_invoice_receipt ที่ออกแล้วใช้ profile ที่ locked
- แต่ 50 ทวิ ยังใช้ lead snapshot เก่า → ชื่อ/tax id ของ withholder ใน 2 เอกสารไม่ตรงกัน → ลูกค้ายื่นภาษีไม่ได้

**ทำอย่างไรให้ถูก:**
- เวลา fetch order ให้ select `customer_tax_profile_id` มาด้วย
- ถ้า not null → fetch `customer_tax_profiles` row และใช้ field ของมันเป็น primary
- ถ้า null → fall back ไป lead.billing_* (lead snapshot)
- กฎทั่วไป: เอกสารใด ๆ ที่ link กับ `commercial_orders` ต้อง consult `customer_tax_profile_id` ก่อนใช้ lead.billing_*

**Reference:** PR #76 Codex P2 — fix in this PR

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
