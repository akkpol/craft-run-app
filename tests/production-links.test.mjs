import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildProductionLinkUrl,
  createProductionLinkToken,
  extractProductionLinkId,
  hashProductionLinkToken,
} from '../src/lib/production-links.ts'

test('createProductionLinkToken is deterministic for the same link id and secret', () => {
  const first = createProductionLinkToken({
    linkId: '2d06992d-315c-44fb-9b4f-d0a039f5f364',
    secret: 'test-secret',
  })
  const second = createProductionLinkToken({
    linkId: '2d06992d-315c-44fb-9b4f-d0a039f5f364',
    secret: 'test-secret',
  })

  assert.equal(first, second)
  assert.equal(extractProductionLinkId(first), '2d06992d-315c-44fb-9b4f-d0a039f5f364')
  assert.match(hashProductionLinkToken(first), /^[a-f0-9]{64}$/)
})

test('createProductionLinkToken changes when secret changes', () => {
  const first = createProductionLinkToken({
    linkId: '2d06992d-315c-44fb-9b4f-d0a039f5f364',
    secret: 'test-secret-a',
  })
  const second = createProductionLinkToken({
    linkId: '2d06992d-315c-44fb-9b4f-d0a039f5f364',
    secret: 'test-secret-b',
  })

  assert.notEqual(first, second)
})

test('buildProductionLinkUrl appends the token under /production', () => {
  const token = createProductionLinkToken({
    linkId: '2d06992d-315c-44fb-9b4f-d0a039f5f364',
    secret: 'test-secret',
  })

  assert.equal(
    buildProductionLinkUrl('https://fogus.example.com/', token),
    `https://fogus.example.com/production/${token}`
  )
})
