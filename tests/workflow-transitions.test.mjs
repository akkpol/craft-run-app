import test from 'node:test'
import assert from 'node:assert/strict'

import {
  ALLOWED_JOB_TRANSITIONS,
  ALLOWED_CONVERSATION_TRANSITIONS,
} from '../src/lib/workflow-transitions.ts'

// Job transition validation tests
test('IN_DESIGN job can transition to production, hold, review, or cancel', () => {
  const allowed = ALLOWED_JOB_TRANSITIONS.IN_DESIGN
  assert.ok(allowed.includes('IN_PRODUCTION'))
  assert.ok(allowed.includes('ON_HOLD_CUSTOMER_INPUT'))
  assert.ok(allowed.includes('HUMAN_REVIEW_REQUIRED'))
  assert.ok(allowed.includes('CANCELLED'))
  assert.equal(allowed.length, 4)
})

test('IN_PRODUCTION job can only transition to fulfillment or cancel', () => {
  const allowed = ALLOWED_JOB_TRANSITIONS.IN_PRODUCTION
  assert.ok(allowed.includes('READY_FOR_FULFILLMENT'))
  assert.ok(allowed.includes('CANCELLED'))
  assert.equal(allowed.length, 2)
})

test('READY_FOR_FULFILLMENT job can only transition to completed or cancel', () => {
  const allowed = ALLOWED_JOB_TRANSITIONS.READY_FOR_FULFILLMENT
  assert.ok(allowed.includes('COMPLETED'))
  assert.ok(allowed.includes('CANCELLED'))
  assert.equal(allowed.length, 2)
})

test('COMPLETED job has no allowed transitions', () => {
  const allowed = ALLOWED_JOB_TRANSITIONS.COMPLETED
  assert.equal(allowed.length, 0)
})

test('CANCELLED job has no allowed transitions', () => {
  const allowed = ALLOWED_JOB_TRANSITIONS.CANCELLED
  assert.equal(allowed.length, 0)
})

test('ON_HOLD_CUSTOMER_INPUT job can return to design or be cancelled', () => {
  const allowed = ALLOWED_JOB_TRANSITIONS.ON_HOLD_CUSTOMER_INPUT
  assert.ok(allowed.includes('IN_DESIGN'))
  assert.ok(allowed.includes('CANCELLED'))
  assert.equal(allowed.length, 2)
})

test('HUMAN_REVIEW_REQUIRED job can return to design or be cancelled', () => {
  const allowed = ALLOWED_JOB_TRANSITIONS.HUMAN_REVIEW_REQUIRED
  assert.ok(allowed.includes('IN_DESIGN'))
  assert.ok(allowed.includes('CANCELLED'))
  assert.equal(allowed.length, 2)
})

// Conversation transition validation tests
test('NEW_MESSAGE can transition to collecting or review', () => {
  const allowed = ALLOWED_CONVERSATION_TRANSITIONS.NEW_MESSAGE
  assert.ok(allowed.includes('COLLECTING_REQUIREMENTS'))
  assert.ok(allowed.includes('REQUIREMENTS_REVIEW'))
  assert.equal(allowed.length, 2)
})

test('COLLECTING_REQUIREMENTS can transition to review, hold, human review, or cancel', () => {
  const allowed = ALLOWED_CONVERSATION_TRANSITIONS.COLLECTING_REQUIREMENTS
  assert.ok(allowed.includes('REQUIREMENTS_REVIEW'))
  assert.ok(allowed.includes('ON_HOLD_CUSTOMER_INPUT'))
  assert.ok(allowed.includes('HUMAN_REVIEW_REQUIRED'))
  assert.ok(allowed.includes('CANCELLED'))
  assert.equal(allowed.length, 4)
})

test('REQUIREMENTS_REVIEW can transition to waiting quote, hold, human review, or cancel', () => {
  const allowed = ALLOWED_CONVERSATION_TRANSITIONS.REQUIREMENTS_REVIEW
  assert.ok(allowed.includes('WAITING_QUOTE_APPROVAL'))
  assert.ok(allowed.includes('ON_HOLD_CUSTOMER_INPUT'))
  assert.ok(allowed.includes('HUMAN_REVIEW_REQUIRED'))
  assert.ok(allowed.includes('CANCELLED'))
  assert.equal(allowed.length, 4)
})

test('WAITING_QUOTE_APPROVAL can transition back to review, waiting payment, design, human review, or cancel', () => {
  const allowed = ALLOWED_CONVERSATION_TRANSITIONS.WAITING_QUOTE_APPROVAL
  assert.ok(allowed.includes('REQUIREMENTS_REVIEW'))
  assert.ok(allowed.includes('WAITING_PAYMENT'))
  assert.ok(allowed.includes('IN_DESIGN'))
  assert.ok(allowed.includes('HUMAN_REVIEW_REQUIRED'))
  assert.ok(allowed.includes('CANCELLED'))
  assert.equal(allowed.length, 5)
})

test('WAITING_PAYMENT can transition back to review, design, human review, or cancel', () => {
  const allowed = ALLOWED_CONVERSATION_TRANSITIONS.WAITING_PAYMENT
  assert.ok(allowed.includes('REQUIREMENTS_REVIEW'))
  assert.ok(allowed.includes('IN_DESIGN'))
  assert.ok(allowed.includes('HUMAN_REVIEW_REQUIRED'))
  assert.ok(allowed.includes('CANCELLED'))
  assert.equal(allowed.length, 4)
})

test('IN_DESIGN conversation can transition to hold, human review, production, or cancel', () => {
  const allowed = ALLOWED_CONVERSATION_TRANSITIONS.IN_DESIGN
  assert.ok(allowed.includes('ON_HOLD_CUSTOMER_INPUT'))
  assert.ok(allowed.includes('HUMAN_REVIEW_REQUIRED'))
  assert.ok(allowed.includes('IN_PRODUCTION'))
  assert.ok(allowed.includes('CANCELLED'))
  assert.equal(allowed.length, 4)
})

test('IN_PRODUCTION conversation can transition to fulfillment, hold, review, or cancel', () => {
  const allowed = ALLOWED_CONVERSATION_TRANSITIONS.IN_PRODUCTION
  assert.ok(allowed.includes('READY_FOR_FULFILLMENT'))
  assert.ok(allowed.includes('ON_HOLD_CUSTOMER_INPUT'))
  assert.ok(allowed.includes('HUMAN_REVIEW_REQUIRED'))
  assert.ok(allowed.includes('CANCELLED'))
  assert.equal(allowed.length, 4)
})

test('READY_FOR_FULFILLMENT conversation can transition to completed, review, or cancel', () => {
  const allowed = ALLOWED_CONVERSATION_TRANSITIONS.READY_FOR_FULFILLMENT
  assert.ok(allowed.includes('COMPLETED'))
  assert.ok(allowed.includes('HUMAN_REVIEW_REQUIRED'))
  assert.ok(allowed.includes('CANCELLED'))
  assert.equal(allowed.length, 3)
})

test('ON_HOLD_CUSTOMER_INPUT conversation can transition to multiple states', () => {
  const allowed = ALLOWED_CONVERSATION_TRANSITIONS.ON_HOLD_CUSTOMER_INPUT
  assert.ok(allowed.includes('COLLECTING_REQUIREMENTS'))
  assert.ok(allowed.includes('REQUIREMENTS_REVIEW'))
  assert.ok(allowed.includes('IN_DESIGN'))
  assert.ok(allowed.includes('HUMAN_REVIEW_REQUIRED'))
  assert.ok(allowed.includes('CANCELLED'))
  assert.equal(allowed.length, 5)
})

test('HUMAN_REVIEW_REQUIRED conversation can transition to many states for flexibility', () => {
  const allowed = ALLOWED_CONVERSATION_TRANSITIONS.HUMAN_REVIEW_REQUIRED
  assert.ok(allowed.includes('COLLECTING_REQUIREMENTS'))
  assert.ok(allowed.includes('REQUIREMENTS_REVIEW'))
  assert.ok(allowed.includes('WAITING_QUOTE_APPROVAL'))
  assert.ok(allowed.includes('WAITING_PAYMENT'))
  assert.ok(allowed.includes('IN_DESIGN'))
  assert.ok(allowed.includes('IN_PRODUCTION'))
  assert.ok(allowed.includes('READY_FOR_FULFILLMENT'))
  assert.ok(allowed.includes('CANCELLED'))
  assert.equal(allowed.length, 8)
})

test('COMPLETED conversation has no allowed transitions', () => {
  const allowed = ALLOWED_CONVERSATION_TRANSITIONS.COMPLETED
  assert.equal(allowed.length, 0)
})

test('CANCELLED conversation has no allowed transitions', () => {
  const allowed = ALLOWED_CONVERSATION_TRANSITIONS.CANCELLED
  assert.equal(allowed.length, 0)
})

// Ensure all job statuses have transition rules
test('all job statuses have transition rules defined', () => {
  const jobStatuses = [
    'IN_DESIGN',
    'IN_PRODUCTION',
    'READY_FOR_FULFILLMENT',
    'ON_HOLD_CUSTOMER_INPUT',
    'HUMAN_REVIEW_REQUIRED',
    'COMPLETED',
    'CANCELLED',
  ]

  for (const status of jobStatuses) {
    assert.ok(
      ALLOWED_JOB_TRANSITIONS.hasOwnProperty(status),
      `Missing transition rules for job status: ${status}`
    )
  }
})

// Ensure all workflow states have transition rules
test('all workflow states have transition rules defined', () => {
  const workflowStates = [
    'NEW_MESSAGE',
    'COLLECTING_REQUIREMENTS',
    'REQUIREMENTS_REVIEW',
    'WAITING_QUOTE_APPROVAL',
    'WAITING_PAYMENT',
    'IN_DESIGN',
    'IN_PRODUCTION',
    'READY_FOR_FULFILLMENT',
    'ON_HOLD_CUSTOMER_INPUT',
    'HUMAN_REVIEW_REQUIRED',
    'COMPLETED',
    'CANCELLED',
  ]

  for (const state of workflowStates) {
    assert.ok(
      ALLOWED_CONVERSATION_TRANSITIONS.hasOwnProperty(state),
      `Missing transition rules for workflow state: ${state}`
    )
  }
})
