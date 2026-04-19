export function normalizeAdminEmail(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase()

  return normalized ? normalized : null
}

export function parseAdminAllowedEmails(
  values: Array<string | null | undefined>
): string[] {
  const emails = values
    .flatMap((value) => (value ? value.split(/[\n,;]/) : []))
    .map((value) => normalizeAdminEmail(value))
    .filter((value): value is string => Boolean(value))

  return Array.from(new Set(emails))
}

export function getAdminAllowedEmails(
  env: Record<string, string | undefined> = process.env
): string[] {
  return parseAdminAllowedEmails([env.ADMIN_ALLOWED_EMAILS, env.ADMIN_EMAIL])
}

export function hasConfiguredAdminAllowlist(
  env: Record<string, string | undefined> = process.env
): boolean {
  return getAdminAllowedEmails(env).length > 0
}

export function isAdminEmailAllowed(
  email: string | null | undefined,
  env: Record<string, string | undefined> = process.env
): boolean {
  const normalizedEmail = normalizeAdminEmail(email)

  if (!normalizedEmail) {
    return false
  }

  return getAdminAllowedEmails(env).includes(normalizedEmail)
}