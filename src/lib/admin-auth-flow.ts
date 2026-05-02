export type AdminLoginErrorCode =
  | 'admin_allowlist_missing'
  | 'admin_not_allowed'
  | 'invalid_credentials'
  | 'login_failed'

export function normalizeAdminRedirectPath(pathname: unknown): string {
  if (
    typeof pathname !== 'string' ||
    !pathname.startsWith('/') ||
    pathname.startsWith('/auth')
  ) {
    return '/admin'
  }

  return pathname
}

export function buildAdminLoginRedirect(
  redirectTo: unknown,
  errorCode?: AdminLoginErrorCode
) {
  const normalizedPath = normalizeAdminRedirectPath(redirectTo)
  const searchParams = new URLSearchParams()

  if (errorCode) {
    searchParams.set('error', errorCode)
  }

  if (normalizedPath !== '/admin') {
    searchParams.set('next', normalizedPath)
  }

  const query = searchParams.toString()
  return query ? `/auth/login?${query}` : '/auth/login'
}
