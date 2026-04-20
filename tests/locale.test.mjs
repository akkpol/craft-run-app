import test from 'node:test'
import assert from 'node:assert/strict'

import { normalizeLocale, resolveSurfaceLocale } from '../src/lib/locale.ts'

test('normalizeLocale supports regional forms and array input', () => {
  assert.equal(normalizeLocale('my-MM'), 'my')
  assert.equal(normalizeLocale(['th-TH', 'en-US']), 'th')
  assert.equal(normalizeLocale('en-US'), 'en')
})

test('resolveSurfaceLocale uses role defaults and accepts overrides', () => {
  assert.equal(resolveSurfaceLocale({ surface: 'production' }), 'my')
  assert.equal(resolveSurfaceLocale({ surface: 'admin' }), 'th')
  assert.equal(
    resolveSurfaceLocale({ surface: 'production', requested: 'en-US' }),
    'en'
  )
})