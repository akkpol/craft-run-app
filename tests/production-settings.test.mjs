import test from 'node:test'
import assert from 'node:assert/strict'

import {
  getDefaultProductionSettings,
  normalizeProductionRetentionDays,
} from '../src/lib/production-settings.ts'

test('default production settings match phase 1 assumptions', () => {
  assert.deepEqual(getDefaultProductionSettings(), {
    productionUploadEnabled: true,
    productionCustomerAutoSendEnabled: false,
    productionAssetRetentionDays: 30,
  })
})

test('normalizeProductionRetentionDays falls back to 30 for invalid values', () => {
  assert.equal(normalizeProductionRetentionDays(undefined), 30)
  assert.equal(normalizeProductionRetentionDays(null), 30)
  assert.equal(normalizeProductionRetentionDays(0), 30)
  assert.equal(normalizeProductionRetentionDays(-5), 30)
  assert.equal(normalizeProductionRetentionDays(14), 14)
})
