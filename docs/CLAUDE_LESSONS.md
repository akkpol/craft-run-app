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
