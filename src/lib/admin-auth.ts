import { hasConfiguredAdminAllowlist, isAdminEmailAllowed } from '@/lib/admin-access'
import type { AdminLoginErrorCode } from '@/lib/admin-auth-flow'

export type AdminClaimsLike = {
  email?: unknown
} | null | undefined

export type AdminEnvLike = Record<string, string | undefined>

export type AdminAccessDecision = {
  authenticated: boolean
  allowlistConfigured: boolean
  allowed: boolean
  email: string | null
  loginErrorCode: AdminLoginErrorCode | null
}

export function resolveAdminAccess(
  claims: AdminClaimsLike,
  env: AdminEnvLike = process.env
): AdminAccessDecision {
  const email = typeof claims?.email === 'string' ? claims.email : null
  const authenticated = Boolean(claims)
  const allowlistConfigured = hasConfiguredAdminAllowlist(env)

  if (!authenticated) {
    return {
      authenticated: false,
      allowlistConfigured,
      allowed: false,
      email,
      loginErrorCode: null,
    }
  }

  if (!allowlistConfigured) {
    return {
      authenticated: true,
      allowlistConfigured,
      allowed: false,
      email,
      loginErrorCode: 'admin_allowlist_missing',
    }
  }

  if (!isAdminEmailAllowed(email, env)) {
    return {
      authenticated: true,
      allowlistConfigured,
      allowed: false,
      email,
      loginErrorCode: 'admin_not_allowed',
    }
  }

  return {
    authenticated: true,
    allowlistConfigured,
    allowed: true,
    email,
    loginErrorCode: null,
  }
}
