# ENV And LINE Setup Guide

คู่มือนี้มีไว้แก้จุดที่ user งงบ่อยที่สุด: `Messaging API` กับ `LIFF` เป็นคนละอย่าง และ env แต่ละตัวต้องเอามาจากคนละหน้า

## หลักการสำคัญ

- env ในโปรเจกต์นี้เป็น `ค่าที่เจ้าของระบบ/ผู้ติดตั้งต้องกรอก`
- ไม่ใช่ค่าที่ developer ต้อง hardcode ลงในโค้ด
- production ควรกรอกใน Vercel Project Environment Variables
- local dev ค่อยใช้ `.env.local` เฉพาะตอนทดสอบในเครื่อง

## สรุปสั้นที่สุด

- `Messaging API` = งานแชต LINE OA
- `LIFF` = หน้าเว็บที่เปิดใน LINE
- `Supabase` = database, auth, server data
- `NEXT_PUBLIC_BASE_URL` = URL หลักของแอป

## LINE แยกยังไง

### Messaging API

ใช้สำหรับ:
- รับ webhook ตอนลูกค้าทัก LINE OA
- ส่ง reply message
- ส่ง push message

ค่า env ที่เกี่ยวข้อง:
- `LINE_CHANNEL_SECRET`
- `LINE_CHANNEL_ACCESS_TOKEN`

ต้องไปเอาจาก:
- LINE Developers Console
- หน้า `Messaging API`

ต้องตั้งค่าเพิ่ม:
- `Webhook URL` = `https://your-app.vercel.app/api/webhook`

ใช้ในโค้ดฝั่ง server:
- `src/lib/line.ts`
- `src/app/api/webhook/route.ts`

### LIFF

ใช้สำหรับ:
- เปิดฟอร์มรับงานใน LINE
- เปิดหน้าเว็บของลูกค้าใน LINE app

ค่า env ที่เกี่ยวข้อง:
- `LIFF_ID`
- `NEXT_PUBLIC_LIFF_ID`

ต้องไปเอาจาก:
- LINE Developers Console
- หน้า `LIFF`

ต้องตั้งค่าเพิ่ม:
- `Endpoint URL` = `https://your-app.vercel.app/liff`

ใช้ในโค้ดฝั่ง client:
- `src/app/liff/layout.tsx`
- `src/app/liff/intake/page.tsx`

## ENV Mapping

| ENV | เอามาจากไหน | ใช้ทำอะไร | ใช้ฝั่งไหน |
|---|---|---|---|
| `ADMIN_EMAIL` | กำหนดเอง | email แอดมินสำหรับ login | server/auth |
| `ADMIN_PASSWORD` | กำหนดเอง | รหัสผ่านแอดมิน | server/auth |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Developers Console > Messaging API | ส่ง reply/push message | server only |
| `LINE_CHANNEL_SECRET` | LINE Developers Console > Messaging API | verify webhook signature | server only |
| `LIFF_ID` | LINE Developers Console > LIFF | ใช้สร้าง LIFF URL และ init LIFF | server + client config |
| `NEXT_PUBLIC_LIFF_ID` | ค่าเดียวกับ `LIFF_ID` | ให้ browser ใช้ `liff.init()` | public/client |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project Settings | URL โปรเจกต์ Supabase | public/client |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase Project Settings | publishable key สำหรับ browser/SSR | public/client |
| `SUPABASE_SECRET_KEY` | Supabase Project Settings | สิทธิ์ server-only สำหรับ API/admin work | server only |
| `NEXT_PUBLIC_BASE_URL` | กำหนดเอง | ใช้สร้างลิงก์ `/quote/...`, `/status/...`, `/liff` | public/client |
| `VERCEL_OIDC_TOKEN` | Vercel CLI / runtime | token สำหรับ integration บางแบบ ไม่ใช่ค่าที่ user ต้องกรอกเอง | deployment only |

## URL ที่ต้องใส่ให้ถูก

### ใน LINE Messaging API

- `Webhook URL` ต้องใส่:
  `https://your-app.vercel.app/api/webhook`

### ใน LINE LIFF

- `Endpoint URL` ต้องใส่:
  `https://your-app.vercel.app/liff`

อย่าเอา 2 อันนี้สลับกัน

## จำแบบไม่งง

- ลูกค้าทักแชต -> `Messaging API webhook`
- ลูกค้ากดปุ่มเปิดฟอร์ม -> `LIFF`
- ระบบส่ง quote/status กลับไปในแชต -> `Messaging API`

## สำหรับไฟล์ .env.local

ให้ยึดโครงตาม `.env.example`

แต่ต้องแยกให้ออกว่า:

- `.env.example` = แบบฟอร์ม/แม่แบบให้ user หรือผู้ติดตั้งกรอก
- `.env.local` = ไฟล์ local จริงในเครื่องใครเครื่องมัน
- Vercel Environment Variables = ที่ควรใช้สำหรับ production จริง
- `/admin/settings` = หน้ากรอกค่า runtime สำหรับ LINE, LIFF และ Base URL หลังจากระบบบูตได้แล้ว

ถ้าค่าไหนเป็น `NEXT_PUBLIC_` แปลว่าค่านั้น browser มองเห็นได้

ดังนั้น:
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` ใช้ได้
- `NEXT_PUBLIC_LIFF_ID` ใช้ได้
- `SUPABASE_SECRET_KEY` ห้ามย้ายไปเป็น `NEXT_PUBLIC_`
- `LINE_CHANNEL_SECRET` ห้ามใช้ฝั่ง client

## ข้อที่งงบ่อย

### `Channel ID` ใช้ไหม

ในโปรเจกต์นี้ปกติยังไม่ต้องใช้ตรงๆ ใน env

### `LIFF_ID` กับ `Channel Secret` เหมือนกันไหม

ไม่เหมือนกันคนละค่า

### `NEXT_PUBLIC_LIFF_ID` ต้องต่างจาก `LIFF_ID` ไหม

ไม่ ต้องเป็นค่าเดียวกัน

### `VERCEL_OIDC_TOKEN` ต้องตั้งเองไหม

ปกติไม่ต้อง มันไม่ใช่ app config หลักของระบบนี้

## คำเตือนสำคัญ

- อย่า commit `.env.local`
- ถ้า secret เคยถูกแชร์หรือแปะใน chat ให้ rotate ทันที
- ควรเก็บค่าจริงไว้ใน Vercel Project Environment Variables สำหรับ production
- developer ไม่ควรใส่ secret จริงค้างไว้ใน repo เพื่อรอ user มาใช้ต่อ
- ค่ากลุ่ม Supabase ยังต้องมีใน env เพื่อให้แอปเชื่อมฐานข้อมูลและเปิดหน้า settings ได้ก่อน