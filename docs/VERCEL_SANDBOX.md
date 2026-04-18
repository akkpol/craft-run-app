# Vercel Sandbox Quickstart

ใช้ Vercel Sandbox เพื่อรันโค้ดที่ยังไม่ไว้ใจใน Linux microVM แยกจากเครื่องหลักของคุณและไม่ปะปนกับ environment ของแอปปกติ

## สิ่งที่ตั้งค่าไว้แล้วใน repo

- ติดตั้ง Sandbox CLI เป็น dev dependency แล้ว
- เพิ่ม npm scripts สำหรับใช้งานประจำวันแล้ว

## คำสั่งที่พร้อมใช้

```bash
npm run sandbox:help
npm run sandbox:login
npm run sandbox:list
npm run sandbox:node
npm run sandbox:python
npm run sandbox:locked
```

## แนะนำการเริ่มต้น

### 1) ล็อกอินก่อน

```bash
npm run sandbox:login
```

ถ้าโปรเจกต์นี้เชื่อมกับ Vercel อยู่แล้ว สามารถใช้ flow ของ Vercel/OIDC ตามเอกสารได้ด้วย

### 2) ทดสอบว่า sandbox ใช้งานได้

Node.js:

```bash
npm run sandbox:node
```

Python:

```bash
npm run sandbox:python
```

### 3) เปิด shell แบบปลอดภัยและตัดเน็ตออก

```bash
npm run sandbox:locked
```

คำสั่งนี้จะสร้าง sandbox แบบ:
- Linux แยกจากเครื่องหลัก
- ใช้ Node 24
- timeout 30 นาที
- ไม่มี outbound network access
- เปิด interactive shell ให้ทันที

## ตัวอย่างใช้งานกับโค้ดใน repo

### รันคำสั่งสั้น ๆ ใน sandbox

```bash
npx sandbox run --rm --runtime node24 -- node -e "console.log('hello from sandbox')"
```

### สร้าง sandbox ไว้ debug build

```bash
npx sandbox create --runtime node24 --timeout 1h
```

เมื่อได้ sandbox id แล้ว เช่น sb_abc123 ให้คัดลอกโค้ดเข้าไปและรันคำสั่ง:

```bash
npx sandbox copy ./ sb_abc123:/app/
npx sandbox exec --workdir /app sb_abc123 npm install
npx sandbox exec --workdir /app sb_abc123 npm run build
```

### รัน dev server ใน sandbox

```bash
npx sandbox create --runtime node24 --timeout 30m --publish-port 3000
npx sandbox copy ./ sb_abc123:/app/
npx sandbox exec --workdir /app sb_abc123 npm install
npx sandbox exec --workdir /app sb_abc123 npm run dev
```

## เรื่อง auth

Vercel แนะนำ 2 ทาง:
- OIDC token ของ Vercel
- Access token ผ่านการ login

สำหรับ local machine ปกติเริ่มจาก Sandbox login ได้เลย หรือใช้ Vercel link และ env pull ตามเอกสารทางการ

## เอกสารอ้างอิง

- Overview: https://vercel.com/docs/vercel-sandbox
- CLI Reference: https://vercel.com/docs/vercel-sandbox/cli-reference
- Quickstart: https://vercel.com/docs/vercel-sandbox/quickstart
