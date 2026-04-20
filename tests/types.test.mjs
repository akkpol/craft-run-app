import test from 'node:test'
import assert from 'node:assert/strict'

// Test pure utility functions from types.ts
// Note: Some functions depend on locale which has import issues in Node.js ESM,
// so we'll test them via dynamic imports

test('UNITS constant has correct conversion factors', async () => {
  const { UNITS } = await import('../src/lib/types.ts')

  const mmUnit = UNITS.find(u => u.value === 'mm')
  const cmUnit = UNITS.find(u => u.value === 'cm')
  const mUnit = UNITS.find(u => u.value === 'm')
  const inchUnit = UNITS.find(u => u.value === 'inch')
  const ftUnit = UNITS.find(u => u.value === 'ft')

  assert.equal(mmUnit?.factor, 1)
  assert.equal(cmUnit?.factor, 10)
  assert.equal(mUnit?.factor, 1000)
  assert.equal(inchUnit?.factor, 25.4)
  assert.equal(ftUnit?.factor, 304.8)
})

test('toMM converts cm to mm correctly', async () => {
  const { toMM } = await import('../src/lib/types.ts')
  assert.equal(toMM(10, 'cm'), 100)
  assert.equal(toMM(1, 'cm'), 10)
})

test('toMM converts m to mm correctly', async () => {
  const { toMM } = await import('../src/lib/types.ts')
  assert.equal(toMM(1, 'm'), 1000)
  assert.equal(toMM(2.5, 'm'), 2500)
})

test('toMM converts inches to mm correctly', async () => {
  const { toMM } = await import('../src/lib/types.ts')
  assert.equal(toMM(1, 'inch'), 25.4)
  assert.equal(toMM(10, 'inch'), 254)
})

test('toMM converts feet to mm correctly', async () => {
  const { toMM } = await import('../src/lib/types.ts')
  assert.equal(toMM(1, 'ft'), 304.8)
  assert.equal(toMM(10, 'ft'), 3048)
})

test('toMM returns value unchanged for mm', async () => {
  const { toMM } = await import('../src/lib/types.ts')
  assert.equal(toMM(100, 'mm'), 100)
  assert.equal(toMM(1234, 'mm'), 1234)
})

test('areaSqm calculates area correctly for single unit', async () => {
  const { areaSqm } = await import('../src/lib/types.ts')
  assert.equal(areaSqm(1000, 1000, 1), 1)
  assert.equal(areaSqm(500, 500, 1), 0.25)
})

test('areaSqm multiplies by quantity', async () => {
  const { areaSqm } = await import('../src/lib/types.ts')
  assert.equal(areaSqm(1000, 1000, 2), 2)
  assert.equal(areaSqm(500, 500, 4), 1)
})

test('calculatePrice applies minimum charge for small items', async () => {
  const { calculatePrice } = await import('../src/lib/types.ts')
  // vinyl_banner has minCharge: 500
  assert.equal(calculatePrice('vinyl_banner', 100, 100, 1), 500)
  assert.equal(calculatePrice('vinyl_banner', 10, 10, 1), 500)
})

test('calculatePrice calculates by area for larger items', async () => {
  const { calculatePrice } = await import('../src/lib/types.ts')
  // vinyl_banner: 250 per sqm
  // 1m x 1m = 1 sqm * 250 = 250, but min is 500, so 500
  assert.equal(calculatePrice('vinyl_banner', 1000, 1000, 1), 500)

  // 2m x 1m = 2 sqm * 250 = 500
  assert.equal(calculatePrice('vinyl_banner', 2000, 1000, 1), 500)

  // 3m x 1m = 3 sqm * 250 = 750 (exceeds min)
  assert.equal(calculatePrice('vinyl_banner', 3000, 1000, 1), 750)
})

test('calculatePrice applies quantity multiplier', async () => {
  const { calculatePrice } = await import('../src/lib/types.ts')
  // vinyl_banner: 250 per sqm
  // 1m x 1m x 3 = 3 sqm * 250 = 750
  assert.equal(calculatePrice('vinyl_banner', 1000, 1000, 3), 750)
})

test('calculatePrice uses fallback pricing for unknown product types', async () => {
  const { calculatePrice } = await import('../src/lib/types.ts')
  // other: 500 per sqm, minCharge: 500
  assert.equal(calculatePrice('unknown_type', 100, 100, 1), 500)
  assert.equal(calculatePrice('unknown_type', 2000, 1000, 1), 1000)
})

test('calculatePrice handles different product types', async () => {
  const { calculatePrice } = await import('../src/lib/types.ts')
  // acrylic_sign: 3500 per sqm, minCharge: 1500
  assert.equal(calculatePrice('acrylic_sign', 100, 100, 1), 1500)
  assert.equal(calculatePrice('acrylic_sign', 1000, 1000, 1), 3500)

  // sticker: 350 per sqm, minCharge: 300
  assert.equal(calculatePrice('sticker', 100, 100, 1), 300)
  assert.equal(calculatePrice('sticker', 1000, 1000, 1), 350)
})

test('isWorkflowState validates workflow states', async () => {
  const { isWorkflowState } = await import('../src/lib/types.ts')
  assert.equal(isWorkflowState('NEW_MESSAGE'), true)
  assert.equal(isWorkflowState('IN_DESIGN'), true)
  assert.equal(isWorkflowState('COMPLETED'), true)
  assert.equal(isWorkflowState('invalid_state'), false)
  assert.equal(isWorkflowState(''), false)
})

test('isJobStatus validates job statuses', async () => {
  const { isJobStatus } = await import('../src/lib/types.ts')
  assert.equal(isJobStatus('IN_DESIGN'), true)
  assert.equal(isJobStatus('IN_PRODUCTION'), true)
  assert.equal(isJobStatus('COMPLETED'), true)
  assert.equal(isJobStatus('NEW_MESSAGE'), false)
  assert.equal(isJobStatus('invalid'), false)
})

test('isPaymentTerm validates payment terms', async () => {
  const { isPaymentTerm } = await import('../src/lib/types.ts')
  assert.equal(isPaymentTerm('prepaid'), true)
  assert.equal(isPaymentTerm('deposit'), true)
  assert.equal(isPaymentTerm('credit'), true)
  assert.equal(isPaymentTerm('invalid'), false)
  assert.equal(isPaymentTerm(''), false)
})

test('isPaymentStatus validates payment statuses', async () => {
  const { isPaymentStatus } = await import('../src/lib/types.ts')
  assert.equal(isPaymentStatus('unpaid'), true)
  assert.equal(isPaymentStatus('partial'), true)
  assert.equal(isPaymentStatus('paid'), true)
  assert.equal(isPaymentStatus('not_required'), true)
  assert.equal(isPaymentStatus('invalid'), false)
})

test('isDesignStatus validates design statuses', async () => {
  const { isDesignStatus } = await import('../src/lib/types.ts')
  assert.equal(isDesignStatus('not_started'), true)
  assert.equal(isDesignStatus('drafting'), true)
  assert.equal(isDesignStatus('approved'), true)
  assert.equal(isDesignStatus('invalid'), false)
})

test('designStatusNeedsCustomerResponse identifies awaiting states', async () => {
  const { designStatusNeedsCustomerResponse } = await import('../src/lib/types.ts')
  assert.equal(designStatusNeedsCustomerResponse('preview_sent'), true)
  assert.equal(designStatusNeedsCustomerResponse('revision_requested'), true)
  assert.equal(designStatusNeedsCustomerResponse('not_started'), false)
  assert.equal(designStatusNeedsCustomerResponse('drafting'), false)
  assert.equal(designStatusNeedsCustomerResponse('approved'), false)
  assert.equal(designStatusNeedsCustomerResponse(null), false)
  assert.equal(designStatusNeedsCustomerResponse(undefined), false)
})

test('getDesignStatusLabel returns Thai labels by default', async () => {
  const { getDesignStatusLabel } = await import('../src/lib/types.ts')
  assert.equal(getDesignStatusLabel('not_started'), 'ยังไม่เริ่มออกแบบ')
  assert.equal(getDesignStatusLabel('approved'), 'ลูกค้าอนุมัติแบบแล้ว')
})

test('getDesignStatusLabel returns English labels when requested', async () => {
  const { getDesignStatusLabel } = await import('../src/lib/types.ts')
  assert.equal(getDesignStatusLabel('not_started', 'en'), 'Not started')
  assert.equal(getDesignStatusLabel('approved', 'en'), 'Approved')
})

test('getDesignStatusLabel returns Burmese labels when requested', async () => {
  const { getDesignStatusLabel } = await import('../src/lib/types.ts')
  assert.equal(getDesignStatusLabel('not_started', 'my'), 'ဒီဇိုင်း မစရသေးပါ')
  assert.equal(getDesignStatusLabel('approved', 'my'), 'ဖောက်သည် အတည်ပြုပြီး')
})

test('getPaymentTermLabel returns correct labels', async () => {
  const { getPaymentTermLabel } = await import('../src/lib/types.ts')
  assert.equal(getPaymentTermLabel('prepaid'), 'จ่ายเต็มก่อนเริ่มงาน')
  assert.equal(getPaymentTermLabel('credit'), 'เครดิตลูกค้า')
  assert.equal(getPaymentTermLabel('prepaid', 'en'), 'Pay in full before production')
})

test('getPaymentStatusLabel returns correct labels', async () => {
  const { getPaymentStatusLabel } = await import('../src/lib/types.ts')
  assert.equal(getPaymentStatusLabel('unpaid'), 'ยังไม่รับชำระ')
  assert.equal(getPaymentStatusLabel('paid'), 'ชำระครบแล้ว')
  assert.equal(getPaymentStatusLabel('unpaid', 'en'), 'Unpaid')
})

test('getWorkflowStateLabel returns correct labels', async () => {
  const { getWorkflowStateLabel } = await import('../src/lib/types.ts')
  assert.equal(getWorkflowStateLabel('NEW_MESSAGE'), 'เริ่มต้นการสนทนา')
  assert.equal(getWorkflowStateLabel('IN_DESIGN'), 'กำลังออกแบบ')
  assert.equal(getWorkflowStateLabel('COMPLETED'), 'เสร็จสมบูรณ์')
  assert.equal(getWorkflowStateLabel('NEW_MESSAGE', 'en'), 'New conversation')
})

test('getJobStatusLabel returns correct labels', async () => {
  const { getJobStatusLabel } = await import('../src/lib/types.ts')
  assert.equal(getJobStatusLabel('IN_DESIGN'), 'กำลังออกแบบ')
  assert.equal(getJobStatusLabel('IN_PRODUCTION'), 'กำลังผลิต')
  assert.equal(getJobStatusLabel('IN_DESIGN', 'en'), 'In design')
})

test('getProductTypeLabel returns correct labels', async () => {
  const { getProductTypeLabel } = await import('../src/lib/types.ts')
  assert.equal(getProductTypeLabel('vinyl_banner'), 'ป้ายไวนิล')
  assert.equal(getProductTypeLabel('sticker'), 'สติ๊กเกอร์')
  assert.equal(getProductTypeLabel('vinyl_banner', 'en'), 'Vinyl banner')
  assert.equal(getProductTypeLabel('sticker', 'en'), 'Sticker')
})

test('getProductTypeLabel returns undefined for null or undefined', async () => {
  const { getProductTypeLabel } = await import('../src/lib/types.ts')
  assert.equal(getProductTypeLabel(null), undefined)
  assert.equal(getProductTypeLabel(undefined), undefined)
})

test('getProductTypeLabel returns original value for unknown types', async () => {
  const { getProductTypeLabel } = await import('../src/lib/types.ts')
  assert.equal(getProductTypeLabel('unknown_type'), 'unknown_type')
})
