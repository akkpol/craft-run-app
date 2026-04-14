# 🧾 Invoice & Billing Flow Patch (FOGUS)

## 🎯 Goal
เพิ่มระบบ Invoice + Billing Slip โดยไม่ทำให้ flow เดิมพัง

---

## ⚠️ ปัญหาปัจจุบัน

### 1. Flow ปัจจุบัน (เร็วแต่เสี่ยง)
```
quote → approve → create job
```

ปัญหา:
- ยังไม่ได้เงิน แต่เริ่มงานแล้ว
- ไม่มี tracking การชำระเงิน
- scale แล้ว chaos แน่นอน

---

### 2. ไม่มีเอกสารการเงินจริง
- ❌ ไม่มี invoice
- ❌ ไม่มี billing slip
- ❌ ไม่มี payment status

---

## ✅ แนวทางแก้ (Patch ไม่รื้อระบบ)

### Flow ใหม่
```
quote → approve → create invoice → paid → create job
```

---

## 🧩 สิ่งที่เพิ่มเข้าไป

### 1. Table
- invoices
- billing_slips

### 2. UI Pages
- /invoice/[token]
- /billing/[token]

### 3. API
- POST /api/quotes/[id]/issue-invoice

---

## 🔧 จุดที่ต้องแก้ (สำคัญมาก)

### ❌ เดิม
```
approve → create job
```

### ✅ ใหม่
```
approve → create invoice → STOP
```

แล้วไป create job ตอน:
```
payment_status = paid
```

---

## 🔁 Flow UI จริง

1. ลูกค้ากด approve quote
2. ระบบสร้าง invoice
3. LINE push invoice link
4. ลูกค้าเปิด /invoice/[token]
5. ลูกค้าชำระเงิน (หรือกด confirm)
6. ระบบ create job
7. push status → LINE

---

## 💣 จุดเสี่ยงที่ต้องกัน

### 1. ห้ามสร้าง job ก่อนจ่ายเงิน

### 2. ต้องมี payment_status
- unpaid
- paid

### 3. ต้องใช้ token-based page
- ไม่ต้อง login
- ใช้ link จาก LINE

---

## 🚀 Phase Plan

### Phase 1
- เพิ่ม invoice
- เปลี่ยน approve flow

### Phase 2
- payment confirm
- auto create job

### Phase 3
- billing reminder (LINE)

---

## 🧠 Insight

ระบบนี้ = Document-driven workflow

- Quote = trigger
- Invoice = trigger
- Job = state

---

## ✅ ผลลัพธ์

- ไม่ต้อง rewrite
- เพิ่ม layer การเงิน
- พร้อม scale เป็น SaaS

---

(ready for production patch)