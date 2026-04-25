import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getSupabaseHost() {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "").host || "unknown"
  } catch {
    return "invalid"
  }
}

export function firstRow<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}
