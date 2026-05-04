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
  - docs/COMMERCIAL_DOCUMENT_POLICY_V1.md
---

# Operator Launch One Page

ใช้เอกสารนี้เป็นจุดเริ่มต้นเดียวสำหรับรอบ operator/live verification ถ้าข้อไหน fail หรืออยากได้รายละเอียดเพิ่ม ค่อยเปิดเอกสารอ้างอิงด้านล่าง

## Stop Rules

- ถ้า `P2-G03` ไม่ผ่าน ให้หยุดทันที
- ถ้า `P2-G05` หรือ `P2-G06` ไม่ผ่าน ห้ามเริ่ม live LIFF run
- ถ้า gate ใดใน `P3-G01` ถึง `P3-G05` ไม่ผ่าน ให้ถือว่ายัง launch-blocked และหยุดก่อน
- ถ้า launch นี้ต้องมีใบวางบิล, ใบแจ้งหนี้, ใบเสร็จ, tax-ready, หรือใบกำกับภาษีที่ออกจากระบบจริง ให้หยุดและเปิด [COMMERCIAL_DOCUMENT_POLICY_V1.md](COMMERCIAL_DOCUMENT_POLICY_V1.md) ก่อน sign-off เพราะตอนนี้ quote PDF และ payment unlock ยังไม่ใช่ commercial document issuance

## Fixed Values

- Production alias: `https://craft-run.vercel.app`
- Webhook URL: `https://craft-run.vercel.app/api/webhook`
- LIFF endpoint: `https://craft-run.vercel.app/liff`
- Logged-out admin test URL: `https://craft-run.vercel.app/admin`
- Commercial document policy: [COMMERCIAL_DOCUMENT_POLICY_V1.md](COMMERCIAL_DOCUMENT_POLICY_V1.md)
- Commercial document packet: [../plan/feature-commercial-documents-1.md](../plan/feature-commercial-documents-1.md)
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

### Commercial Document Handoff Before Sign-Off

- Quote PDF ที่ผ่านใน `P3-G08` คือ quotation เท่านั้น ไม่ใช่ invoice, receipt, หรือ tax invoice
- Payment unlock ที่ผ่านใน `P3-G09` คือ workflow/payment gate เท่านั้น ไม่ใช่การออกเอกสารรับเงิน
- `LIFF-VAL-007` ตรวจ branch-code validation ตอน intake เท่านั้น ไม่ใช่ proof ว่าออกใบกำกับภาษีได้แล้ว
- ถ้า business owner ยอมให้ launch ก่อน ให้ส่งผลกลับว่า `COMMERCIAL-POLICY-HANDOFF = Deferred after launch`
- ถ้า business owner ต้องการเอกสารเหล่านี้ก่อนเปิดจริง ให้ส่งผลกลับว่า `COMMERCIAL-POLICY-HANDOFF = Required before GO`

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
- `COMMERCIAL-POLICY-HANDOFF`

## Deep Docs Only If Needed

- [GO_NOGO_REVIEW.md](GO_NOGO_REVIEW.md)
- [PHASE2_OPERATOR_GATE_CHECKLIST.md](PHASE2_OPERATOR_GATE_CHECKLIST.md)
- [LIFF_LIVE_VALIDATION_RUNBOOK.md](LIFF_LIVE_VALIDATION_RUNBOOK.md)
- [OPERATOR_EVIDENCE_CAPTURE_CHECKLIST.md](OPERATOR_EVIDENCE_CAPTURE_CHECKLIST.md)
- [COMMERCIAL_DOCUMENT_POLICY_V1.md](COMMERCIAL_DOCUMENT_POLICY_V1.md)