# Sales Job Full Flow — End-to-End Walkthrough

เอกสารนี้ไล่ flow ทั้งหมดของ "งานขาย 1 งาน" ในระบบ FOGUS ตั้งแต่ลูกค้าเข้า LINE จนงานเสร็จ พร้อมระบุ:

- 🎬 **Actor & Trigger** — ใครทำอะไร ทำที่ไหน
- ⚙️ **System** — ระบบทำอะไรในเบื้องหลัง (route, table, helper)
- ✓ **Gate / Check** — กฎที่ระบบใช้บล็อกความผิดพลาด
- 🔄 **State** — conversation.state / quote.status / job.status / commercial_orders
- ❌ **Failure** — เกิดอะไรถ้าตก gate

**Canonical sources** (priority order):
1. `docs/workflow-policy.json` — workflow contract
2. `src/lib/workflow-policy-core.mjs` — runtime helpers
3. `src/lib/quote-workflow.ts` — approval + payment gate
4. `src/lib/commercial-document-issue.ts` — document plan validation
5. `docs/COMMERCIAL_DOCUMENT_BUSINESS_FLOW_V1_FREEZE.md` — locked business rules

---

## Phase 1 — First contact (LINE → conversation)

### Step 1.1 — ลูกค้าส่งข้อความเข้า LINE OA ครั้งแรก

| | |
|---|---|
| 🎬 | ลูกค้าพิมพ์ข้อความใน LINE OA (เช่น "สนใจป้าย") |
| ⚙️ | `POST /api/webhook` รับ LINE event → verify signature → `processWebhookEvent()` |
| ⚙️ | สร้าง `conversations` row (line_user_id, state=`NEW_MESSAGE`) ถ้ายังไม่มี |
| ⚙️ | สร้าง `customers` row (display_name, line_user_id) ถ้ายังไม่มี |
| ⚙️ | บันทึก `messages` row (inbound) |
| ⚙️ | Bot reply ด้วย LIFF link (`<base_url>/liff`) |
| ✓ | LINE signature verify ด้วย `LINE_CHANNEL_SECRET` — ผ่านถึงทำต่อ |
| ✓ | ถ้า conversation อยู่ใน `COMPLETED`/`CANCELLED` → **สร้าง row ใหม่** (ห้าม reuse) |
| 🔄 | state: `none` → **`NEW_MESSAGE`** → **`COLLECTING_REQUIREMENTS`** (หลัง reply) |
| ❌ | ถ้า signature ผิด → 401, ไม่ทำอะไรกับ DB |

### Step 1.2 — ลูกค้าใช้คำ escalation

| | |
|---|---|
| 🎬 | ลูกค้าพิมพ์ `คุยกับแอดมิน` / `ขอคุยกับคน` / `admin` |
| ⚙️ | webhook detect keyword → `escalations` row + state transition |
| 🔄 | active state ใด → **`HUMAN_REVIEW_REQUIRED`** |
| 🎬 | Admin resolve ใน `/admin` → state → **`IN_DESIGN`** |

---

### Step 1.3 — Walk-in / โทร / Facebook (offline customer)

| | |
|---|---|
| 🎬 | ลูกค้าไม่ผ่าน LINE → admin กรอกแทน |
| ⚙️ | `/admin/manual-intake` → `POST /api/admin/manual-intake` |
| ⚙️ | สร้าง customer + lead + quote (เหมือน Phase 2 แต่ admin actor) |
| 🔄 | จุดเริ่ม alternate ของ Phase 2 |

---

## Phase 2 — Intake (LIFF form → lead + quote)

### Step 2.1 — ลูกค้าเปิด LIFF form กรอกรายละเอียด

| | |
|---|---|
| 🎬 | ลูกค้ากด LIFF link → `liff.init()` → redirect `/liff/intake` |
| 🎬 | LIFF จับ user profile + access token via `liff.getIDToken()` |
| 🎬 | ลูกค้ากรอก: product type, dimensions, qty, due date, billing fields, fulfillment mode, design brief, note |
| ⚙️ | Returning customer prefill: `/api/customers/prefill` คืน phone + ค่า default จาก lead เก่า |
| ⚙️ | Product picker อ่านจาก `/api/intake/product-catalog` (runtime catalog → fallback default) |
| ✓ | Client validation: dimensions, qty, requested document type, billing fields ถ้าขอ tax invoice |
| ⚙️ | submit → `POST /api/intake` |

### Step 2.1.1 — ลูกค้า upload artwork file

| | |
|---|---|
| 🎬 | ลูกค้ามีไฟล์ design เอง (logo, รูป, PDF) → upload ผ่าน LIFF intake |
| ⚙️ | files → Supabase bucket `customer-media` (private) → `lead_media_assets` rows (lead_id, storage_path, mime_type, file_size) |
| ⚙️ | Schema: `mig 014_customer_media_assets.sql` — รองรับ png/jpeg/webp/heic/pdf ≤ 10 MB |
| ⚠️ | ทางเลือก: ใส่ external link (Drive/Dropbox) ใน `customer_upload_url` setting แทน |

---

### Step 2.2 — ระบบประมวล intake

| | |
|---|---|
| ⚙️ | `/api/intake` verify LIFF id token (ถ้าไม่ใช่ devNoLiff) |
| ⚙️ | upsert `customers` (line_user_id, phone, display_name) |
| ⚙️ | สร้าง `leads` row (product snapshot, dimensions, ai_image_prompt, billing fields, requested_document_type) |
| ⚙️ | คำนวณราคา → `calculatePrice(productType, w, h, qty)` จาก `product_catalog_items.per_sqm + min_charge` |
| ⚙️ | สร้าง `quotes` row (subtotal, discount=0, vat=0/auto, total, status=`sent`, payment_terms, payment_status=`unpaid`, public_token) |
| ⚙️ | log: `liff.intake_issue`, `lead.created`, `quote.created`, `quote.sent` |
| ⚙️ | LINE push: quote link `<base_url>/quote/<public_token>` |
| ✓ | ถ้า incomplete (เช่น ไม่มี dimensions) → state=`ON_HOLD_CUSTOMER_INPUT`, ไม่สร้าง quote |
| ✓ | ถ้า requested tax_invoice แต่ billing fields ขาด → return 422 validation error |
| 🔄 | state: `COLLECTING_REQUIREMENTS` → `REQUIREMENTS_REVIEW` → **`WAITING_QUOTE_APPROVAL`** (auto-quote) หรือ **`ON_HOLD_CUSTOMER_INPUT`** (missing data) |
| ❌ | ถ้า DB write fail → return 500, ไม่ส่ง LINE push |
| ⚠️ **Limitation** | intake สร้าง `quote_items` แค่ **1 row ต่อ submit** — งานหลายรายการในใบเดียว (เช่น "ไวนิล 2 ขนาด + สติกเกอร์") ต้องสร้าง lead แยก หรือใช้ `/admin/manual-intake` |
| ⚠️ **Limitation** | `quotes.discount` column มีแต่ intake set = `0` เสมอ — ไม่มี UI ให้ลูกค้า/admin ใส่ส่วนลด |
| ⚠️ **Missing** | **Rush fee / priority surcharge** — ลูกค้าด่วนยังต้องคิดราคาเอง |

---

## Phase 3 — Quote review (customer)

### Step 3.1 — ลูกค้าเปิดดู quote

| | |
|---|---|
| 🎬 | ลูกค้ากด link จาก LINE → `/quote/<token>` (ไม่ต้อง login) |
| ⚙️ | `/api/quotes/public/<token>` คืนรายละเอียด quote + product label + business identity + status timeline |
| ⚙️ | ลูกค้าเห็น 3 ทางเลือก: **อนุมัติใบเสนอราคา / ขอปรับรายละเอียด / ปฏิเสธ** |

### Step 3.2 — ลูกค้าอนุมัติ

| | |
|---|---|
| 🎬 | กด **อนุมัติใบเสนอราคา** → modal ยืนยัน → กด **ยืนยันอนุมัติ** |
| ⚙️ | `POST /api/quotes/<id>/approve` (public token) |
| ⚙️ | `approveQuote()` → คำนวณ next state จาก payment term + payment status |
| ⚙️ | log: `quote.approved` |
| ✓ | ถ้า quote status ไม่ใช่ `sent`/`approved` → return 409 |
| ✓ | `paymentUnlocksProduction(paymentTerms, paymentStatus)`: |
|   | – `credit` → unlocked ทันที |
|   | – `deposit` → ถ้า `payment_status ∈ {partial, paid}` → unlocked |
|   | – `prepaid` → ถ้า `payment_status = paid` → unlocked |
| 🔄 | quote.status: `sent` → `approved` |
| 🔄 | conversation.state: → **`WAITING_PAYMENT`** (ถ้ายังไม่จ่าย) หรือ **`IN_DESIGN`** (ถ้า unlock แล้ว เช่น credit) |
| ❌ | ถ้า token หมดอายุ/ไม่ valid → 404 |

### Step 3.3 — ลูกค้าขอปรับ / ปฏิเสธ

| | |
|---|---|
| 🎬 | กด **ขอปรับรายละเอียด** → ระบุเหตุผล → ส่ง |
| ⚙️ | quote.status → `rescope_requested` หรือ `rejected` |
| 🔄 | conversation.state → `COLLECTING_REQUIREMENTS` (ขอปรับ) หรือ `CANCELLED` (ปฏิเสธ) |

---

## Phase 4 — Payment ops (admin + customer)

### Step 4.1 — Admin select receiver entity

| | |
|---|---|
| 🎬 | Admin login → `/admin` → quote ในแถว Commercial Gate → คลิก "เลือกผู้รับเงิน" |
| ⚙️ | sheet เปิดแสดง 3 entities (MAIN_COMPANY VAT, SUB_COMPANY, PERSONAL_ACCOUNT) |
| ⚙️ | Admin เลือก → `POST /api/commercial/select-receiver` |
| ⚙️ | สร้าง/อัปเดต `commercial_orders` row (quote_id, selected_receiver_entity_id) |
| ⚙️ | ถ้า `requested_document_type=tax_invoice` + ยังไม่มี `customer_tax_profile_id` + lead มี billing_name+billing_address → auto-create `customer_tax_profiles` row + link |
| ✓ | ถ้า customer ขอ tax_invoice แต่ receiver ไม่ใช่ VAT-registered → warning ใน UI (block ต่อ) |
| ✓ | ถ้า receiver inactive → `RECEIVER_ENTITY_INACTIVE` |
| 🔄 | order.selected_receiver_entity_id: null → entity_id |

### Step 4.2 — Admin บันทึกการรับเงิน

**สำหรับ prepaid (จ่ายเต็ม):**

| | |
|---|---|
| 🎬 | Admin → "ดูแล quote" → "บันทึกรับชำระเต็ม" → ระบุ idempotency key (auto) → ยืนยัน |
| ⚙️ | `POST /api/quotes/<id>/commercial` body: `{paymentStatus: "paid", paymentIdempotencyKey, paymentAmount?}` |
| ⚙️ | normalize `paymentAmount` = `quote.total` ถ้าไม่ระบุ |
| ⚙️ | validate amount (ต้อง > 0) |
| ⚙️ | RPC `confirm_commercial_payment(quote_id, amount, idempotency_key, paid_at)` |
| ⚙️ | (ภายใน RPC, SECURITY DEFINER, service_role only):<br>1. advisory lock by idempotency hash<br>2. `select ... for update` ของ commercial_orders<br>3. validate receiver selected + entity active<br>4. ถ้ามี payment row ที่ idempotency key เดิม → reuse + lock<br>5. ถ้าไม่มี → insert payments row + set `payment_receiver_locked_at` (immutable trigger คุม) |
| ⚙️ | update quote: payment_status='paid' |
| ⚙️ | ถ้า payment unlocks production → สร้าง `jobs` row (status='not_started') |
| ⚙️ | update conversation.state |
| ⚙️ | log: `commercial.payment_confirmed`, `quote.payment_updated` |
| ✓ | `PAYMENT_IDEMPOTENCY_KEY_REQUIRED` ถ้า key ว่าง |
| ✓ | `PAYMENT_AMOUNT_UNDERPAID` ถ้า amount ≤ 0 |
| ✓ | `RECEIVER_REQUIRED_BEFORE_PAYMENT` ถ้า order ยังไม่เลือก receiver |
| ✓ | `PAYMENT_RECEIVER_LOCKED` (trigger) ถ้าพยายาม unset lock |
| ✓ | `PAYMENT_IDEMPOTENCY_CONFLICT` ถ้า key ซ้ำกับ payment ที่ต่างออร์เดอร์/amount/receiver |
| 🔄 | quote.payment_status: 'unpaid' → 'paid' |
| 🔄 | order.payment_receiver_locked_at: null → now() |
| 🔄 | conversation.state: `WAITING_PAYMENT` → **`IN_DESIGN`** |
| 🔄 | jobs row: created (status='not_started') |
| ❌ | ถ้า RPC fail → return 4xx/500 ด้วย error code mapped |

**สำหรับ deposit (มัดจำ):**

| | |
|---|---|
| 🎬 | Admin → "บันทึกรับมัดจำ" → ระบุยอด → idempotency key → ยืนยัน |
| ⚙️ | body: `{paymentStatus: "partial", paymentAmount: <deposit>, paymentIdempotencyKey}` |
| ⚙️ | RPC + state transition เหมือนเดิม (deposit + partial = unlock production) |
| ✓ | `paymentAmount` ต้องระบุ explicit สำหรับ partial |
| 🔄 | quote.payment_status: 'unpaid' → 'partial' |
| 🔄 | conversation.state → **`IN_DESIGN`** (deposit + partial = unlocks per workflow) |
| ⚠️ | **v1 freeze: document ออกไม่ได้จนกว่าจะจ่ายเต็ม** (จะ paid status ก่อนถึงออก doc ได้) |

---

### Step 4.3 — Balance payment (มัดจำ → ส่วนที่เหลือ)

| | |
|---|---|
| 🎬 | ลูกค้าจ่ายมัดจำไปแล้ว → งานเสร็จ → ตอนรับมาจ่ายส่วนที่เหลือ |
| ⚙️ | RPC `confirm_commercial_payment` รองรับ idempotency key ใหม่ → insert payment row ที่ 2 ได้ |
| ✓ | Receiver lock ถูก enforce ตั้งแต่ payment 1 → payment 2 ต้องไป entity เดียวกัน |
| ⚠️ **Manual today** | **ไม่มี UI flow ชัดเจน** สำหรับ "จ่ายส่วนที่เหลือ" — admin ต้องคำนวณ outstanding เอง + ใส่ paymentAmount ตรงๆ |
| ⚠️ **Missing** | `outstanding_balance` field / indicator บน admin queue |

### Step 4.4 — สลิปโอนเงิน (Payment proof)

| | |
|---|---|
| 🎬 | ลูกค้าโอนเงิน → ถ่ายรูปสลิป → ส่งให้ admin |
| ⚠️ **Manual today** | ลูกค้าส่งสลิปใน **LINE chat** → admin screenshot/save → match กับ payment ที่จะ confirm — **ไม่มี automated upload + verify** |
| ⚠️ **Missing** | `payment_slips` table, `/quote/<token>/pay/upload-slip` route, admin review queue ที่ match slip ↔ payment |
| ⚠️ **Missing** | Bank statement reconciliation (auto match deposit amount ↔ slip + payment row) |

---

## Phase 5 — Commercial document

### Step 5.1 — Admin ออกเอกสาร (RECEIPT หรือ TAX_INVOICE_RECEIPT)

| | |
|---|---|
| 🎬 | Admin → quote ในแถว Commercial Gate → "ดูแล quote" → "ออกเอกสารหลังรับชำระ" → "ออกเอกสารตอนนี้" |
| ⚙️ | `POST /api/commercial/documents/issue` body: `{paymentId}` |
| ⚙️ | resolve `payments` row → `commercial_orders` → `quotes` → `leads` → `commercial_entities` (receiver) → `customer_tax_profiles` (ถ้ามี) |
| ⚙️ | `buildCommercialDocumentIssuePlan()` กำหนด: <br>– `documentType`: RECEIPT (ถ้า receiver ไม่ใช่ VAT หรือ customer ไม่ขอ tax_invoice) / TAX_INVOICE_RECEIPT (ถ้า VAT + ขอ tax_invoice + มี tax profile)<br>– `vatMode`: EXCLUSIVE หรือ NO_VAT<br>– `subtotal`, `vatAmount`, `grandTotal` จาก quote totals (frozen snapshot) |
| ⚙️ | `allocate_commercial_document_number(entity_id, doc_type, year, prefix)` RPC คืน `document_number` (เช่น `RE-2026-00002`, `TAXRE-2026-00001`) ที่ unique per entity+type+year |
| ⚙️ | resolve `document_appendix`: ลอง `leads.ai_generated_images[0]` ก่อน → ไม่มี fallback `app_settings.document_appendix_image_url` → ไม่มี return null |
| ⚙️ | insert `commercial_documents` row (status='ISSUED', snapshot_json=immutable) |
| ⚙️ | LINE push: customer ได้ link เปิดดูเอกสาร `<base_url>/quote/<token>/documents/<id>` |
| ⚙️ | log: `commercial.document_number_generated`, `commercial.document_issued`, `commercial.document_sent` |
| ✓ | `PAYMENT_NOT_CONFIRMED` ถ้า payment.status != 'CONFIRMED' |
| ✓ | `PAYMENT_RECEIVER_NOT_LOCKED` ถ้า order.payment_receiver_locked_at = null |
| ✓ | `DOCUMENT_ISSUER_MISMATCH` ถ้า payment.receiver_entity_id != order.selected_receiver_entity_id |
| ✓ | `CUSTOMER_TAX_PROFILE_REQUIRED` ถ้าจะออก TAX_INVOICE_RECEIPT แต่ไม่มี tax profile |
| ✓ | `DOCUMENT_ALREADY_ISSUED` ถ้า payment_id นี้ออกเอกสารแล้ว |
| ✓ | `RECEIVER_ENTITY_INACTIVE` ถ้า entity ถูก deactivate |
| ✓ | Document number conflict (unique constraint) → retry ผ่าน allocator |
| ✓ | Issued document immutability trigger (`prevent_issued_commercial_document_core_update`) |
| 🔄 | commercial_documents row created with status='ISSUED' |
| ⚠️ | **immutable**: row นี้แก้ไขไม่ได้แล้ว — ต้องใช้ VOID/CREDIT_NOTE (out of v1 scope) |
| ⚠️ **Missing** | **Withholding tax (หัก ณ ที่จ่าย)** — B2B ลูกค้าหักภาษี 3% → จ่ายน้อยกว่า quote → ระบบยังไม่รองรับ field `wht_amount`, certificate (50 ทวิ), หรือ doc snapshot ที่แสดง WHT |

### Step 5.2 — ลูกค้าดาวน์โหลด PDF

| | |
|---|---|
| 🎬 | กด link → `/status/<token>/documents/<id>` → preview HTML |
| 🎬 | กด "ดาวน์โหลด PDF" → `/commercial/documents/<id>/download` |
| ⚙️ | render จาก `snapshot_json` (locked, ไม่ใช่ live data) |
| ⚙️ | page 1: header (issuer entity), customer info, line items, totals, signature |
| ⚙️ | page 2: ถ้ามี `document_appendix.image_url` → render design preview ของ order นั้น |

---

## Phase 6 — Design / AI preview

### Step 6.1 — Admin ทำ design

| | |
|---|---|
| 🎬 | Admin → `/admin/prompts` (Prompt Workbench) |
| ⚙️ | แสดง lead ใน 3 lanes: Prompt Ops / Preview Loop / Need Context |
| 🎬 | ตรวจ/แก้ AI prompt → กด "สร้างภาพตัวอย่าง" |
| ⚙️ | `POST /api/leads/<id>/ai-preview` → ai_image_status='pending' |
| ⚙️ | call AI provider (OpenAI / Google AI Studio) → upload to R2 (or Supabase fallback) |
| ⚙️ | leads.ai_generated_images = [url, ...]; ai_image_status='generated'; design_status='drafting' |
| ⚙️ | log: `lead.ai_preview_generated` |
| ❌ | ถ้า AI fail → ai_image_status='failed', ai_image_error set |
| 🎬 | **AI fail escape hatch**: Admin → "อัปโหลด design เอง" → upload image |
| ⚙️ | `POST /api/leads/<id>/manual-design` (multipart file) → set ai_generated_images=[url], ai_image_status='generated' |

### Step 6.2 — ส่ง preview ให้ลูกค้า

| | |
|---|---|
| 🎬 | Admin → "ส่ง preview ให้ลูกค้า" |
| ⚙️ | `POST /api/leads/<id>/send-preview` → LINE push พร้อมรูป + link `/status/<token>` |
| ⚙️ | design_status='preview_sent' |
| ⚙️ | log: `lead.design_preview_sent` |

### Step 6.3 — ลูกค้า feedback

| | |
|---|---|
| 🎬 | ลูกค้าเปิด `/status/<token>` → "อนุมัติแบบ" หรือ "ขอแก้ไข" |
| ⚙️ | ถ้าอนุมัติ → design_status='approved' |
| ⚙️ | ถ้าขอแก้ → design_status='revision_requested' + กลับไป loop ใหม่ |
| ⚠️ **Limitation** | ไม่มี **version tracking** ของ design preview — แต่ละรอบ revision จะ overwrite `ai_generated_images` (ไม่เก็บ history) |
| ⚠️ **Limitation** | ลูกค้ากรอกคำขอแก้ในข้อความเป็น free-text เท่านั้น — ไม่มี markup tool / annotated comment บนรูป |

---

## Phase 7 — Production

### Step 7.1 — เริ่มผลิต

| | |
|---|---|
| 🎬 | Admin → "ขยับงานออกแบบ" → ตรวจว่า design_status='approved' + payment confirmed |
| ⚙️ | `POST /api/jobs/<id>/status` body: `{nextStatus: "IN_PRODUCTION"}` |
| ✓ | validate transition ผ่าน `ALLOWED_JOB_TRANSITIONS` |
| 🔄 | jobs.status: 'not_started' → **'IN_PRODUCTION'** |
| 🔄 | conversation.state: `IN_DESIGN` → `IN_PRODUCTION` |

### Step 7.2 — ทีมผลิตอัปโหลดรูปงานเสร็จ

| | |
|---|---|
| 🎬 | ทีมผลิตเปิด `/production/<token>` (mobile) → ถ่ายรูป → upload |
| ⚙️ | `POST /api/production/<token>/events` → สร้าง `job_media_events` + `job_media_assets` (Supabase storage bucket `job-media`) |
| 🎬 | Admin → `/admin` → "อนุมัติรูป" หรือ "ปฏิเสธ" |
| ⚙️ | `POST /api/admin/production-events/<id>/approve` → mark approved |
| ⚙️ | ถ้า admin กด "ส่งให้ลูกค้า" → `POST .../send` → LINE push พร้อมรูป |

### Step 7.3 — จบการผลิต

| | |
|---|---|
| 🎬 | Admin → "เช็กพร้อมเปิดงาน" หรือ "จบผลิต" |
| ⚙️ | jobs.production_status='done', jobs.status='READY_FOR_FULFILLMENT' |
| 🔄 | conversation.state: `IN_PRODUCTION` → **`READY_FOR_FULFILLMENT`** |

---

## Phase 8 — Fulfillment

### Step 8.1 — Pickup / delivery / install

| | |
|---|---|
| 🎬 | Admin → mark fulfillment ตาม mode: |
|   | – `pickup`: ลูกค้ามารับ → admin confirm |
|   | – `delivery`: ทีมส่ง / 3rd party |
|   | – `install`: ทีมไปติดตั้งหน้างาน |
| ⚙️ | jobs.fulfillment_status='delivered' |
| ⚙️ | LINE push: ขอบคุณ + completion package |
| 🔄 | jobs.status: → **`COMPLETED`**, completion_package_status='sent' |
| 🔄 | conversation.state: `READY_FOR_FULFILLMENT` → **`COMPLETED`** |
| 🔄 | leads.status='completed' |
| ✅ **delivery (closed via PR #68)** | `jobs.delivery_provider/tracking_url/tracking_number/dispatched_at/notes` + `/admin/jobs/[id]/delivery` + customer status link |
| ✅ **install (closed via PR #67)** | `installations` table + scheduling form + `/install/[token]` mobile page + photo proof upload + admin gallery |
| ✅ **pickup (closed via PR #74)** | `jobs.pickup_proof_paths/picked_up_at/pickup_recipient_name/_phone` + `record_pickup_proof` RPC + `/admin/jobs/[id]/pickup` + auto-flip `fulfillment_status='picked_up'` (signature canvas still Wave 5) |

---

## Phase 9 — Closure & accounting

### Step 9.1 — ข้อมูล record

ทุก row immutable:
- `quotes` — quote.public_token ยังเข้าได้ (audit)
- `commercial_documents` — snapshot_json frozen, ใช้สำหรับ accounting export
- `payments` — receiver_entity_id locked, idempotency_key เก็บ
- `jobs` — production timeline + media assets
- `leads` — completed snapshot
- `conversations` — state=COMPLETED, **ห้าม reuse สำหรับ intake ใหม่**

### Step 9.2 — Accounting export

| | |
|---|---|
| 🎬 | Finance → `/admin/accounting` |
| ⚙️ | filter ตาม period → render export-ready table จาก `commercial_documents` + `payments` |
| ⚙️ | (Wave 5 backlog: export CSV/Excel) |

---

## Side branches

### A. Customer หายไป (ON_HOLD_CUSTOMER_INPUT)

ทุก state ที่ active สามารถ branch ไป `ON_HOLD_CUSTOMER_INPUT` ได้:
- Admin ตั้งใจ pause: `/admin` → "เก็บข้อมูลเพิ่ม"
- Intake incomplete (auto)
- Customer reply ใหม่ → กลับเข้า `COLLECTING_REQUIREMENTS`

### B. Escalation (HUMAN_REVIEW_REQUIRED)

- Customer keyword (`คุยกับแอดมิน` ฯลฯ)
- Admin escalate: `/admin` → "รอทีมงานตรวจสอบ"
- Resolve: admin → "ปลดล็อกงานนี้" → `IN_DESIGN`

### C. Cancel

- Customer ปฏิเสธ quote
- Admin → "ยกเลิก"
- conversation.state = `CANCELLED`, **ห้าม reuse**

---

## Health checks สำหรับ E2E test

ทุก step ที่ผ่านควรเช็คใน Supabase:

| Phase | Table | Field |
|---|---|---|
| 1 | conversations | state, customer_id, line_user_id |
| 2 | leads, quotes | requested_document_type, public_token, totals |
| 3 | quotes | status='approved' |
| 4 | commercial_orders, payments | selected_receiver_entity_id, payment_receiver_locked_at, idempotency_key |
| 5 | commercial_documents | status='ISSUED', document_number, snapshot_json |
| 6 | leads | ai_image_status='generated', ai_generated_images, design_status |
| 7 | jobs, job_media_events | status, production_status |
| 8 | jobs, conversations | status='COMPLETED', state='COMPLETED' |
| 9 | (immutable) | snapshot integrity |

---

## Workflow state cheat sheet

```
NEW_MESSAGE
  ↓ (customer LINE message + bot reply)
COLLECTING_REQUIREMENTS
  ↓ (LIFF intake submit)
REQUIREMENTS_REVIEW
  ↓ (auto-quote ok)         ↓ (incomplete)
WAITING_QUOTE_APPROVAL      ON_HOLD_CUSTOMER_INPUT
  ↓ (customer approve)
WAITING_PAYMENT  ────────→  IN_DESIGN  (credit/already-paid)
  ↓ (admin confirm payment + receiver locked)
IN_DESIGN
  ↓ (admin start production after design approved + doc issued)
IN_PRODUCTION
  ↓ (production done)
READY_FOR_FULFILLMENT
  ↓ (handed off)
COMPLETED  ✓
```

Side: `ON_HOLD_CUSTOMER_INPUT`, `HUMAN_REVIEW_REQUIRED`, `CANCELLED`

---

## 🔥 Reality check: ระบบ "รันเองได้" ระดับไหน?

ทดสอบกับ flow จริงของร้านป้ายไทย:

| Scenario | Automated % | Manual bottleneck |
|---|---|---|
| **Prepaid + walk-in + รับเอง + ไม่ใช่ B2B** | ≥ 90% | (ลูกค้าอัปโหลดสลิปได้แล้ว — admin verify ใน queue) |
| **Prepaid + LIFF + delivery (Lalamove)** | ≥ 85% | admin จองส่งบน Lalamove dashboard เอง แล้ววางลิงก์ tracking |
| **Deposit + บริษัท B2B + ติดตั้ง + ใบกำกับ + WHT** | ≥ 80% | install team upload รูปหน้างาน + admin review |

**สรุป:** flow ทั้งหมดเปลี่ยนจาก LINE-chat-driven → web/queue-driven ครบแล้ว

### P0 gaps — ปิดครบทั้ง 7 ตัว ✅

| Gap | ที่ปิด | PR |
|---|---|---|
| Bank slip upload + verify | `payment_slips` table + customer uploader + admin match/reject queue | #62 |
| Balance payment UI flow | `getQuoteOutstandingBalance` + balance panel + RPC cumulative guard | #64 |
| Withholding tax (50ทวิ) | `quotes.wht_rate` + `payments.wht_amount` + RPC `p_wht_amount` + UI fields | #65 |
| Multi-line item per submit | Admin-side `quote_items` CRUD + race-safe DELETE + totals recompute | #66 |
| Install scheduling + proof | `installations` + public token mobile page + photo append RPC | #67 |
| Lalamove/Grab booking link | `jobs.delivery_*` columns + admin form + customer status card | #68 |
| Reorder / clone quote | `POST /api/admin/quotes/[id]/clone` + cleanup-on-fail + draft guard | #69 |

### P1/P2 backlog (deferred)

| Item | Source |
|---|---|
| Pickup proof — signature canvas / e-sign (photo + recipient name closed via PR #74) | PR #74 deferred |
| OCR for bank slips | PR #62 deferred |
| Bank statement auto-reconciliation | PR #62 deferred |
| 50ทวิ certificate generation — admin print page closed via PR #76; **persisted cert number / RD-format PDF** still Wave 5 | PR #65 deferred |
| Auto-suggest WHT rate based on receiver VAT | PR #65 deferred |
| Per-item discount / unit (sqm vs piece) | PR #66 deferred |
| Auto-transition jobs.fulfillment_status when installation done | PR #67 deferred |
| Customer signature canvas in install page | PR #67 deferred |
| Lalamove/Grab API integration (book + status polling) | PR #68 deferred |
| Clone with overrides (qty / dimensions) | PR #69 deferred |
| LIFF intake repeater UI (multi-item at submit) | PR #66 deferred |
| Commercial entities admin editor page | TASK-025 |
| Accounting CSV (quote-centric) + tax-ledger CSV (document-centric for ภ.พ.30 / ภ.ง.ด.53) — closed via PR #78; **direct Excel xlsx + ERP push** still Wave 5 | TASK-027 |
| First-class staff ownership model | TASK-025 |

---

## ⚠️ Known scope/gaps (v1)

| ID | Gap | สถานะ |
|---|---|---|
| v1 freeze | document ออกแค่ RECEIPT / TAX_INVOICE_RECEIPT | locked |
| v1 freeze | BILLING_NOTE, INVOICE, standalone TAX_INVOICE | follow-up packet |
| v1 freeze | VOID, CREDIT_NOTE, DEBIT_NOTE | follow-up packet |
| C3 | deposit document issuance | **blocked จนกว่า v2 packet จะ teach issue flow ให้ใช้ payment amount + Thai partial tax invoice rule** |
| TASK-025 | first-class staff ownership model | Wave 5 |
| TASK-027 | accounting export format | Wave 5 |
| TASK-033 | R2 media storage rollout | Wave 5 |
| TASK-036 | richer fulfillment model (3rd-party shipment + on-site install) | Wave 5 |

---

## Tools ที่ใช้ตรวจสอบ E2E (verified working)

| Tool | บทบาท |
|---|---|
| Supabase MCP | `execute_sql` ดู state, `apply_migration` แก้ schema |
| Vercel MCP | `list_deployments`, `get_runtime_logs` |
| Chrome MCP | drive admin/customer UI บน production URL |
| Scenario runner (`npm run check:release`) | in-memory 19 tests รวม full lifecycle 2 ตัว (receipt + tax invoice) |
