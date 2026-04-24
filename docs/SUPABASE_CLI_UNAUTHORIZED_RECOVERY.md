# Supabase CLI Unauthorized Recovery (Windows / PowerShell)

เอกสารนี้ใช้ตอน `supabase db push` หรือคำสั่งที่แตะ hosted project ไม่ผ่านเพราะ unauthorized กับ Management API

## อาการที่พบบ่อย

- Supabase CLI แจ้ง unauthorized / not authorized
- migration push ไป hosted production ไม่ได้
- แอปเริ่มอ้างอิง table หรือ bucket ที่ควรมีแล้ว แต่ production ยังไม่เห็น

## เป้าหมาย

1. กู้ auth ของ Supabase CLI ให้กลับมาใช้งานได้
2. ทำ migration บน production ให้สำเร็จ
3. ยืนยันผลทั้งระดับ database และระดับแอป

## ขั้นตอนกู้ auth (PowerShell)

รันใน root ของ repo

```powershell
supabase --version
supabase --help
```

ถ้า CLI เก่า ให้ update ก่อน แล้วค่อยทำขั้นตอนต่อไป

1) ล้าง session เดิม และ login ใหม่

```powershell
supabase logout
supabase login
```

2) ตรวจสถานะโปรเจกต์ที่ link อยู่

```powershell
supabase status
supabase projects list
```

3) link โปรเจกต์ใหม่ให้ชัดเจน

```powershell
supabase link --project-ref <your_project_ref>
```

4) ตรวจว่ามองเห็น migrations ได้

```powershell
supabase migration list
```

5) push อีกครั้ง

```powershell
supabase db push
```

## ถ้ายัง unauthorized หลัง re-login

ให้ใช้ fallback ทันทีเพื่อปลด blocker production:

1. เปิด Supabase Dashboard ของ production project
2. SQL Editor -> รัน SQL จาก migration ที่ค้าง (เช่น `014_customer_media_assets.sql`)
3. รัน:

```sql
NOTIFY pgrst, 'reload schema';
```

4. ตรวจว่ามี table/bucket ตาม migration

## เช็กลิสต์ยืนยันหลังแก้เสร็จ

- `public.lead_media_assets` มีอยู่จริง
- `storage.buckets` มี `customer-media`
- flow `/liff/intake` อัปโหลดและ submit ได้
- admin Design Queue เห็น preview ได้

## หมายเหตุสำคัญ

- อย่ารอแก้ CLI อย่างเดียวถ้า production ถูกบล็อก ให้ใช้ SQL Editor เป็นทางปลดล็อกก่อน
- หลังสถานการณ์นิ่งแล้วค่อยกลับมาทำให้ CLI path ใช้ได้ถาวร
- ถ้าจะทำ schema-sensitive rollout ให้เตรียม query smoke test ไว้คู่ migration ทุกครั้ง
