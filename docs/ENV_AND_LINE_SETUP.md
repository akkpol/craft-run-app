# ENV And LINE Setup Guide

คู่มือนี้มีไว้แก้จุดที่ user งงบ่อยที่สุด: `Messaging API` กับ `LINE MINI App / LIFF` เป็นคนละอย่าง และ env แต่ละตัวต้องเอามาจากคนละหน้า

## หลักการสำคัญ

- env ในโปรเจกต์นี้เป็น `ค่าที่เจ้าของระบบ/ผู้ติดตั้งต้องกรอก`
- ไม่ใช่ค่าที่ developer ต้อง hardcode ลงในโค้ด
- production ควรกรอกใน Vercel Project Environment Variables
- local dev ค่อยใช้ `.env.local` เฉพาะตอนทดสอบในเครื่อง

## สรุปสั้นที่สุด

- `Messaging API` = งานแชต LINE OA
- `LINE MINI App / LIFF` = หน้า mini app ที่เปิดใน LINE
- `Supabase` = database, auth, server data
- `NEXT_PUBLIC_BASE_URL` = URL หลักของแอป
- `Cloudflare R2` = optional private blob storage สำหรับ customer media โดยยังให้ Supabase ถือ metadata/permission mapping
- Backoffice ใช้ `Supabase Auth + email allowlist` ไม่ได้ใช้ password จาก env โดยตรง

## หมายเหตุอัปเดต 2026

- งานใหม่ควรมองเว็บแอปใน LINE เป็น `LINE MINI App` ที่ใช้ `LIFF SDK` อยู่ข้างใต้
- โปรเจกต์นี้ยังเก็บค่า runtime หลักเป็น `LIFF_ID` เพราะทั้ง SDK และลิงก์ `liff.line.me` ยังใช้ค่าชุดนี้จริง
- `Messaging API` ควรแยกจาก mini app ชัดเจน: OA/webhook อยู่ฝั่ง Messaging API, ส่วนหน้าเว็บใน LINE อยู่ฝั่ง LINE MINI App / LIFF
- `/liff` คือ registered endpoint หลักของโปรเจกต์นี้ และหน้าเริ่มต้นควรถูกเปิดที่ path นี้โดยตรงก่อนทำ flow อื่น

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

### LINE MINI App / LIFF

ใช้สำหรับ:
- เปิดฟอร์มรับงานใน LINE
- เปิดหน้าเว็บของลูกค้าใน LINE app
- ใช้เป็น mini app ของลูกค้าภายใน LINE โดยอาศัย LIFF SDK

สำหรับงานใหม่:
- ควรสร้างฝั่งเว็บแอปบน LINE Login channel หรือ LINE MINI App channel
- ไม่ควรใช้ Messaging API channel มาแทน mini app/web app

ค่า env ที่เกี่ยวข้อง:
- `LIFF_ID`
- `NEXT_PUBLIC_LIFF_ID`

ต้องไปเอาจาก:
- LINE Developers Console
- หน้า `LIFF`

ต้องตั้งค่าเพิ่ม:
- `Endpoint URL` = `https://your-app.vercel.app/liff`
- ให้แอปเปิดที่ registered endpoint นี้โดยตรง และหลีกเลี่ยงการ redirect ไป path อื่นก่อน `liff.init()`
- หน้า LIFF/MINI App ควรเผื่อ `env(safe-area-inset-bottom)` เพื่อรองรับ edge-to-edge บน LINE เวอร์ชันใหม่

ใช้ในโค้ดฝั่ง client:
- `src/app/liff/layout.tsx`
- `src/app/liff/page.tsx`
- `src/app/liff/intake/page.tsx`

## ENV Mapping

| ENV | เอามาจากไหน | ใช้ทำอะไร | ใช้ฝั่งไหน |
|---|---|---|---|
| `ADMIN_ALLOWED_EMAILS` | กำหนดเอง | allowlist ของอีเมลที่มีสิทธิ์เข้า `/admin` | server/auth |
| `ADMIN_EMAIL` | กำหนดเอง | fallback แบบอีเมลเดียวสำหรับ allowlist รุ่นเก่า | server/auth |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Developers Console > Messaging API | ส่ง reply/push message | server only |
| `LINE_CHANNEL_SECRET` | LINE Developers Console > Messaging API | verify webhook signature | server only |
| `LIFF_ID` | LINE Developers Console > LIFF | ใช้สร้าง LIFF URL และ init LIFF | server + client config |
| `NEXT_PUBLIC_LIFF_ID` | ค่าเดียวกับ `LIFF_ID` | ให้ browser ใช้ `liff.init()` | public/client |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project Settings | URL โปรเจกต์ Supabase | public/client |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase Project Settings | publishable key สำหรับ browser/SSR | public/client |
| `SUPABASE_SECRET_KEY` | Supabase Project Settings | สิทธิ์ server-only สำหรับ API/admin work | server only |
| `NEXT_PUBLIC_BASE_URL` | กำหนดเอง | ใช้สร้างลิงก์ `/quote/...`, `/status/...`, `/liff` | public/client |
| `CLOUDFLARE_R2_BUCKET` | Cloudflare Dashboard > R2 | ชื่อ bucket สำหรับเก็บ customer media blobs | server only |
| `CLOUDFLARE_R2_ENDPOINT` | Cloudflare Dashboard > R2 | S3-compatible endpoint สำหรับ signed upload/read | server only |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | Cloudflare Dashboard > R2 API Tokens | access key สำหรับ server-side R2 client | server only |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | Cloudflare Dashboard > R2 API Tokens | secret key สำหรับ server-side R2 client | server only |
| `CLOUDFLARE_R2_REGION` | กำหนดเอง | region hint สำหรับ S3 client; ใช้ `auto` สำหรับ R2 โดยทั่วไป | server only |
| `VERCEL_OIDC_TOKEN` | Vercel CLI / runtime | token สำหรับ integration บางแบบ ไม่ใช่ค่าที่ user ต้องกรอกเอง | deployment only |

## URL ที่ต้องใส่ให้ถูก

### ใน LINE Messaging API

- `Webhook URL` ต้องใส่:
  `https://your-app.vercel.app/api/webhook`

### ใน LINE MINI App / LIFF

- `Endpoint URL` ต้องใส่:
  `https://your-app.vercel.app/liff`

อย่าเอา 2 อันนี้สลับกัน

## จำแบบไม่งง

- ลูกค้าทักแชต -> `Messaging API webhook`
- ลูกค้ากดปุ่มเปิดฟอร์ม -> `LINE MINI App / LIFF`
- ระบบส่ง quote/status กลับไปในแชต -> `Messaging API`

## สำหรับไฟล์ .env.local

ให้ยึดโครงตาม `.env.example`

แต่ต้องแยกให้ออกว่า:

- `.env.example` = แบบฟอร์ม/แม่แบบให้ user หรือผู้ติดตั้งกรอก
- `.env.local` = ไฟล์ local จริงในเครื่องใครเครื่องมัน
- Vercel Environment Variables = ที่ควรใช้สำหรับ production จริง
- `/admin/settings` = หน้ากรอกค่า runtime สำหรับ LINE Messaging API, LINE MINI App / LIFF และ Base URL หลังจากระบบบูตได้แล้ว

## Backoffice Auth ตอนนี้ทำงานยังไง

- ผู้ใช้หลังบ้านล็อกอินผ่าน `Supabase Auth`
- password ไม่ได้อ่านจาก env แล้ว
- env ฝั่ง admin ใช้แค่บอกว่า email ไหนเข้า `/admin` ได้
- ถ้าไม่ได้ตั้ง `ADMIN_ALLOWED_EMAILS` หรือ `ADMIN_EMAIL` ระบบจะปิด `/admin` ไว้ก่อนแบบ fail-closed

สิ่งที่ owner ต้องทำให้ครบ:

- สร้าง user ใน `Supabase Auth`
- ตั้ง password หรือส่ง invite ให้ user ผ่าน Supabase
- ใส่อีเมลเดียวกันลงใน `ADMIN_ALLOWED_EMAILS`

ตัวอย่าง:

```env
ADMIN_ALLOWED_EMAILS="admin@example.com,ops@example.com"
```

ถ้าค่าไหนเป็น `NEXT_PUBLIC_` แปลว่าค่านั้น browser มองเห็นได้

ดังนั้น:
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` ใช้ได้
- `NEXT_PUBLIC_LIFF_ID` ใช้ได้
- `SUPABASE_SECRET_KEY` ห้ามย้ายไปเป็น `NEXT_PUBLIC_`
- `LINE_CHANNEL_SECRET` ห้ามใช้ฝั่ง client
- `CLOUDFLARE_R2_ACCESS_KEY_ID` และ `CLOUDFLARE_R2_SECRET_ACCESS_KEY` ต้องอยู่ฝั่ง server เท่านั้น

## Cloudflare R2 สำหรับ customer media

โหมดที่รองรับในตอนนี้คือ:

- upload request ยังเข้าที่ application/API boundary เหมือนเดิม
- server เป็นคนอัปโหลดไฟล์เข้า private R2 bucket เมื่อ env ของ R2 ถูกตั้งครบ
- Supabase ยังเก็บ metadata ของไฟล์และ mapping กับ lead/job/customer
- ถ้า env ของ R2 ยังไม่ครบ ระบบจะ fallback ไป Supabase Storage path เดิม

ข้อสำคัญ:

- อย่า expose credential ของ R2 ไปที่ LIFF client
- อย่าเปิด bucket ลูกค้าเป็น public เพื่อแก้ปัญหา preview เร็ว ๆ
- signed URL ควรถูกสร้างจาก server-side code เท่านั้น
- ถ้าจะไปสู่ direct browser-to-R2 upload ให้ถือว่าเป็น phase ถัดไปที่ต้องทดสอบ LIFF/LINE behavior แยกต่างหาก

## ข้อที่งงบ่อย

### `Channel ID` ใช้ไหม

ในโปรเจกต์นี้ปกติยังไม่ต้องใช้ตรงๆ ใน env

### `LIFF_ID` กับ `Channel Secret` เหมือนกันไหม

ไม่เหมือนกันคนละค่า

### `NEXT_PUBLIC_LIFF_ID` ต้องต่างจาก `LIFF_ID` ไหม

ไม่ ต้องเป็นค่าเดียวกัน

### password ของแอดมินอยู่ใน `.env` ไหม

ไม่อยู่แล้ว password ของ backoffice ควรจัดการใน Supabase Auth เท่านั้น

### `VERCEL_OIDC_TOKEN` ต้องตั้งเองไหม

ปกติไม่ต้อง มันไม่ใช่ app config หลักของระบบนี้

## GitHub Actions CI

CI (`npm run build`) จะรันในทุก push/PR และต้องมีค่า env ครบเช่นกัน
ตั้งค่าเหล่านี้ใน **GitHub Repository → Settings → Secrets and variables → Actions**:

| Secret | ค่าตัวอย่าง | หมายเหตุ |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` | |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_xxx` | |
| `SUPABASE_SECRET_KEY` | `sb_secret_xxx` | |
| `LINE_CHANNEL_SECRET` | `xxx` | |
| `LINE_CHANNEL_ACCESS_TOKEN` | `xxx` | |
| `LIFF_ID` | `1234567890-xxxxxxxx` | |
| `NEXT_PUBLIC_LIFF_ID` | ค่าเดียวกับ `LIFF_ID` | |
| `NEXT_PUBLIC_BASE_URL` | `https://your-app.vercel.app` | |
| `ADMIN_ALLOWED_EMAILS` | `admin@example.com` | อีเมลที่เข้า `/admin` ได้ รองรับหลายอีเมลด้วย `,` หรือ `;` |

ถ้าไม่ตั้ง `ADMIN_ALLOWED_EMAILS` build จะล้มด้วย `Missing admin allowlist` เพราะระบบ fail-closed

## คำเตือนสำคัญ

- อย่า commit `.env.local`
- ถ้า secret เคยถูกแชร์หรือแปะใน chat ให้ rotate ทันที
- ควรเก็บค่าจริงไว้ใน Vercel Project Environment Variables สำหรับ production
- developer ไม่ควรใส่ secret จริงค้างไว้ใน repo เพื่อรอ user มาใช้ต่อ
- ค่ากลุ่ม Supabase ยังต้องมีใน env เพื่อให้แอปเชื่อมฐานข้อมูลและเปิดหน้า settings ได้ก่อน