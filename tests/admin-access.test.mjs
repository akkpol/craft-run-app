import test from 'node:test'
import assert from 'node:assert/strict'

import {
  getAdminAllowedEmails,
  hasConfiguredAdminAllowlist,
  isAdminEmailAllowed,
  normalizeAdminEmail,
  parseAdminAllowedEmails,
} from '../src/lib/admin-access.ts'

test('normalizeAdminEmail lowercases and trims email values', () => {
  assert.equal(normalizeAdminEmail(' Admin@Example.com '), 'admin@example.com')
  assert.equal(normalizeAdminEmail('   '), null)
})

test('parseAdminAllowedEmails supports comma, newline, and semicolon separators', () => {
  assert.deepEqual(
    parseAdminAllowedEmails([
      'admin@example.com, ops@example.com',
      'sales@example.com\nadmin@example.com',
      'owner@example.com;ops@example.com',
    ]),
    [
      'admin@example.com',
      'ops@example.com',
      'sales@example.com',
      'owner@example.com',
    ]
  )
})

test('getAdminAllowedEmails merges ADMIN_ALLOWED_EMAILS with ADMIN_EMAIL fallback', () => {
  const env = {
    ADMIN_ALLOWED_EMAILS: 'ops@example.com, sales@example.com',
    ADMIN_EMAIL: 'admin@example.com',
  }

  assert.deepEqual(getAdminAllowedEmails(env), [
    'ops@example.com',
    'sales@example.com',
    'admin@example.com',
  ])
})

test('isAdminEmailAllowed is fail-closed when allowlist is missing', () => {
  assert.equal(hasConfiguredAdminAllowlist({}), false)
  assert.equal(isAdminEmailAllowed('admin@example.com', {}), false)
  assert.equal(
    isAdminEmailAllowed('Admin@Example.com', {
      ADMIN_ALLOWED_EMAILS: 'admin@example.com',
    }),
    true
  )
})