---
title: Operator Handoff Message TH
version: 1.0
date: 2026-04-30
owner: Delivery Engineering
status: Active
source_refs:
  - docs/OPERATOR_LAUNCH_ONE_PAGE.md
  - docs/PHASE2_OPERATOR_GATE_CHECKLIST.md
  - docs/LIFF_LIVE_VALIDATION_RUNBOOK.md
  - docs/GO_NOGO_REVIEW.md
---

# Operator Handoff Message TH

ใช้ข้อความชุดนี้เวลาส่งงานต่อให้ operator หรือคนที่ต้องเข้า Vercel, LINE Developers, LIFF console, และ Supabase dashboard

## Message - Single File

### LINE Version

```text
เปิดเอกสารนี้เป็นหลักได้เลย:
docs/OPERATOR_LAUNCH_ONE_PAGE.md

ทำตามลำดับในนั้น และส่งผลกลับตาม format เดียวกันทุกข้อ
ถ้าข้อไหน fail หรืออยากรู้ว่าต้องแคปหน้าจอจากหน้าไหน ค่อยเปิดเอกสารอ้างอิงที่ลิงก์อยู่ในหน้านั้นต่อ
```

### Slack Version

```text
Use this single doc for the operator run:
docs/OPERATOR_LAUNCH_ONE_PAGE.md

Follow the order in that file and send every result back using the same reply format.
Open the deeper docs only if a step fails or you need exact capture points.
```

## Message 0 — Ultra Short

### LINE Version

```text
ตอนนี้โค้ดพร้อมแล้ว เหลือ operator verification 2 ช่วง:
1) ปิด P2-G03, P2-G05, P2-G06, P2-G07
2) ถ้าผ่านครบ ค่อยรัน LIFF-VAL-005 ถึง LIFF-VAL-008

ให้เก็บเวลาไทย + PASS/FAIL + screenshot/log + URL หรือ masked ID + exact error ถ้ามี

ดูคู่มือที่:
- docs/OPERATOR_LAUNCH_ONE_PAGE.md
- docs/PHASE2_OPERATOR_GATE_CHECKLIST.md
- docs/LIFF_LIVE_VALIDATION_RUNBOOK.md
- docs/OPERATOR_EVIDENCE_CAPTURE_CHECKLIST.md
- docs/GO_NOGO_REVIEW.md
```

### Slack Version

```text
Need operator-only evidence to move launch readiness forward:

1. Close P2-G03 / P2-G05 / P2-G06 / P2-G07
2. If all pass, run LIFF-VAL-005..008
3. Fill evidence back into docs/GO_NOGO_REVIEW.md

Capture requirement: Thai time, PASS/FAIL, screenshot or log excerpt, URL or masked ID, exact error if failed

Refs:
- docs/OPERATOR_LAUNCH_ONE_PAGE.md
- docs/PHASE2_OPERATOR_GATE_CHECKLIST.md
- docs/LIFF_LIVE_VALIDATION_RUNBOOK.md
- docs/OPERATOR_EVIDENCE_CAPTURE_CHECKLIST.md
```

## Message 1 — Phase 2 Gates

```text
รบกวนช่วยปิด operator gates ของ Phase 2 ตาม checklist นี้ก่อนเริ่ม live run:

1) P2-G03 ยืนยันว่า production deployment ล่าสุดของ craft-run เป็น Ready และ alias ชี้ที่ https://craft-run.vercel.app
2) P2-G05 เข้า LINE Developers ฝั่ง Messaging API แล้วยืนยันว่า webhook URL เป็น https://craft-run.vercel.app/api/webhook และกด Verify ให้ผ่าน
3) P2-G06 เข้า LINE MINI App / LIFF console แล้วยืนยันว่า endpoint เป็น https://craft-run.vercel.app/liff และ LIFF ID ตรงกับค่าที่ deploy ใช้งานจริง
4) P2-G07 เข้า Supabase Auth แล้วยืนยันว่ามี admin user จริง และ email เดียวกันอยู่ใน ADMIN_ALLOWED_EMAILS

ให้เก็บ evidence ต่อข้อดังนี้:
- เวลาไทย
- คนที่ตรวจ
- screenshot หรือ log excerpt
- URL หรือ masked ID ที่เกี่ยวข้อง
- ผล PASS/FAIL
- exact error ถ้าไม่ผ่าน

รายละเอียดเต็มอยู่ที่:
docs/OPERATOR_LAUNCH_ONE_PAGE.md
docs/PHASE2_OPERATOR_GATE_CHECKLIST.md
docs/OPERATOR_EVIDENCE_CAPTURE_CHECKLIST.md
```

## Message 2 — Live LIFF Run

```text
หลังจาก Phase 2 ผ่านครบแล้ว รบกวนช่วยรัน live LIFF validation ต่อ 4 scenario นี้:

1) LIFF-VAL-005 ลูกค้าใหม่: LINE -> LIFF -> submit intake -> ต้องมี customer, lead, quote ถูกสร้างครบ
2) LIFF-VAL-006 ลูกค้าเดิม: เปิด LIFF ใหม่แล้วต้องเห็น prefill ของ phone, document type, billing defaults และถ้ามีให้ reuse width/height/qty
3) LIFF-VAL-007 company tax document: เคสไม่กรอก branch code ต้อง fail ด้วยข้อความไทย และเมื่อกรอก branch code แล้วต้อง submit ผ่าน
4) LIFF-VAL-008 runtime catalog: product picker ต้องโหลด runtime catalog ได้ และหน้า quote/status/download ต้องแสดง product label แบบอ่านได้ ไม่ใช่ slug ดิบ

ถ้า LIFF พังก่อน submit หรือไม่แน่ใจว่า request ไปถึง server หรือไม่ ให้เช็ก /admin/liff-monitor ก่อนเป็นจุดแรก

ให้เก็บ evidence ต่อ scenario ดังนี้:
- เวลาไทย
- ผู้ทดสอบแบบ masked
- screenshot จุดสำคัญ
- lead ID หรือ quote token ถ้ามี
- PASS/FAIL
- exact error ถ้าไม่ผ่าน

รายละเอียดเต็มอยู่ที่:
docs/OPERATOR_LAUNCH_ONE_PAGE.md
docs/LIFF_LIVE_VALIDATION_RUNBOOK.md
docs/OPERATOR_EVIDENCE_CAPTURE_CHECKLIST.md
```

## Message 3 — Combined Short Version

```text
ตอนนี้ฝั่งโค้ดพร้อมสำหรับ operator/live verification แล้ว เหลือเฉพาะ evidence จริงจาก Vercel + LINE + LIFF + Supabase Auth + live customer run

ลำดับที่ต้องทำ:
1) ปิด P2-G03, P2-G05, P2-G06, P2-G07
2) ถ้าผ่านครบ ค่อยรัน LIFF-VAL-005 ถึง LIFF-VAL-008
3) กรอก evidence กลับเข้า docs/GO_NOGO_REVIEW.md

คู่มือใช้งาน:
- docs/OPERATOR_LAUNCH_ONE_PAGE.md
- docs/PHASE2_OPERATOR_GATE_CHECKLIST.md
- docs/LIFF_LIVE_VALIDATION_RUNBOOK.md
- docs/OPERATOR_EVIDENCE_CAPTURE_CHECKLIST.md
- docs/GO_NOGO_REVIEW.md
```