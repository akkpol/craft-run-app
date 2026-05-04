import test from 'node:test'
import assert from 'node:assert/strict'

import { resolveAdminAccess } from '../src/lib/admin-auth.ts'

test('resolveAdminAccess reports unauthenticated state when claims are missing', () => {
  assert.deepEqual(resolveAdminAccess(null, {}), {
    authenticated: false,
    allowlistConfigured: false,
    allowed: false,
    email: null,
    loginErrorCode: null,
  })
})

test('resolveAdminAccess fails closed when the allowlist is missing', () => {
  assert.deepEqual(
    resolveAdminAccess({ email: 'admin@example.com' }, {}),
    {
      authenticated: true,
      allowlistConfigured: false,
      allowed: false,
      email: 'admin@example.com',
      loginErrorCode: 'admin_allowlist_missing',
    }
  )
})

test('resolveAdminAccess rejects authenticated users who are not on the allowlist', () => {
  assert.deepEqual(
    resolveAdminAccess(
      { email: 'ops@example.com' },
      { ADMIN_ALLOWED_EMAILS: 'admin@example.com' }
    ),
    {
      authenticated: true,
      allowlistConfigured: true,
      allowed: false,
      email: 'ops@example.com',
      loginErrorCode: 'admin_not_allowed',
    }
  )
})

test('resolveAdminAccess accepts configured allowlisted users', () => {
  assert.deepEqual(
    resolveAdminAccess(
      { email: 'Admin@Example.com' },
      { ADMIN_ALLOWED_EMAILS: 'admin@example.com' }
    ),
    {
      authenticated: true,
      allowlistConfigured: true,
      allowed: true,
      email: 'Admin@Example.com',
      loginErrorCode: null,
    }
  )
})
