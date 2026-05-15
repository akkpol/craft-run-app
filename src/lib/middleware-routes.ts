/**
 * Public route prefix list for the Next.js middleware.
 *
 * Exported separately so regression tests can import this without
 * pulling in Next.js server module dependencies.
 *
 * Security rule: admin-only routes must NOT appear here.
 * Customer-facing token routes use /api/quotes/public/ only.
 */
export const PUBLIC_ROUTE_PREFIXES = [
  '/auth',
  '/liff',
  '/quote',
  '/status',
  '/production',
  '/flow',
  '/api/webhook',
  '/api/intake',
  '/api/customers/prefill',
  '/api/liff/health',
  '/api/liff/validation-report',
  '/api/quotes/public/',
  '/api/production/',
  '/api/internal/production-media/cleanup',
  '/install/',
]

/**
 * Token-scoped public routes — accept any `[token]` segment but stop at
 * the explicit suffix so admin-only siblings under `/api/quotes/[id]/...`
 * are NOT exposed. Pattern segments must start with `/` and use `*` as a
 * single-segment wildcard.
 *
 * Example:
 *   /api/quotes/<token>/slip       (customer slip upload — public)
 *   /api/quotes/<id>/commercial    (admin payment ops — still private)
 */
export const PUBLIC_ROUTE_PATTERNS: string[] = [
  '/api/quotes/*/slip',
  '/api/install/*/proof',
]

function matchesPattern(pathname: string, pattern: string): boolean {
  const segs = pathname.replace(/^\/+|\/+$/g, '').split('/')
  const pats = pattern.replace(/^\/+|\/+$/g, '').split('/')
  if (segs.length !== pats.length) return false
  return pats.every((p, i) => p === '*' || p === segs[i])
}

export function isPublicRoute(pathname: string) {
  if (PUBLIC_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true
  return PUBLIC_ROUTE_PATTERNS.some((pattern) => matchesPattern(pathname, pattern))
}
