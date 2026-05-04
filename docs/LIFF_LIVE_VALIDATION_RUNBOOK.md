---
title: LIFF Live Validation Runbook
version: 1.0
date: 2026-04-30
owner: Delivery Engineering
status: Active
source_refs:
  - docs/OPERATOR_LAUNCH_ONE_PAGE.md
  - plan/process-go-live-waves-1.md
  - docs/GO_NOGO_REVIEW.md
  - docs/ENV_AND_LINE_SETUP.md
  - docs/COMMERCIAL_DOCUMENT_POLICY_V1.md
  - https://developers.line.biz/en/docs/liff/overview/#support-tool
---

# LIFF Live Validation Runbook

เอกสารนี้ใช้ปิด live LIFF checks ต่อไปนี้:

ถ้าต้องส่งให้ operator แบบลิงก์เดียวก่อน ให้เริ่มจาก [OPERATOR_LAUNCH_ONE_PAGE.md](OPERATOR_LAUNCH_ONE_PAGE.md) แล้วค่อยย้อนกลับมาหน้านี้เมื่อ Phase 2 ผ่านและต้องการรายละเอียด runbook เพิ่ม

- `LIFF-VAL-005` First-time customer path
- `LIFF-VAL-006` Returning-customer prefill path
- `LIFF-VAL-007` Company tax-document validation
- `LIFF-VAL-008` Runtime catalog path

## Hard Preconditions

อย่าเริ่ม runbook นี้จนกว่าจะจริงครบ:

1. `P2-G03` ผ่าน
2. `P2-G05` ผ่าน
3. `P2-G06` ผ่าน
4. `P2-G07` ผ่าน

ถ้ายังไม่ผ่าน ให้ย้อนกลับไปใช้ [PHASE2_OPERATOR_GATE_CHECKLIST.md](PHASE2_OPERATOR_GATE_CHECKLIST.md)

## Shared Capture Rule

ทุก scenario ให้เก็บ:

- เวลาเริ่มและเวลาจบ
- LINE account ที่ใช้ทดสอบแบบ masked
- quote token หรือ lead ID ถ้ามี
- screenshot จุดสำคัญ
- ผล PASS หรือ FAIL
- exact error ถ้ามี

ถ้า LIFF พังก่อนถึง `/api/intake` ให้เปิด `/admin/liff-monitor` ก่อนดูอย่างอื่น

ถ้าไม่แน่ใจว่าต้องเก็บ screenshot หรือ log จากหน้าไหน ให้ใช้ [OPERATOR_EVIDENCE_CAPTURE_CHECKLIST.md](OPERATOR_EVIDENCE_CAPTURE_CHECKLIST.md)

## LINE Support Tools For Debugging

ส่วนนี้ไม่ใช่ gate เพิ่ม แต่ใช้เมื่อ browser ปกติ reproduce ไม่ได้ หรือปัญหาเกิดเฉพาะ LINE WebView/LIFF browser:

- ใช้ `LIFF CLI` เพื่อเปิด local development server แบบ HTTPS และต่อกับ `LIFF Inspector` ตอนต้อง debug หน้า `/liff/intake` ภายใน LINE browser จริง
- ใช้ `LIFF Inspector` เก็บ console/runtime error จากเครื่องทดสอบแทนการพึ่ง Chrome desktop อย่างเดียว เพราะ LIFF browser บน iOS ใช้ `WKWebView` และ Android ใช้ `Android WebView`
- ใช้ `LIFF Playground` เพื่อเทียบพฤติกรรม API/permission แบบเร็ว แต่ไม่ถือว่าเป็น proof ของ FOGUS production flow
- ถ้าเจอปัญหา cache ให้จำไว้ว่าฝั่ง LIFF browser ไม่มีวิธีล้าง cache โดยตรง ต้องแก้ด้วย deploy/version/header strategy และทดสอบจาก LIFF URL ใหม่
- ถ้าเปิด LIFF จาก recently used services อาจเป็น resume หรือ reload ได้ ดังนั้นทุก request ที่ต้องใช้ identity ต้อง verify `liffIdToken` หรือ `liffAccessToken` ฝั่ง server ทุกครั้ง ห้ามเชื่อค่าจาก client profile snapshot


## Scenario 1 — LIFF-VAL-005 First-Time Customer Path

เป้าหมาย:

- ลูกค้าใหม่เข้า LINE -> LIFF -> submit intake แล้วระบบสร้าง `customer`, `lead`, `quote` ได้ครบ

ข้อมูลที่ควรใช้:

- เลือกสินค้าที่รู้ label ชัด
- ใส่ขนาด, จำนวน, due date, phone
- ใส่ `designBrief` สั้น ๆ
- แนบไฟล์ reference ได้ถ้าต้องการ

ขั้นตอน:

1. จาก LINE OA จริง เปิดลิงก์ LIFF
2. ยืนยันว่าเปิดที่ `/liff` แล้วเข้า form ได้
3. กรอกฟอร์มแบบลูกค้าใหม่ให้ครบ
4. submit form
5. รอผลลัพธ์หน้า LIFF ว่าสำเร็จ
6. เปิดหลังบ้านหรือ DB เพื่อตรวจ record ที่ถูกสร้าง

ต้องตรวจผล:

- มี `customers` row ใหม่
- มี `leads` row ใหม่
- มี `quotes` row ใหม่
- lead มี snapshot fields สำคัญ เช่น
  - `product_label_snapshot`
  - `product_category_snapshot`
  - `requested_document_type`
  - `billing_entity_type`
  - `liff_profile_snapshot`
  - `liff_context_snapshot`

PASS เมื่อ:

- form submit สำเร็จ
- สร้าง `customer`, `lead`, `quote` ครบ
- snapshot fields สำคัญไม่ว่างในเคสที่ควรมี

FAIL เมื่อ:

- submit ไม่สำเร็จ
- record ขาดบางตาราง
- LIFF incident โผล่ใน monitor

## Scenario 2 — LIFF-VAL-006 Returning-Customer Prefill Path

เป้าหมาย:

- ลูกค้าเดิมกลับเข้า LIFF แล้วค่า prefill สำคัญถูกเติมให้

ขั้นตอน:

1. ใช้ LINE account เดิมที่เคยมี lead แล้ว
2. เปิด LIFF ใหม่จาก LINE
3. รอหน้า form โหลด prefill
4. ตรวจว่าค่าที่เคยเก็บไว้ถูกเติมกลับมา

ต้องตรวจผลอย่างน้อย:

- `phone`
- `requestedDocumentType`
- billing defaults ที่เกี่ยวข้อง
- ถ้ามีข้อมูลเดิม ควรเห็น `width`, `height`, `qty` ถูก reuse ด้วย

PASS เมื่อ:

- ค่าหลักด้านบนถูก prefill โดยไม่ต้องกรอกใหม่

FAIL เมื่อ:

- เปิด LIFF แล้ว prefill หาย
- มี incident ที่ `/admin/liff-monitor`
- ได้ค่าเดิมผิดคนหรือผิด profile

## Scenario 3 — LIFF-VAL-007 Company Tax-Document Validation

เป้าหมาย:

- Thai validation สำหรับกรณีบริษัท + tax invoice + branch code ทำงานถูกต้องทั้ง fail และ pass path

Policy boundary:

- Scenario นี้ตรวจแค่ intake validation ว่าข้อมูล tax-document เบื้องต้นไม่หลุดเข้า lead ผิดเงื่อนไข
- Scenario นี้ยังไม่ใช่ proof ว่าระบบออกใบกำกับภาษีได้จริง
- ก่อนออก billing note, invoice, receipt, tax-ready, หรือ tax invoice ต้องใช้ [COMMERCIAL_DOCUMENT_POLICY_V1.md](COMMERCIAL_DOCUMENT_POLICY_V1.md) และ implementation packet [../plan/feature-commercial-documents-1.md](../plan/feature-commercial-documents-1.md)

ขั้นตอน fail path:

1. เปิด LIFF
2. เลือก company / tax invoice / branch
3. เว้น `billingBranchCode` ว่าง
4. submit form

ต้องเห็น:

- ข้อความ validation ภาษาไทยว่าต้องกรอก branch code
- ระบบไม่ควรสร้าง intake สำเร็จ

ขั้นตอน pass path:

1. ใช้ข้อมูลเดิม
2. เติม `billingBranchCode`
3. submit อีกครั้ง

ต้องเห็น:

- submit สำเร็จ
- lead ถูกสร้างตามปกติ

PASS เมื่อ:

- fail path แสดง error ไทยถูกต้อง
- pass path submit ผ่านด้วยข้อมูลเดียวกันเมื่อเติม branch code
- evidence ระบุชัดว่า tax invoice issuance ยังเป็น policy-guarded implementation ไม่ใช่สิ่งที่ scenario นี้ปิดแล้ว

## Scenario 4 — LIFF-VAL-008 Runtime Catalog Path

เป้าหมาย:

- product picker โหลด runtime catalog จริง
- quote/status/download แสดง imported product label ไม่ใช่ slug ดิบ

ขั้นตอน:

1. เปิด LIFF แล้วดู product picker
2. เลือกสินค้าที่มาจาก runtime catalog
3. submit form ให้สร้าง quote
4. เปิดหน้า quote
5. เปิดหน้า status
6. เปิดหน้า download quote

ต้องตรวจผล:

- picker โหลดรายการได้จริงจาก runtime path
- label ที่แสดงในทั้ง 3 หน้าเป็นชื่อสินค้าแบบอ่านได้
- ไม่ fallback เป็น slug เช่น `vinyl_banner` ถ้ามี imported label อยู่แล้ว

PASS เมื่อ:

- picker โหลดรายการได้
- 3 หน้าแสดง imported product label ตรงกัน

FAIL เมื่อ:

- picker โหลดไม่ได้
- หน้าใดหน้าหนึ่งกลับไปแสดง slug fallback

## Failure Triage Order

ถ้า live run ล้ม ให้ไล่ตามลำดับนี้:

1. `/admin/liff-monitor`
2. Vercel function logs ของ route ที่เกี่ยวข้อง
3. `action_log` สำหรับ `liff.*`
4. DB rows ของ `customers`, `leads`, `quotes`

## Result Template

```md
Check ID: LIFF-VAL-00X
Date: YYYY-MM-DD HH:mm ICT
Operator: <name>
Tester: <masked LINE account>
Result: PASS | FAIL
Evidence:
- <screenshot / token / lead id>
- <monitor or log reference>
Notes:
- <what matched>
- <exact error if failed>
```

ถ้าต้องส่ง run นี้ให้ operator คนอื่นทำต่อ ใช้ข้อความจาก [OPERATOR_HANDOFF_MESSAGE_TH.md](OPERATOR_HANDOFF_MESSAGE_TH.md)