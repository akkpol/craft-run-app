---
title: SOP ร่าง — AI Preview Incident สำหรับแอดมิน
version: 0.1
date: 2026-04-27
owner: Delivery Engineering
status: Draft
source_runbook: docs/OPERATOR_RUNBOOK.md#2g-ai-preview-generation-failing-api-missing-provider-error-token-invalid-or-quota-exhausted
---

# SOP ร่าง — AI Preview Incident สำหรับแอดมิน

เอกสารนี้เป็น SOP ภาษาไทยแบบ 1 หน้า สำหรับใช้หน้าจอเดียวเวลาปุ่ม `สร้างภาพ AI` ใช้งานไม่ได้

## ใช้เมื่อไหร่

- กดสร้างภาพ AI แล้วขึ้น error
- lead ใด lead หนึ่งสร้าง preview ไม่ผ่าน
- แอดมินสงสัยว่า API ไม่มี, token มีปัญหา, quota หมด, หรือ provider ล่ม

## เป้าหมาย

1. แยกว่าเป็นปัญหาจาก config, token, provider, หรือ storage
2. หยุด retry มั่วที่ทำให้แยก root cause ยาก
3. ส่งต่อให้คนที่ถูกต้องพร้อมข้อมูลครบในครั้งเดียว

## เช็กเร็ว 30 วินาที

1. ลองใหม่กับ lead เดิมแค่ 1 ครั้ง
2. ดูข้อความ error ที่หน้า admin
3. เปิดดู `ai_image_error` ของ lead นั้น
4. เปิด Vercel log ของ `POST /api/leads/[id]/ai-preview`
5. ถ้าหลาย lead ล้มเหมือนกัน ให้ถือเป็นระบบก่อน ไม่ใช่ข้อมูล lead เดียว

## ตัดสินใจตามข้อความ error

### กรณี 1 — ระบบยังไม่ได้ตั้งค่า AI

ข้อความที่มักเจอ:

- `AI image generation is not configured`

ให้ทำ:

1. เข้า `/admin/settings`
2. เช็กว่าเปิด `ai_image_enabled` แล้ว
3. เช็กว่า provider, model, และ API key มีค่าจริง
4. ถ้าเพิ่งแก้ settings หรือ env var ให้ redeploy แล้วลองใหม่ 1 lead

ส่งต่อหา:

- Delivery Engineering

### กรณี 2 — ตั้ง provider ผิด

ข้อความที่มักเจอ:

- `Unsupported AI image provider`

ให้ทำ:

1. เช็ก provider ใน `/admin/settings`
2. ตั้งกลับเป็น provider ที่ระบบรองรับ
3. ถ้า source มาจาก env var ให้ redeploy

ส่งต่อหา:

- Delivery Engineering

### กรณี 3 — token ใช้ไม่ได้, หมด, ถูก revoke, หรือ quota/billing หมด

ข้อความที่มักเจอ:

- invalid key
- auth error
- insufficient quota
- billing error

ให้ทำ:

1. หยุด retry หลาย lead ทันที
2. เก็บ provider message แบบเต็มจาก log
3. เช็กว่ามีการ rotate key ล่าสุดหรือไม่
4. เปลี่ยน key ใน `/admin/settings` หรือ Vercel env
5. ถ้าแก้ env var ให้ redeploy
6. ลองใหม่ 1 lead หลังแก้เสร็จเท่านั้น

ส่งต่อหา:

- Delivery Engineering ถ้าเป็นเรื่อง key/runtime
- Business owner หรือ billing owner ถ้าเป็น quota หรือการชำระเงินกับ provider

### กรณี 4 — provider ล่มหรือ upstream ตอบผิด

ข้อความที่มักเจอ:

- `AI image provider request failed`
- timeout
- upstream 5xx

ให้ทำ:

1. เช็ก provider status ถ้ามี
2. รอช่วงสั้น ๆ แล้วลองใหม่ 1 lead
3. ถ้ายังล้มเหมือนเดิม ให้หยุด retry และ escalate

ส่งต่อหา:

- Delivery Engineering

### กรณี 5 — provider สร้างภาพได้ แต่ระบบเก็บรูปไม่สำเร็จ

สัญญาณที่มักเจอ:

- provider ผ่าน แต่ upload รูปเข้า storage ไม่ผ่าน
- log ชี้ไปที่ bucket หรือ public URL

ให้ทำ:

1. เช็ก Supabase Storage
2. เช็ก bucket `app-assets`
3. ส่งต่อพร้อมข้อความ error เต็ม

ส่งต่อหา:

- Delivery Engineering

## ถ้าใช้งานต่อเลยตอน AI ล่ม

1. อย่าหยุดงานทั้ง lead
2. ให้ทีมสลับไป manual design ชั่วคราว
3. แจ้งลูกค้าว่าการส่ง preview ล่าช้า ไม่ใช่ออเดอร์หาย
4. กลับมาใช้ AI อีกครั้งหลังทดสอบผ่าน 1 lead

## ข้อมูลที่ต้องแนบตอนส่งต่อ

- lead ID
- เวลาเริ่มล้มครั้งแรก เวลาไทย
- ข้อความ `ai_image_error`
- Vercel log ของ request ที่ล้ม
- เพิ่งมีการแก้ `/admin/settings` หรือ env var หรือไม่
- key อยู่ใน settings หรือ env var
- ล้มเฉพาะ lead เดียว หรือทุก lead

## owner ที่ถูกต้อง

- แอดมิน/Operator: เก็บข้อมูล, หยุด bulk retry, ส่งต่อ
- Delivery Engineering: แก้ config, key source, provider path, storage path
- Business owner/Billing owner: แก้ quota หรือ billing ฝั่ง provider