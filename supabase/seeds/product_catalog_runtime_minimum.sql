insert into public.product_catalog_items (
  value,
  label,
  category,
  category_label,
  description,
  keywords,
  per_sqm,
  min_charge,
  active,
  sort_order
)
values
  (
    'vinyl_banner',
    'ป้ายไวนิล',
    'signage',
    'ป้ายและหน้าร้าน',
    'เหมาะกับป้ายโปรโมชัน ป้ายหน้าร้าน และงานด่วน',
    array['ไวนิล', 'แบนเนอร์', 'banner'],
    250,
    500,
    true,
    10
  ),
  (
    'acrylic_sign',
    'ป้ายอะคริลิค',
    'signage',
    'ป้ายและหน้าร้าน',
    'งานป้ายพรีเมียม ตัวอักษร โลโก้ หรือป้ายบริษัท',
    array['อะคริลิค', 'โลโก้', 'acrylic'],
    3500,
    1500,
    true,
    20
  ),
  (
    'sticker',
    'สติ๊กเกอร์',
    'label',
    'สติ๊กเกอร์และฉลาก',
    'ฉลากสินค้า สติ๊กเกอร์ติดแพ็กเกจ และงานไดคัท',
    array['สติ๊กเกอร์', 'label', 'sticker'],
    350,
    300,
    true,
    30
  )
on conflict (value)
do update set
  label = excluded.label,
  category = excluded.category,
  category_label = excluded.category_label,
  description = excluded.description,
  keywords = excluded.keywords,
  per_sqm = excluded.per_sqm,
  min_charge = excluded.min_charge,
  active = excluded.active,
  sort_order = excluded.sort_order,
  updated_at = now();