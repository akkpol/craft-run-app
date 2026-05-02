import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildAdminLoginRedirect,
  normalizeAdminRedirectPath,
} from '../src/lib/admin-auth-flow.ts'

test('normalizeAdminRedirectPath falls back to /admin for missing or unsafe paths', () => {
  assert.equal(normalizeAdminRedirectPath(undefined), '/admin')
  assert.equal(normalizeAdminRedirectPath('https://example.com/admin'), '/admin')
  assert.equal(normalizeAdminRedirectPath('/auth/login'), '/admin')
})

test('normalizeAdminRedirectPath preserves safe internal paths and queries', () => {
  assert.equal(normalizeAdminRedirectPath('/admin'), '/admin')
  assert.equal(normalizeAdminRedirectPath('/admin?filter=all'), '/admin?filter=all')
  assert.equal(normalizeAdminRedirectPath('/protected?tab=profile'), '/protected?tab=profile')
})

test('buildAdminLoginRedirect omits next for the default /admin destination', () => {
  assert.equal(buildAdminLoginRedirect('/admin'), '/auth/login')
  assert.equal(
    buildAdminLoginRedirect('/auth/login', 'admin_not_allowed'),
    '/auth/login?error=admin_not_allowed'
  )
})

test('buildAdminLoginRedirect preserves safe next paths and query strings', () => {
  assert.equal(
    buildAdminLoginRedirect('/admin?filter=all', 'invalid_credentials'),
    '/auth/login?error=invalid_credentials&next=%2Fadmin%3Ffilter%3Dall'
  )
  assert.equal(
    buildAdminLoginRedirect('/protected?tab=profile'),
    '/auth/login?next=%2Fprotected%3Ftab%3Dprofile'
  )
})
