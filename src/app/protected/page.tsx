import { redirect } from 'next/navigation'

import {
  hasConfiguredAdminAllowlist,
  isAdminEmailAllowed,
} from '@/lib/admin-access'
import { createClient } from '@/lib/supabase/server'

export default async function ProtectedPage() {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.getClaims()
  if (error || !data?.claims) {
    redirect('/auth/login')
  }

  const email = typeof data.claims.email === 'string' ? data.claims.email : null

  if (!hasConfiguredAdminAllowlist()) {
    redirect('/auth/login?error=admin_allowlist_missing')
  }

  if (!isAdminEmailAllowed(email)) {
    redirect('/auth/login?error=admin_not_allowed')
  }

  redirect('/admin')
}
