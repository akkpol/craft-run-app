---
title: Supabase Migration History Drift Runbook
version: 1.0
date: 2026-04-27
owner: Delivery Engineering
status: Active
plan_ref: plan/2026-04-27-supabase-migration-history-repair-plan.md
---

# Supabase Migration History Drift Runbook

เอกสารนี้ใช้ตอน remote migration history ของ Supabase ไม่ตรงกับไฟล์ใน repo แต่ schema จริงของฐานข้อมูลมี object และ column ครบแล้ว

## 1. Current Finding

- ตรวจเมื่อ 2026-04-27 กับ hosted project ที่ใช้งานอยู่
- hosted schema มีการเปลี่ยนแปลงที่คาดจาก local migration ชุดที่สงสัยครบแล้ว
- production ตอนนี้ไม่ได้ติด blocker เพราะ missing schema migration
- ปัญหาปัจจุบันคือ migration history drift ไม่ใช่ schema drift

## 2. What Was Verified

ยืนยัน schema จริงแล้วว่ามีครบ:

- `public.lead_media_assets.storage_provider`
- `public.lead_media_assets.storage_bucket`
- constraint `lead_media_assets_storage_provider_check`
- `public.leads.design_brief`
- `public.leads.requested_document_type`
- `public.leads.billing_entity_type`
- `public.leads.billing_name`
- `public.leads.tax_id`
- `public.leads.billing_address`
- `public.leads.liff_profile_snapshot`
- `public.leads.liff_context_snapshot`
- `public.leads.billing_branch_type`
- `public.leads.billing_branch_code`
- `public.leads.product_label_snapshot`
- `public.leads.product_category_snapshot`
- `public.leads.product_category_label_snapshot`
- `public.leads.ai_prompt_snapshot`
- `public.customers.line_email`
- `public.customers.line_picture_url`
- `public.customers.line_status_message`
- `public.customers.line_friendship_status`
- `public.customers.last_liff_profile`
- `public.customers.last_liff_context`
- `public.app_settings.payment_qr_code_url`
- `public.app_settings.payment_qr_code_label`
- `public.app_settings.payment_display_mode`
- `public.app_settings.payment_secondary_*`
- `public.quotes.payment_profile_snapshot`
- table `public.product_catalog_items`

## 3. Drift Snapshot

### Local Files Not Present In Remote History

- `20260426174619_lead_media_storage_provider_r2.sql`
- `20260426214819_add_design_brief_to_leads.sql`
- `20260426215524_add_payment_qr_and_display_mode.sql`
- `20260426221716_capture_liff_customer_context.sql`
- `20260427041916_repair_hosted_document_product_and_liff_gap.sql`
- `20260427043005_add_fulfillment_location_capture.sql`
- `20260427060747_add_ai_prompt_snapshot_to_leads.sql`
- `20260427213500_add_billing_branch_fields.sql`
- `20260427224500_create_product_catalog_runtime.sql`

### Remote History Entries Without Matching Local Version IDs

- `20260426183238_repair_production_upload_schema_gate`
- `20260427042022_repair_hosted_document_product_and_liff_gap`
- `20260427043406_add_fulfillment_location_capture`
- `20260427062532_add_ai_prompt_snapshot_to_leads`

## 4. Important Interpretation

- ห้ามสรุปจาก history mismatch อย่างเดียวว่า production ยังขาด migration
- จากการ query schema จริงครั้งนี้ remote มี schema ครบแล้ว
- exact mapping ว่า remote record ใดแทน local file ใดทั้งหมด ยังพิสูจน์ไม่ได้จาก schema เพียงอย่างเดียว
- สิ่งที่พิสูจน์ได้แล้วคือ replay local-only migration ทั้งชุดลง production ตอนนี้มีความเสี่ยงสูงจะชนกับ column, table, หรือ constraint ที่มีอยู่แล้ว

## 4.1 CI Supabase Preview Interpretation

- ถ้า GitHub/Supabase Preview ล้มด้วย `Remote migration versions not found in local migrations directory.` ให้จัดเป็น migration-history drift ตาม runbook นี้ ไม่ใช่ LINE, LIFF, webhook, หรือ runtime failure
- อย่า replay หรือ repair hosted migration history จาก failure นี้เพียงอย่างเดียว
- ให้ตัดสินว่าต้องแก้ schema ต่อเมื่อ schema verification พบ object หรือ column ที่ขาดจริง

## 5. Operator Rules

1. อย่า replay local-only migrations ลง hosted production ตรง ๆ เพียงเพราะ `migration list` ไม่ตรง
2. อย่า insert หรือแก้ migration history table บน production แบบ ad hoc
3. ให้ตรวจ schema จริงก่อนทุกครั้ง ถ้า object มีครบ ให้จัดเป็น history drift
4. ให้ทำ forward-only migration ใหม่เฉพาะเมื่อพบ object ที่ขาดจริงจาก schema verification เท่านั้น

## 6. Safe Verification Queries

ใช้ query ลักษณะนี้ก่อนตัดสินใจ apply migration เพิ่ม:

```sql
select table_name, column_name,
       exists (
         select 1
         from information_schema.columns c
         where c.table_schema = 'public'
           and c.table_name = e.table_name
           and c.column_name = e.column_name
       ) as present
from (
  values
    ('lead_media_assets', 'storage_provider'),
    ('lead_media_assets', 'storage_bucket'),
    ('leads', 'design_brief'),
    ('leads', 'ai_prompt_snapshot'),
    ('quotes', 'payment_profile_snapshot')
) as e(table_name, column_name);
```

```sql
select exists (
  select 1
  from information_schema.tables
  where table_schema = 'public'
    and table_name = 'product_catalog_items'
) as has_product_catalog_items;
```

## 7. Issue-Ready Summary

ใช้ข้อความนี้เปิด issue หรือใส่ใน handoff note ได้ทันที:

```md
## Supabase migration history drift

Hosted Supabase schema has already been verified to contain the columns, table, and constraint introduced by the local migration set that does not appear in remote migration history. The current problem is migration-history drift, not a missing production schema change.

### Impact
- Production is not blocked by missing schema at this time.
- Blindly replaying local-only migrations against hosted production is unsafe and may fail with duplicate column/table/constraint errors.

### Verified present in hosted schema
- `lead_media_assets.storage_provider`
- `lead_media_assets.storage_bucket`
- `lead_media_assets_storage_provider_check`
- `leads.design_brief`
- `leads.ai_prompt_snapshot`
- `quotes.payment_profile_snapshot`
- `product_catalog_items`
- payment, LIFF context, and billing snapshot fields

### Next step
Create a follow-up repair plan that treats hosted schema as the current operational truth, documents the version drift, and validates any future reconciliation strategy on a disposable environment before touching production migration history.
```

## 8. When To Escalate

Escalate before any repair attempt if:

- `supabase db push` or hosted migration tooling refuses to proceed because of the drift
- a future migration depends on exact history ordering rather than current schema state
- the team wants to mutate production migration history instead of documenting drift and moving forward with a validated baseline strategy
