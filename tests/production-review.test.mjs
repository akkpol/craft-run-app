import test from 'node:test'
import assert from 'node:assert/strict'

import {
  getReviewStatusAfterApproval,
  getReviewTimelineNote,
} from '../src/lib/production-review.ts'

test('approval stays approved when customer auto send is disabled', () => {
  assert.equal(getReviewStatusAfterApproval(false), 'approved')
})

test('approval becomes sent when customer auto send is enabled', () => {
  assert.equal(getReviewStatusAfterApproval(true), 'sent')
})

test('timeline note includes event type and asset count', () => {
  assert.equal(
    getReviewTimelineNote({
      action: 'submitted',
      eventType: 'proof',
      assetCount: 2,
    }),
    'Production proof submitted with 2 files'
  )
})
