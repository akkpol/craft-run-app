import { redirect } from 'next/navigation'

import { buildAdminLoginRedirect } from '@/lib/admin-auth-flow'
import { resolveAdminAccess } from '@/lib/admin-auth'
import { createClient } from '@/lib/supabase/server'

export default async function ProtectedPage() {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.getClaims()
  if (error) {
    redirect('/auth/login')
  }

  const access = resolveAdminAccess(data?.claims)
  if (!access.authenticated) {
    redirect('/auth/login')
  }

  if (!access.allowed) {
    redirect(buildAdminLoginRedirect('/admin', access.loginErrorCode ?? undefined))
  }

  redirect('/admin')
}
