---
title: Phase 2 Operator Gate Checklist
version: 1.0
date: 2026-04-30
owner: Delivery Engineering
status: Active
source_refs:
  - docs/GO_NOGO_REVIEW.md
  - docs/ENV_AND_LINE_SETUP.md
  - plan/process-go-live-waves-1.md
---

# Phase 2 Operator Gate Checklist

เอกสารนี้ใช้ปิด operator-only gates ที่ยังค้างใน Phase 2 แบบทีละข้อโดยไม่ต้องตีความเอกสารหลักหลายไฟล์พร้อมกัน

ถ้าต้องส่งให้ operator แบบลิงก์เดียวก่อน ให้เริ่มจาก [OPERATOR_LAUNCH_ONE_PAGE.md](OPERATOR_LAUNCH_ONE_PAGE.md) แล้วค่อยย้อนกลับมาหน้านี้เมื่อข้อใดข้อหนึ่ง fail หรือต้องการรายละเอียดเพิ่ม

ใช้กับ gates ต่อไปนี้เท่านั้น:

- `P2-G03` Vercel deploy succeeds after env vars set
- `P2-G05` LINE Messaging API webhook URL registered and verified
- `P2-G06` LINE MINI App LIFF endpoint registered
- `P2-G07` Admin user created in Supabase Auth

## Preconditions

สิ่งที่ยืนยันแล้วก่อนเริ่ม checklist นี้:

- `https://craft-run.vercel.app/liff` ตอบ `200`
- `https://craft-run.vercel.app/api/webhook` แบบ `GET` ตอบ `405`
- `https://craft-run.vercel.app/admin` แบบ unauthenticated redirect ไป `/auth/login`
- `npm run check:line-liff-env` ผ่านแล้วใน workspace ปัจจุบัน

ถ้าเจอผลไม่ตรง 4 ข้อนี้ ให้หยุดและแก้ปลายทางก่อน ไม่ต้องกด verify ซ้ำใน console

## Evidence Rule

ทุก gate ต้องมี evidence ที่เก็บได้โดยไม่เปิดเผย secret เต็มค่า

ถ้าไม่แน่ใจว่าต้องแคปหน้าจอหรือเก็บ log ตรงไหน ให้ใช้ [OPERATOR_EVIDENCE_CAPTURE_CHECKLIST.md](OPERATOR_EVIDENCE_CAPTURE_CHECKLIST.md) ควบคู่กัน

เก็บอย่างน้อย:

- วันเวลาไทย
- คนที่กดยืนยัน
- URL หรือ screen ที่ใช้ยืนยัน
- ผลลัพธ์ PASS หรือ FAIL
- ข้อความ error แบบ exact ถ้าไม่ผ่าน

ห้ามบันทึกค่าเต็มของ:

- `LINE_CHANNEL_ACCESS_TOKEN`
- `LINE_CHANNEL_SECRET`
- `SUPABASE_SECRET_KEY`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- LIFF ID เต็มค่า ถ้าไม่จำเป็น

## Gate Order

ให้ทำตามลำดับนี้เท่านั้น:

1. `P2-G03`
2. `P2-G05`
3. `P2-G06`
4. `P2-G07`

Stop rule:

- ถ้า `P2-G03` ไม่ผ่าน ให้หยุด Phase 2 ทันที
- ถ้า `P2-G05` หรือ `P2-G06` ไม่ผ่าน ให้หยุดก่อนเข้า live LIFF run
- ถ้า `P2-G07` ไม่ผ่าน จะยังเข้า Phase 3 ฝั่งแอดมินไม่ได้ครบ

## P2-G03 — Vercel Deploy

เป้าหมาย:

- มี production deployment ล่าสุดที่ `Ready`
- ผูกกับ alias `https://craft-run.vercel.app`

ขั้นตอน:

1. เปิด Vercel dashboard ของโปรเจกต์ `craft-run`
2. ไปที่ `Deployments`
3. หา deployment ล่าสุดของ production alias
4. ยืนยันว่า status เป็น `Ready`
5. เปิด deployment detail แล้วจด deployment ID
6. ยืนยันว่า alias มี `craft-run.vercel.app`

เก็บหลักฐาน:

- deployment ID
- production URL
- screenshot หรือ log excerpt ที่แสดง `Ready`

PASS เมื่อ:

- latest production deployment เป็น `Ready`
- alias ชี้ไปที่ `https://craft-run.vercel.app`

FAIL เมื่อ:

- deployment ล่าสุด `Error`, `Canceled`, `Building` ค้าง, หรือ alias ไม่ตรง

## P2-G05 — LINE Messaging API Webhook Verify

ค่าเป้าหมาย:

- Webhook URL ต้องเป็น `https://craft-run.vercel.app/api/webhook`

ขั้นตอน:

1. เปิด LINE Developers Console
2. เข้า channel ฝั่ง `Messaging API`
3. เปิดหน้า webhook settings
4. ตรวจว่า URL ตรงกับ `https://craft-run.vercel.app/api/webhook`
5. กด `Verify`
6. รอผลยืนยันจาก console

เก็บหลักฐาน:

- screenshot หน้า console หลัง verify
- webhook URL สุดท้าย
- เวลาที่กด verify

PASS เมื่อ:

- console แสดงว่า verify สำเร็จ
- URL ตรงกับ production alias ปัจจุบัน

FAIL เมื่อ:

- verify ไม่ผ่าน
- URL ชี้ผิด domain/path

ถ้า FAIL ให้เช็กทันที:

1. `app_settings.line_channel_secret` กับ secret ใน Messaging API channel ตรงกันหรือไม่
2. channel ที่เปิดอยู่เป็น Messaging API channel ที่ถูกตัวหรือไม่
3. production alias เปลี่ยนแต่ webhook URL ยังไม่อัปเดตหรือไม่

## P2-G06 — LINE MINI App / LIFF Endpoint Verify

ค่าเป้าหมาย:

- Endpoint URL ต้องเป็น `https://craft-run.vercel.app/liff`
- อย่าใช้ `/liff/intake` เป็น registered endpoint

ขั้นตอน:

1. เปิด LINE Developers Console
2. เข้า channel ฝั่ง `LINE MINI App / LIFF`
3. เปิดหน้าจัดการ LIFF app หรือ endpoint
4. ยืนยันว่า endpoint เป็น `https://craft-run.vercel.app/liff`
5. ยืนยันว่า LIFF ID ใน console ตรงกับค่าที่ deploy ใช้
6. ถ้าต้องบันทึกค่า ให้ยืนยันว่า `LIFF_ID` และ `NEXT_PUBLIC_LIFF_ID` ใช้ค่าเดียวกัน

เก็บหลักฐาน:

- screenshot หน้า endpoint/LIFF ID
- LIFF ID แบบ masked เช่น 4 ตัวท้าย
- เวลาที่ตรวจ

PASS เมื่อ:

- endpoint เป็น `/liff`
- LIFF ID ตรงกันทั้ง console และ env ที่ใช้งานจริง

FAIL เมื่อ:

- endpoint ชี้ `/liff/intake`
- LIFF ID ไม่ตรงกัน
- console ยังผูกกับ domain เก่า

## P2-G07 — Admin User And Allowlist

เป้าหมาย:

- มี admin user จริงใน Supabase Auth
- email เดียวกันอยู่ใน allowlist ที่ production ใช้งานอยู่

ขั้นตอน:

1. เปิด Supabase dashboard ของ production project
2. ไปที่ `Authentication` > `Users`
3. สร้างหรือ invite admin user
4. ยืนยันว่า email ถูกต้อง
5. ยืนยันว่า email เดียวกันอยู่ใน `ADMIN_ALLOWED_EMAILS`
6. ถ้าเพิ่งเปลี่ยน allowlist env ให้ redeploy หนึ่งรอบ

เก็บหลักฐาน:

- screenshot user record ใน Supabase Auth
- email แบบ masked
- note ว่ามีหรือไม่มีการ redeploy หลังแก้ allowlist

PASS เมื่อ:

- มี admin user จริง
- email ตรงกับ allowlist production

FAIL เมื่อ:

- user ยังไม่มี
- มี user แต่ email ไม่อยู่ใน allowlist
- เปลี่ยน allowlist แล้วไม่ได้ redeploy

## Result Template

ใช้รูปแบบนี้บันทึกผลต่อ gate:

```md
Gate: P2-G0X
Date: YYYY-MM-DD HH:mm ICT
Operator: <name>
Result: PASS | FAIL
Evidence:
- <deployment ID / screenshot / console confirmation>
- <final URL or masked ID>
Notes:
- <exact error or important observation>
```

## After Phase 2

เมื่อ 4 gates นี้ผ่านครบแล้ว ค่อยไปต่อที่ live LIFF run ใน [LIFF_LIVE_VALIDATION_RUNBOOK.md](LIFF_LIVE_VALIDATION_RUNBOOK.md)

ถ้าต้องส่งงานต่อให้ operator ใช้ข้อความจาก [OPERATOR_HANDOFF_MESSAGE_TH.md](OPERATOR_HANDOFF_MESSAGE_TH.md) ได้ทันที