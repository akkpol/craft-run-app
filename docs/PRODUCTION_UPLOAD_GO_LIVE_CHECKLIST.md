# Production Upload Go-Live Checklist

เอกสารนี้คือ runbook สำหรับเปิดใช้งาน customer file upload ใน production แบบปลอดภัยและตรวจสอบย้อนกลับได้

Scope ของฟีเจอร์:

- ลูกค้าอัปโหลดไฟล์จากหน้า `/liff/intake`
- API intake รับ `multipart/form-data`
- backend อัปโหลดไฟล์เข้า storage provider ที่ active อยู่:
  - default = Supabase Storage bucket `customer-media`
  - optional = private Cloudflare R2 bucket `customer-media`
- metadata ถูกบันทึกในตาราง `lead_media_assets`
- admin เห็น preview ใน Design Queue

หมายเหตุ rollout ปัจจุบัน:

- `lead_media_assets` เป็น source of truth สำหรับ metadata เสมอ
- ถ้าเปิด R2 ต้อง apply migration ที่เพิ่ม `storage_provider` และ `storage_bucket` ด้วย
- current phase ยังไม่ใช้ direct browser-to-R2 upload จาก LIFF

## 1) Pre-flight

ต้องมีครบก่อนเริ่ม:

- merged commit อยู่บน `main`
- GitHub Actions บน `main` เป็นผ่าน
- Vercel production deployment เป็น `READY`
- Supabase project เป้าหมายถูกต้อง (production จริง)

## 2) Apply Migration 014 บน Production

ถ้า Supabase CLI push ไม่ผ่าน (unauthorized) ให้ใช้ SQL Editor บน Dashboard โดยตรง

รัน SQL นี้ใน production project:

```sql
CREATE TABLE IF NOT EXISTS lead_media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  original_file_name TEXT,
  mime_type TEXT,
  file_size_bytes INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_media_assets_lead
ON lead_media_assets(lead_id, created_at DESC);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'customer-media',
  'customer-media',
  FALSE,
  10485760,
  ARRAY[
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/heic',
    'image/heif',
    'application/pdf'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

ALTER TABLE lead_media_assets ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
```

## 3) Database Smoke Checks

รัน query ยืนยันหลัง apply:

```sql
select to_regclass('public.lead_media_assets') as lead_media_assets_table;

select id, name, public, file_size_limit
from storage.buckets
where id = 'customer-media';
```

ผลที่คาดหวัง:

- query แรกต้องคืนค่า `public.lead_media_assets`
- query สองต้องมี row ของ bucket `customer-media`

ถ้าเปิดใช้ R2 ด้วย ให้ยืนยันเพิ่ม:

- migration `20260426174619_lead_media_storage_provider_r2.sql` ถูก apply แล้ว
- ตาราง `lead_media_assets` มีคอลัมน์ `storage_provider` และ `storage_bucket`
- Vercel env ของ `CLOUDFLARE_R2_BUCKET`, `CLOUDFLARE_R2_ENDPOINT`, `CLOUDFLARE_R2_ACCESS_KEY_ID`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY` ถูกตั้งครบ

## 4) Application Smoke Checks (Production)

ทำแบบ end-to-end อย่างน้อย 1 รอบ:

1. เปิด LIFF ที่ `/liff` แล้วไปฟอร์ม intake
2. แนบไฟล์รูปอย่างน้อย 1 ไฟล์
3. ตรวจว่า preview แสดงได้ และลบก่อนส่งได้
4. submit ฟอร์มสำเร็จ (ไม่ error)
5. เปิด admin Design Queue แล้วเห็น customer reference preview

## 5) Failure Signatures และวิธีแก้เร็ว

อาการที่เจอบ่อย:

- `lead_media_assets missing from schema cache`
- bucket `customer-media` ไม่พบ

แนวทาง:

1. ยืนยันว่ารัน migration ในโปรเจกต์ production ตัวจริง
2. รัน `NOTIFY pgrst, 'reload schema';`
3. กลับไปทำ database smoke checks ซ้ำ
4. ทดสอบ LIFF intake ใหม่ 1 รอบ

## 6) Go/No-Go Gate

Go เมื่อครบทุกข้อ:

- migration apply สำเร็จ
- table และ bucket ถูกสร้างแล้ว
- intake upload บน production ผ่าน
- admin เห็น preview จริงจาก production data

No-Go ถ้ายังขาดข้อใดข้อหนึ่งด้านบน
