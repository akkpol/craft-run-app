# สรุปแอป FOGUS

## คืออะไร
FOGUS เป็นแอป Next.js ที่เชื่อม LINE OA, LIFF และ Supabase เพื่อรับความต้องการงานป้ายหรือสิ่งพิมพ์จากลูกค้า สร้างใบเสนอราคา และติดตามสถานะงานหลังลูกค้าอนุมัติ

## เหมาะกับใคร
Persona หลัก: Not found in repo.
จากหลักฐานใน repo เหมาะกับแอดมินหรือทีมปฏิบัติการของร้านป้ายหรือร้านพิมพ์ ที่ต้องรับงานจาก LINE, ออกใบเสนอราคา, เปิดงานผลิต และตามเคสที่ต้อง review เอง

## ทำอะไรได้บ้าง
- รับ webhook จาก LINE Messaging API และตรวจ `x-line-signature`
- ตอบกลับเป็น Flex Message เพื่อเปิดฟอร์ม LIFF หรือส่งเข้า escalation
- เก็บประเภทงาน ขนาด หน่วย จำนวน วันใช้งาน เบอร์โทร หมายเหตุ และข้อมูลอ้างอิง
- แปลงหน่วยเป็นมิลลิเมตร แล้วสร้าง lead, quote, quote item, VAT และยอดรวมอัตโนมัติ
- เปิดหน้าใบเสนอราคาและหน้าสถานะงานแบบ token-based ให้ลูกค้าเข้าดูได้
- สร้าง job และ timeline หลังลูกค้าอนุมัติ พร้อมส่งแจ้งเตือนสถานะกลับไปใน LINE
- แสดงแดชบอร์ดแอดมินที่รวม leads, quotes, jobs, escalations และ conversations

## ทำงานอย่างไร
- ส่วนติดต่อผู้ใช้: LINE OA chat, LIFF ที่ `/liff` -> `/liff/intake`, หน้า `/quote/[token]`, `/status/[token]`, และ `/admin`
- ฝั่งเซิร์ฟเวอร์: Next.js App Router และ API `/api/webhook`, `/api/intake`, `/api/quotes/[id]/approve`, `/api/jobs/[id]/status`
- ฝั่งข้อมูล: Supabase เก็บ conversations, messages, customers, leads, quotes, quote_items, jobs, job_timeline และ escalations โดยเปิด realtime ให้ conversations, jobs, escalations
- ลำดับข้อมูล: ลูกค้าทัก LINE -> webhook บันทึกบทสนทนา -> Flex Message เปิด LIFF -> intake API สร้าง lead/quote -> ลูกค้าอนุมัติใบเสนอราคา -> ระบบสร้าง job -> แอดมินอัปเดตสถานะและระบบ push กลับไปที่ LINE

## วิธีรัน
1. `npm install`
2. สร้างโปรเจกต์ Supabase แล้วรัน `supabase/migrations/001_initial.sql`
3. ตั้งค่า `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`, `LIFF_ID`, `NEXT_PUBLIC_LIFF_ID`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_BASE_URL`
4. รัน `npm run dev`
5. ถ้าจะทดสอบกับ LINE จริง ให้ชี้ webhook ไปที่ `/api/webhook` และตั้ง LIFF endpoint เป็น `/liff`

## ช่องว่างใน repo
- `.env.example`: Not found in repo.
- วิธีสร้างผู้ใช้แอดมินคนแรกหรือขั้นตอน seed ข้อมูล: Not found in repo.
