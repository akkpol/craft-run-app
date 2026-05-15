/**
 * Regression tests for middleware public route classification.
 *
 * Security invariant: admin-only quote routes (/api/quotes/[id]/commercial,
 * /api/quotes/[id]/approve) must NOT appear in the public prefix list.
 * Only /api/quotes/public/ (customer token-based actions) is public.
 *
 * This guards against the P0 regression where '/api/quotes/' was too broad
 * and allowed unauthenticated access to admin payment-term mutation routes.
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { PUBLIC_ROUTE_PREFIXES, isPublicRoute } from '../src/lib/middleware-routes.ts'

// --- P0 security: admin routes must NOT be public ---

test('commercial payment-term update requires auth (not public)', () => {
  assert.equal(isPublicRoute('/api/quotes/abc-123/commercial'), false)
})

test('admin quote approve-by-id requires auth (not public)', () => {
  assert.equal(isPublicRoute('/api/quotes/abc-123/approve'), false)
})

test('broad /api/quotes/ prefix is NOT in the public list', () => {
  assert.equal(PUBLIC_ROUTE_PREFIXES.includes('/api/quotes/'), false)
})

// --- Customer-facing routes must remain public ---

test('public quote token route is public (customer approval/rejection)', () => {
  assert.equal(isPublicRoute('/api/quotes/public/some-token'), true)
})

test('public quote token route with nested path is public', () => {
  assert.equal(isPublicRoute('/api/quotes/public/tok-abc-def-123/action'), true)
})

test('public install proof upload accepts only the token proof endpoint', () => {
  assert.equal(isPublicRoute('/api/install/install-token-123/proof'), true)
  assert.equal(isPublicRoute('/api/install/install-token-123/commercial'), false)
})

test('public install team page is public', () => {
  assert.equal(isPublicRoute('/install/install-token-123'), true)
})

// --- Other public routes must be unaffected ---

test('webhook route is still public (LINE platform calls)', () => {
  assert.equal(isPublicRoute('/api/webhook'), true)
})

test('intake route is still public (LIFF form submission)', () => {
  assert.equal(isPublicRoute('/api/intake'), true)
})

test('customer prefill route is still public', () => {
  assert.equal(isPublicRoute('/api/customers/prefill'), true)
})

test('quote status page is still public', () => {
  assert.equal(isPublicRoute('/quote/some-token'), true)
})

test('status page is still public', () => {
  assert.equal(isPublicRoute('/status/some-token'), true)
})

// --- Admin routes must NOT be public ---

test('payments confirm route requires auth', () => {
  assert.equal(isPublicRoute('/api/payments/confirm'), false)
})

test('commercial document issue route requires auth', () => {
  assert.equal(isPublicRoute('/api/commercial/documents/issue'), false)
})

test('jobs status route requires auth', () => {
  assert.equal(isPublicRoute('/api/jobs/abc/status'), false)
})
