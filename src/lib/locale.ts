export const APP_LOCALES = ["th", "my", "en"] as const;

export type AppLocale = (typeof APP_LOCALES)[number];

export type LocaleSurface = "admin" | "customer" | "production";

export const LOCALE_DISPLAY_NAMES: Record<AppLocale, string> = {
  th: "ไทย",
  my: "မြန်မာ",
  en: "English",
};

const DEFAULT_SURFACE_LOCALES: Record<LocaleSurface, AppLocale> = {
  admin: "th",
  customer: "th",
  production: "my",
};

function firstLocaleValue(
  value: string | string[] | null | undefined
): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value ?? undefined;
}

export function normalizeLocale(
  value: string | string[] | null | undefined
): AppLocale | undefined {
  const candidate = firstLocaleValue(value)?.trim().toLowerCase();

  if (!candidate) {
    return undefined;
  }

  if (candidate.startsWith("th")) {
    return "th";
  }

  if (candidate.startsWith("my") || candidate.startsWith("mm")) {
    return "my";
  }

  if (candidate.startsWith("en")) {
    return "en";
  }

  return undefined;
}

export function resolveSurfaceLocale(input: {
  surface: LocaleSurface;
  requested?: string | string[] | null | undefined;
  fallback?: AppLocale;
}): AppLocale {
  return (
    normalizeLocale(input.requested) ??
    input.fallback ??
    DEFAULT_SURFACE_LOCALES[input.surface]
  );
}