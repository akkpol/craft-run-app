# FOGUS — ภาพรวมระบบสำหรับผู้บริหาร

> ระบบ ERP สำหรับร้านพิมพ์/ป้าย ที่รับงานผ่าน LINE Official Account
> ครบ end-to-end ตั้งแต่ลูกค้าทักแชต → ปิดงาน

---

## 1. แผนผังโฟลว์ทั้งระบบ

```mermaid
flowchart TD
    subgraph CUSTOMER["👤 ลูกค้า"]
        A1[ทักทาย LINE OA]
        A2[กรอกฟอร์ม LIFF<br/>ขนาด/จำนวน/รูปอ้างอิง]
        A3[ดูใบเสนอราคา<br/>กด Approve / Reject]
        A4[อัปสลิปโอน<br/>ผ่านลิงก์ quote]
        A5[ตรวจ Preview ภาพดีไซน์]
        A6[รับสินค้า / ตรวจรับ]
    end

    subgraph SYSTEM["🤖 ระบบอัตโนมัติ"]
        B1[Webhook รับข้อความ<br/>+ตอบส่งลิงก์ LIFF]
        B2[คำนวณราคา<br/>+สร้าง quote อัตโนมัติ]
        B3[ส่ง notification ทุก gate]
        B4{เช็ค payment gate<br/>credit/deposit/prepaid}
        B5[AI สร้าง preview<br/>จาก design brief]
    end

    subgraph CRM["📋 CRM / รับงาน"]
        C1[ตรวจ requirement<br/>เคสที่ AI quote ไม่ได้]
        C2[ติดตามลูกค้าที่เงียบ]
        C3[รับงาน walk-in/โทร/Facebook]
    end

    subgraph FINANCE["💰 การเงิน"]
        D1[ตรวจสลิปโอน<br/>match กับ payment id]
        D2[เลือกผู้รับเงิน<br/>+ออกใบกำกับภาษี/ใบเสร็จ]
        D3[Export CSV รายเดือน<br/>ให้นักบัญชี]
    end

    subgraph DESIGN["🎨 ออกแบบ / QC"]
        E1[ตรวจ prompt<br/>กดสั่ง AI generate]
        E2[คัด preview<br/>+ส่งให้ลูกค้าตรวจ]
        E3[ปรับแบบตาม feedback<br/>หรือ approve ส่งผลิต]
    end

    subgraph PRODUCTION["🏭 ผลิต / จัดส่ง"]
        F1[เปิดงานผลิตจริง<br/>หลัง gate ผ่านทั้งหมด]
        F2[อัปหลักฐาน<br/>การผลิต/ติดตั้ง]
        F3[ปิดงาน<br/>+ส่งหลักฐานลูกค้า]
    end

    A1 --> B1
    B1 -->|ส่งลิงก์ LIFF| A2
    A2 -->|/api/intake| B2
    B2 -->|ข้อมูลครบ| A3
    B2 -.->|ข้อมูลไม่ครบ| C1
    C1 -.->|ขอข้อมูลเพิ่ม| A2
    C2 -.-> A2
    C3 -.-> B2

    A3 -->|Approve| B4
    A3 -->|Reject| C2
    A4 --> D1
    B4 -->|จ่ายครบ| E1
    B4 -.->|ยังไม่ครบ| D1
    D1 --> B4
    D2 --> F1

    E1 --> B5
    B5 --> E2
    E2 --> A5
    A5 -->|ขอแก้| E3
    A5 -->|รับ| F1
    E3 --> E2

    F1 --> F2
    F2 --> F3
    F3 --> A6

    B3 -.->|แจ้งทุก gate| A1
    B3 -.->|แจ้งทีม| CRM
    B3 -.->|แจ้งทีม| DESIGN
    B3 -.->|แจ้งทีม| PRODUCTION

    classDef customer fill:#e0f2fe,stroke:#0284c7,color:#0c4a6e
    classDef system fill:#f5f3ff,stroke:#7c3aed,color:#5b21b6
    classDef crm fill:#fef3c7,stroke:#d97706,color:#92400e
    classDef finance fill:#fee2e2,stroke:#dc2626,color:#991b1b
    classDef design fill:#dcfce7,stroke:#16a34a,color:#14532d
    classDef production fill:#e0e7ff,stroke:#4f46e5,color:#312e81

    class A1,A2,A3,A4,A5,A6 customer
    class B1,B2,B3,B4,B5 system
    class C1,C2,C3 crm
    class D1,D2,D3 finance
    class E1,E2,E3 design
    class F1,F2,F3 production
```

---

## 2. State Machine — 12 สถานะหลัก

```mermaid
stateDiagram-v2
    [*] --> NEW: ลูกค้าทักครั้งแรก
    NEW: ข้อความใหม่
    COLLECT: กำลังเก็บ requirement
    REVIEW: ตรวจ requirement
    QUOTE_APPROVAL: รออนุมัติใบเสนอราคา
    PAYMENT: รอชำระเงิน
    DESIGN: ออกแบบ
    PRODUCTION: ผลิต
    READY: พร้อมส่งมอบ
    HOLD: รอลูกค้าตอบ
    REVIEW_EXC: รอแอดมินตัดสินใจ
    DONE: เสร็จสิ้น
    CANCELLED: ยกเลิก

    NEW --> COLLECT: บอตส่งลิงก์ LIFF
    COLLECT --> REVIEW: ลูกค้ากรอกฟอร์ม
    COLLECT --> HOLD: ขอข้อมูลเพิ่ม
    HOLD --> COLLECT: ลูกค้าตอบกลับ
    REVIEW --> QUOTE_APPROVAL: ระบบสร้าง quote
    QUOTE_APPROVAL --> PAYMENT: ผ่าน + ยังไม่จ่าย
    QUOTE_APPROVAL --> DESIGN: ผ่าน + จ่ายครบ
    PAYMENT --> DESIGN: การเงินยืนยันชำระ
    DESIGN --> PRODUCTION: ดีไซน์/QC ผ่าน
    PRODUCTION --> READY: ผลิตเสร็จ
    READY --> DONE: ส่งมอบ
    DESIGN --> HOLD: ขอข้อมูลเพิ่มจากลูกค้า
    DESIGN --> REVIEW_EXC: ปัญหาที่ต้องเจ้าของตัดสิน
    REVIEW_EXC --> DESIGN: แก้แล้ว
    QUOTE_APPROVAL --> CANCELLED: ลูกค้า reject
    DESIGN --> CANCELLED: ยกเลิกระหว่างทาง
    DONE --> [*]
    CANCELLED --> [*]
```

---

## 3. ความเป็นเจ้าของแต่ละขั้นตอน

| ขั้นตอน | เจ้าของ | ทำอะไร | ระบบช่วยอย่างไร |
|---|---|---|---|
| รับข้อความ | 🤖 ระบบ | ตอบอัตโนมัติพร้อมลิงก์ฟอร์ม | 100% auto |
| เก็บ requirement | 👤 ลูกค้า | กรอกฟอร์มผ่าน LINE | LIFF mini-app |
| สร้างใบเสนอราคา | 🤖 ระบบ | คำนวณราคา + ส่ง quote ลิงก์ | 100% auto (ถ้าข้อมูลครบ) |
| ตรวจ requirement ที่ไม่ครบ | 📋 CRM | ติดตามขอข้อมูลเพิ่ม | คิวอัตโนมัติ |
| อนุมัติใบเสนอราคา | 👤 ลูกค้า | กดผ่านลิงก์ quote | 100% self-service |
| ตรวจสลิป + match payment | 💰 การเงิน | ดูสลิป + ใส่ payment id | manual แต่มี slip queue auto |
| ออกใบกำกับภาษี/ใบเสร็จ | 💰 การเงิน | เลือกผู้รับเงิน + ออกเอกสาร | runtime document gen |
| ตรวจ prompt + สั่ง AI | 🎨 ออกแบบ | กด generate, retry | AI integration |
| คัด preview + ส่งลูกค้า | 🎨 ออกแบบ | เลือกภาพ + push ผ่าน LINE | auto LINE push |
| ตอบ feedback แบบ | 👤 ลูกค้า | ดูผ่าน status link + กด | 100% self-service |
| เปิดงานผลิต | 🏭 ผลิต | ยืนยันรายละเอียดผลิต | unlock อัตโนมัติเมื่อ gate ผ่านทุก gate |
| ผลิต + จัดส่ง | 🏭 ผลิต | อัปหลักฐาน + แจ้งลูกค้า | auto notification |

---

## 4. Gate สำคัญที่ระบบบังคับ

```mermaid
flowchart LR
    Q[Quote Approved] --> G1{Payment Gate}
    G1 -->|credit term| OK1[ผ่านทันที]
    G1 -->|deposit term| C1{มี deposit/full?}
    G1 -->|prepaid term| C2{จ่ายเต็มหรือยัง?}
    C1 -->|ใช่| OK1
    C1 -->|ไม่| W1[รอชำระ]
    C2 -->|ใช่| OK1
    C2 -->|ไม่| W1
    OK1 --> G2{Document Gate}
    G2 -->|เลือกผู้รับเงินแล้ว| OK2[เปิดงานได้]
    G2 -->|ยังไม่เลือก| W2[รอออกเอกสาร]
    OK2 --> G3{Design Gate}
    G3 -->|approved| PROD[เริ่มผลิต]
    G3 -->|รอแก้| W3[Preview loop]

    classDef ok fill:#dcfce7,stroke:#16a34a
    classDef wait fill:#fef3c7,stroke:#d97706
    class OK1,OK2,PROD ok
    class W1,W2,W3 wait
```

**สาระสำคัญ:** ลูกค้า approve quote แล้วไม่ได้แปลว่าเข้าผลิตทันที — ต้องผ่าน Payment + Document + Design Gate ครบทั้งหมด

---

## 5. รายได้เข้าระบบ — เมื่อไหร่บ้าง

| Trigger | จุดที่เกิดรายได้ | เอกสารที่ออก |
|---|---|---|
| ลูกค้า approve quote (credit) | บันทึก AR ทันที | quote → invoice |
| ลูกค้าโอน deposit | บันทึก partial payment | quote + ใบเสร็จมัดจำ |
| ลูกค้าโอนเต็ม (prepaid) | บันทึก full payment | quote + ใบเสร็จ/ใบกำกับภาษี |
| ปิดงาน | confirm รายได้ครบ | ใบกำกับภาษี/ใบเสร็จงวดสุดท้าย |

---

## 6. หน้า Admin หลัก (ทีมหลังบ้านใช้)

| URL | ใครใช้ | หน้าที่ |
|---|---|---|
| `/admin` | ทุกทีม | CRM inbox — ดูคิวงานทุกระดับ + filter ตาม owner |
| `/admin/manual-intake` | CRM | รับงาน walk-in / โทร / Facebook |
| `/admin/customers` | ทุกทีม | ดูประวัติลูกค้า + Customer 360 |
| `/admin/accounting` | การเงิน | ตรวจคิวรับชำระ + ออกเอกสาร + export CSV |
| `/admin/prompts` | ออกแบบ | จัดการ prompt + สั่ง AI + ส่ง preview |
| `/admin/follow-up` | CRM | ติดตามลูกค้าที่เงียบเกินกำหนด |
| `/admin/settings` | เจ้าของ | ตั้งค่า LINE/LIFF + business rules runtime |

---

## 7. หน้าลูกค้า (public, ไม่ต้อง login)

| URL | จุดใช้ | สถานะที่เปิดได้ |
|---|---|---|
| `/liff/intake` | กรอกฟอร์มขอ quote | จาก LINE OA |
| `/quote/[token]` | ดูใบเสนอราคา + approve/reject + อัปสลิป | quote ทุกสถานะ |
| `/status/[token]` | ดู preview + กดยอมรับ/ขอแก้ + ดูสถานะ | หลังเปิด job |

---

## 8. UX ที่ปรับปรุงล่าสุด (Today, 6 PRs)

| PR | สิ่งที่แก้ | ผลกระทบทางธุรกิจ |
|---|---|---|
| #81 | CRM inbox — Thai labels + table view + expandable row | ทีมหลังบ้านสแกนคิวงานได้เร็วขึ้น ~3 เท่า |
| #82 | Dropdown menu portal + quote link | ปุ่ม action ไม่ถูกตัดทิ้งบน row ล่างสุด |
| #83 | หน้า accounting cleanup | การเงิน focus เฉพาะคิวที่ต้องทำจริง |
| #84 | manual-intake / customers / customer 360 | ทุกหน้า admin ภาษาไทยล้วน |
| #85 | padding ใน card | UI ดูเป็นมาตรฐาน enterprise |
| #86 | หน้า ออกแบบ · AI rebuild | ทีมออกแบบไม่ต้องเข้าใจ event/seed/snapshot |

---

## 9. จุดที่ยังเป็น Manual (Risk / Opportunity)

🔴 **ต้องคนทำ ยังไม่ auto:**
- ตรวจสลิปโอน → match กับ payment (ออกแบบ AI/OCR ได้)
- เลือกผู้รับเงินก่อนออกเอกสาร (rules-based automation ได้)
- คัด preview ที่ดีที่สุดจาก AI (กำลังศึกษา quality scoring)
- ติดตามลูกค้าเงียบ (มี follow-up queue แต่ยังต้องคนกด)

🟡 **Auto บางส่วน:**
- AI สร้าง preview (auto generate แต่ admin เลือก/ส่ง)
- LINE notification (auto ยิงแต่ template ยัง hard-coded)

🟢 **Auto เต็มที่:**
- รับข้อความ + ตอบส่งลิงก์
- คำนวณราคา + สร้าง quote
- Workflow state transitions ตาม gate
- บันทึก audit log + event tracking

---

## 10. Tech Stack สรุป

```
Frontend  → Next.js 16.2 + React 19 + Tailwind v4 + shadcn/ui
Backend   → Next.js API routes + Supabase (Postgres + RLS)
LINE      → LINE Messaging API + LIFF v2.28
Hosting   → Vercel (auto deploy from main)
AI        → ตั้งค่าผ่าน /admin/settings/ai (provider-agnostic)
```

**Workflow state machine:** กำกับโดยไฟล์เดียว `docs/workflow-policy.json` — เปลี่ยน workflow ทั้งระบบจากจุดเดียว ทีมไม่ต้องอัปเดต code หลายที่
