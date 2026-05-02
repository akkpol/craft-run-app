---
title: Operator Evidence Capture Checklist
version: 1.0
date: 2026-04-30
owner: Delivery Engineering
status: Active
source_refs:
  - docs/OPERATOR_LAUNCH_ONE_PAGE.md
  - docs/GO_NOGO_REVIEW.md
  - docs/PHASE2_OPERATOR_GATE_CHECKLIST.md
  - docs/LIFF_LIVE_VALIDATION_RUNBOOK.md
---

# Operator Evidence Capture Checklist

เอกสารนี้ใช้บอก operator ว่าต้องแคปหน้าจอหรือเก็บ log จากตรงไหนบ้างสำหรับแต่ละ gate เพื่อให้ evidence กลับมาใช้ปิด [GO_NOGO_REVIEW.md](GO_NOGO_REVIEW.md) ได้เลย

ถ้าต้องการเอกสารสั้นสำหรับส่งงานก่อน ให้เริ่มจาก [OPERATOR_LAUNCH_ONE_PAGE.md](OPERATOR_LAUNCH_ONE_PAGE.md) แล้วค่อยกลับมาหน้านี้ตอนต้องรู้ exact capture point

ถ้า operator ส่งผลกลับมาเป็นข้อความ ให้ใช้ format เดียวกับที่อยู่ใน [OPERATOR_LAUNCH_ONE_PAGE.md](OPERATOR_LAUNCH_ONE_PAGE.md) เพื่อให้วางกลับเข้า go/no-go ได้ทันที

*** Add File: d:\craft-run\craft-run\craft-run-backup-20260415\docs\OPERATOR_LAUNCH_ONE_PAGE.md
---
title: Operator Launch One Page
version: 1.0
date: 2026-04-30
owner: Delivery Engineering
status: Active
source_refs:
  - docs/GO_NOGO_REVIEW.md
  - docs/PHASE2_OPERATOR_GATE_CHECKLIST.md
  - docs/LIFF_LIVE_VALIDATION_RUNBOOK.md
  - docs/OPERATOR_EVIDENCE_CAPTURE_CHECKLIST.md
---

# Operator Launch One Page

ใช้เอกสารนี้เป็นจุดเริ่มต้นเดียวสำหรับรอบ operator/live verification ถ้าข้อไหน fail หรืออยากได้รายละเอียดเพิ่ม ค่อยเปิดเอกสารอ้างอิงด้านล่าง

## Stop Rules

- ถ้า `P2-G03` ไม่ผ่าน ให้หยุดทันที
- ถ้า `P2-G05` หรือ `P2-G06` ไม่ผ่าน ห้ามเริ่ม live LIFF run
- ถ้า gate ใดใน `P3-G01` ถึง `P3-G05` ไม่ผ่าน ให้ถือว่ายัง launch-blocked และหยุดก่อน

## Fixed Values

- Production alias: `https://craft-run.vercel.app`
- Webhook URL: `https://craft-run.vercel.app/api/webhook`
- LIFF endpoint: `https://craft-run.vercel.app/liff`
- Logged-out admin test URL: `https://craft-run.vercel.app/admin`
- ถ้า LIFF พังก่อน submit ให้เช็ก `/admin/liff-monitor` ก่อน

## Minimum Evidence For Every Item

- เวลาไทย
- คนที่ตรวจหรือ role ที่ตรวจ
- ผล `PASS` หรือ `FAIL`
- screenshot หรือ log excerpt
- URL, token, lead ID, deployment ID, หรือ masked identifier ที่เกี่ยวข้อง
- exact error ถ้า fail

## Run Order

### Phase 2 — Must All Pass First

1. `P2-G03` Vercel deploy ready
Where: Vercel dashboard > `craft-run` > `Deployments`
Pass when: latest production deployment เป็น `Ready` และ alias เป็น `https://craft-run.vercel.app`
Send back: deployment ID + screenshot ที่เห็น `Ready`

2. `P2-G05` Messaging API webhook verify
Where: LINE Developers Console > `Messaging API` > webhook settings
Pass when: webhook URL เป็น `https://craft-run.vercel.app/api/webhook` และ `Verify` สำเร็จ
Send back: final webhook URL + verify screenshot

3. `P2-G06` LIFF endpoint verify
Where: LINE Developers Console > `LINE MINI App / LIFF`
Pass when: endpoint เป็น `https://craft-run.vercel.app/liff` และ LIFF ID ตรงกับค่าที่ deploy ใช้งานจริง
Send back: endpoint screenshot + masked LIFF ID

4. `P2-G07` admin user and allowlist
Where: Supabase dashboard > `Authentication > Users` และ operator note เรื่อง allowlist/redeploy
Pass when: มี admin user จริง และ email เดียวกันอยู่ใน production allowlist
Send back: user screenshot แบบ masked + note ว่ามี redeploy หลังแก้ allowlist หรือไม่

### Phase 3 — Start Only After Phase 2 Passes

5. `P3-G01` logged-out admin redirect
Pass when: เปิด `/admin` แล้ว redirect ไป `/auth/login?next=%2Fadmin`
Send back: screenshot ที่เห็น final URL

6. `P3-G02` allowlisted staff login success
Pass when: login แล้วเข้าถึง `/admin` ได้
Send back: admin landing screenshot + masked account

7. `P3-G03` non-allowlisted login denied
Pass when: account ที่ไม่อยู่ allowlist ถูกปฏิเสธหรือเข้า admin ไม่ได้
Send back: denial screenshot + masked account

8. `P3-G04` LINE message creates conversation
Pass when: ส่งข้อความปกติใน LINE แล้วมี conversation row ใหม่เกิดขึ้น
Send back: LINE chat screenshot + admin/DB evidence

9. `P3-G05` LIFF intake creates customer, lead, and quote
Pass when: submit LIFF สำเร็จและมี record ที่เชื่อมกันครบ
Send back: LIFF submit screenshot + lead ID หรือ quote token + admin/DB evidence

### Focused LIFF Depth Checks After `P3-G05`

- `LIFF-VAL-006` Returning-customer prefill
Pass when: phone, document/billing defaults และ width/height/qty ที่ควร reuse กลับมาอย่างถูกต้อง
Send back: screenshot + PASS/FAIL + exact mismatch ถ้ามี

- `LIFF-VAL-007` Company tax-document validation
Pass when: branch code ว่างแล้ว fail ด้วยข้อความไทย และเมื่อกรอก branch code แล้ว submit ผ่าน
Send back: fail-path screenshot + pass-path screenshot + exact error text

- `LIFF-VAL-008` Runtime catalog path
Pass when: product picker โหลด runtime catalog ได้ และหน้า quote/status/download แสดง product label ที่อ่านได้ ไม่ใช่ slug ดิบ
Send back: picker screenshot + quote/status/download evidence + exact mismatch ถ้ามี

## Reply Back Using This Exact Shape

ส่งกลับมาทีละ block แบบนี้ แล้ว Delivery จะเอาไปวางต่อใน `docs/GO_NOGO_REVIEW.md`:

```md
Item:
Maps to gate:
Result: PASS | FAIL
Verified by / Date:
Evidence:
-
Notes:
-
```

Suggested `Item` values:

- `P2-G03`
- `P2-G05`
- `P2-G06`
- `P2-G07`
- `P3-G01`
- `P3-G02`
- `P3-G03`
- `P3-G04`
- `P3-G05`
- `LIFF-VAL-006`
- `LIFF-VAL-007`
- `LIFF-VAL-008`

## Deep Docs Only If Needed

- [GO_NOGO_REVIEW.md](GO_NOGO_REVIEW.md)
- [PHASE2_OPERATOR_GATE_CHECKLIST.md](PHASE2_OPERATOR_GATE_CHECKLIST.md)
- [LIFF_LIVE_VALIDATION_RUNBOOK.md](LIFF_LIVE_VALIDATION_RUNBOOK.md)
- [OPERATOR_EVIDENCE_CAPTURE_CHECKLIST.md](OPERATOR_EVIDENCE_CAPTURE_CHECKLIST.md)

## Capture Rules

ทุก evidence ควรเห็นอย่างน้อย:

- gate ID หรือ check ID ที่กำลังทดสอบ
- เวลาไทย หรือเวลาในระบบที่อ้างอิงได้
- URL, screen title, หรือชื่อระบบที่กำลังเปิดอยู่
- PASS/FAIL หรือข้อความผลลัพธ์ที่เห็นชัด

ห้ามให้ภาพหรือ log เปิดเผยค่าเต็มของ secret หรือ token

## Suggested File Names

ตั้งชื่อไฟล์แบบนี้เพื่อผูกกับ gate ง่าย:

- `P2-G03-vercel-ready-YYYYMMDD-HHMM.png`
- `P2-G05-line-webhook-verify-YYYYMMDD-HHMM.png`
- `P2-G06-liff-endpoint-YYYYMMDD-HHMM.png`
- `P2-G07-supabase-admin-user-YYYYMMDD-HHMM.png`
- `P3-G04-line-chat-and-conversation-YYYYMMDD-HHMM.png`
- `LIFF-VAL-005-submit-success-YYYYMMDD-HHMM.png`

## Phase 2 Capture Matrix

### P2-G03 — Vercel Deploy Ready

Capture from:

- Vercel dashboard > project `craft-run` > `Deployments`
- deployment detail pageของ production deployment ล่าสุด

Must be visible:

- deployment status = `Ready`
- deployment ID
- production alias `https://craft-run.vercel.app`

Good backup evidence:

- deployment log excerpt ที่มี final success state

### P2-G05 — LINE Messaging API Verify

Capture from:

- LINE Developers Console > Messaging API channel > webhook settings

Must be visible:

- webhook URL = `https://craft-run.vercel.app/api/webhook`
- verify success message

Good backup evidence:

- screenshot ก่อนกด verify ถ้า suspect ว่าชี้ผิด URL

### P2-G06 — LIFF Endpoint Verify

Capture from:

- LINE Developers Console > LIFF / LINE MINI App settings

Must be visible:

- endpoint URL = `https://craft-run.vercel.app/liff`
- masked LIFF ID

Good backup evidence:

- note ว่า `LIFF_ID` และ `NEXT_PUBLIC_LIFF_ID` ถูกยืนยันว่าตรงกัน

### P2-G07 — Admin User And Allowlist

Capture from:

- Supabase dashboard > Authentication > Users
- optional: Vercel env settings note หรือ operator note ว่า allowlist ถูกอัปเดตแล้ว

Must be visible:

- admin user record
- masked email

Good backup evidence:

- note ว่ามีการ redeploy หลังแก้ allowlist หรือไม่

## Phase 3 Capture Matrix

### P3-G01 — Logged-Out Admin Redirect

Capture from:

- browser window ที่เปิด `/admin` โดยยังไม่ login

Must be visible:

- URL ที่ redirect ไป `/auth/login?next=%2Fadmin`

### P3-G02 — Allowlisted Staff Login Success

Capture from:

- browser หลัง login สำเร็จ

Must be visible:

- `/admin` page
- masked account identifier ใน note หรือ screenshot ถ้าปลอดภัย

### P3-G03 — Non-Allowlisted Login Denied

Capture from:

- browser ตอน account ที่ไม่อยู่ allowlist ถูกปฏิเสธ

Must be visible:

- denial state หรือ blocked admin surface
- masked account identifier

### P3-G04 — LINE Message To Conversation

Capture from:

- LINE chat ที่ส่งข้อความจริง
- admin surface หรือ DB evidence ที่เห็น conversation ใหม่

Must be visible:

- ข้อความที่ส่งใน LINE
- conversation evidence ที่ผูกกับรอบทดสอบนั้น

Good backup evidence:

- Vercel function log ของ webhook route

### P3-G05 / LIFF-VAL-005 — LIFF Intake Success

Capture from:

- LIFF submit confirmation screen
- admin page, DB evidence, หรือ quote page ที่แสดง lead/quote ที่เพิ่งสร้าง

Must be visible:

- submit สำเร็จ
- lead ID หรือ quote token ถ้ามี

Good backup evidence:

- `/admin/liff-monitor` ถ้ามี incident ก่อนหรือหลัง submit

### P3-G06 — Quote Approval To WAITING_PAYMENT

Capture from:

- public quote approval page
- resulting state evidence ใน admin หรือ status page

Must be visible:

- action ที่กด approve
- resulting state = `WAITING_PAYMENT`

### P3-G07 — Quote Rejection To REQUIREMENTS_REVIEW

Capture from:

- public quote rejection step
- resulting state evidence ใน admin หรือ DB

Must be visible:

- rejection action
- resulting state = `REQUIREMENTS_REVIEW`

### P3-G08 — Quote PDF Download

Capture from:

- public quote download page หรือ downloaded PDF artifact

Must be visible:

- branding/header ของเอกสาร
- token หรือ document context ที่ยืนยันว่าเป็นรอบทดสอบนี้

### P3-G09 — Admin Commercial Unlock

Capture from:

- admin commercial/payment action
- resulting workflow state evidence

Must be visible:

- action ที่ใช้ unlock
- resulting state = `IN_DESIGN`

### P3-G10 — Job Progression

Capture from:

- admin job actions per state change
- customer status page หลัง major change

Must be visible:

- state ก่อนและหลัง
- customer-facing status ที่สอดคล้องกัน

### P3-G11 — Escalation Keyword

Capture from:

- LINE chat ที่ส่งคำว่า `admin` หรือ `คุยกับแอดมิน`
- resulting state evidence

Must be visible:

- keyword ที่ส่ง
- resulting state = `HUMAN_REVIEW_REQUIRED`

### P3-G12 — Settings Save To Action Log

Capture from:

- `/admin/settings` ตอน save สำเร็จ
- `action_log` evidence

Must be visible:

- save success
- `settings.updated` row

### P3-G13 — action_ref Presence

Capture from:

- sampled `action_log` rows จาก gates ที่เพิ่งรัน

Must be visible:

- `action_ref` ไม่ว่าง
- row ที่อ้างอิงถึง gate ที่เกี่ยวข้อง

## Failure Backup Order

ถ้าภาพจากหน้าใช้งานไม่พอ ให้เก็บ backup ตามลำดับนี้:

1. Browser screenshot
2. Vercel function log excerpt
3. `/admin/liff-monitor`
4. `action_log` row evidence
5. DB screenshot/query evidence แบบ masked