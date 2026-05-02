'use server'

import { redirect } from 'next/navigation'

import {
  buildAdminLoginRedirect,
  normalizeAdminRedirectPath,
  type AdminLoginErrorCode,
} from '@/lib/admin-auth-flow'
import { createClient } from '@/lib/supabase/server'

function getLoginErrorCode(message: string | undefined): AdminLoginErrorCode {
  if (typeof message === 'string' && message.toLowerCase().includes('invalid login credentials')) {
    return 'invalid_credentials'
  }

  return 'login_failed'
}

export async function loginWithPasswordAction(formData: FormData) {
  const redirectTo = normalizeAdminRedirectPath(formData.get('redirectTo'))
  const email = formData.get('email')
  const password = formData.get('password')

  if (typeof email !== 'string' || typeof password !== 'string') {
    redirect(buildAdminLoginRedirect(redirectTo, 'login_failed'))
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    redirect(buildAdminLoginRedirect(redirectTo, getLoginErrorCode(error.message)))
  }

  redirect(redirectTo)
}
