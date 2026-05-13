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
]

export function isPublicRoute(pathname: string) {
  return PUBLIC_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}
