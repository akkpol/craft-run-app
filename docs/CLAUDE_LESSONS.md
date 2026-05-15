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

## L9 — Race-safe status transition: ใส่ predicate ใน UPDATE ไม่ใช่แค่ pre-read

**Pattern:** เวลา transition status (`pending → matched/rejected/approved/done`) ห้าม pattern `select → check → update by id` เพราะ tab A กับ tab B ที่ read พร้อมกัน ทั้งคู่จะเห็น `status='pending'` → update ทั้งคู่สำเร็จ → **state ขัดแย้งกัน** (เช่น row หลุดเป็น matched แต่ rejected_at ก็ถูก set ไปแล้ว)

**ผิดอย่างไร:**
- PR #62, `payment-slips/[id]/match/route.ts` + `reject/route.ts` (รอบแรก):
  ```ts
  // ✗ ผิด — race window
  const { data: slip } = await supabase.from("payment_slips").select(...).eq("id", id);
  if (slip.status !== "pending") return 409;
  await supabase.from("payment_slips").update({ status: "matched", ... }).eq("id", id);
  ```
- Codex P2 บอกว่า 2 tab admin คลิก match + reject พร้อมกัน → ทั้งคู่ pass check + update → record มี matched_at AND rejected_at พร้อมกัน

**ทำอย่างไรให้ถูก:**
```ts
// ✓ ถูก — atomic conditional update
const { data: updated } = await supabase
  .from("payment_slips")
  .update({ status: "matched", matched_at: now, ... })
  .eq("id", id)
  .eq("status", "pending")          // race guard
  .select("id")
  .maybeSingle();
if (!updated) return NextResponse.json({ error: "Slip is no longer pending" }, { status: 409 });
```

**Prevention checklist สำหรับ status transition:**
- Atomic conditional update ที่ filter ด้วย expected current status
- ตอบ 409 conflict ถ้า 0 rows updated
- คิดถึง 2-tab / 2-admin race เสมอใน admin queue UI
- ใช้ Postgres row lock (`for update`) ถ้า logic ซับซ้อนกว่า single update

**Reference fix:** commit `9ed6d6b` "Harden payment slip review gates"

---

## L10 — UI hide ≠ server gate (ป้องกัน abuse ผ่าน saved/shared token)

**Pattern:** Public endpoint ที่ใช้ token-based auth ห้ามเชื่อใจว่า "UI hide ปุ่ม → no one will call" — endpoint ต้อง enforce business state เอง

**ผิดอย่างไร:**
- PR #62, `POST /api/quotes/[token]/slip` (รอบแรก): public endpoint รับสลิป โดย verify แค่ว่า token valid → quote exists → upload + insert ทันที
- UI hide uploader ถ้า quote ไม่ใช่ `waitingPayment` แต่ **server ไม่ได้เช็ค**
- ลูกค้า save token URL ไว้ → ใช้ POST sliding หลังจาก quote completed/rejected/credit/paid → admin queue บวมไปด้วย slip noise

**ทำอย่างไรให้ถูก:**
```ts
// ✗ ผิด — trust UI
const { data: quote } = await supabase.from("quotes")
  .select("id, public_token")
  .eq("public_token", token);
// ...accept upload

// ✓ ถูก — server-side enforcement
const { data: quote } = await supabase.from("quotes")
  .select("id, status, payment_terms, payment_status, jobs(id)")
  .eq("public_token", token);
const hasJob = (quote.jobs ?? []).length > 0;
const waitingPayment =
  quote.status === "approved" &&
  !hasJob &&
  !paymentUnlocksProduction(quote.payment_terms, quote.payment_status);
if (!waitingPayment || quote.payment_terms === "credit") {
  return NextResponse.json({ error: "QUOTE_NOT_WAITING_PAYMENT" }, { status: 409 });
}
```

**Prevention checklist สำหรับ public token endpoints:**
- ทุก state-mutating endpoint ต้อง re-verify business state จาก DB
- ใช้ shared predicate helper (`waitingPayment`, `productionReady`) แทนการ inline check
- คิด attack model: "ถ้าคน save link แล้วเปิดทีหลัง ระบบยอมรับมั้ย?"

**Reference fix:** commit `9ed6d6b` "Harden payment slip review gates"

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
