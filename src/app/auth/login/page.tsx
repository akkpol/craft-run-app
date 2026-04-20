import { LoginForm } from '@/components/login-form'

const LOGIN_ERROR_MESSAGES = {
  admin_allowlist_missing:
    'ยังไม่ได้ตั้งค่า ADMIN_ALLOWED_EMAILS หรือ ADMIN_EMAIL ระบบจึงปิด /admin ไว้ก่อนเพื่อความปลอดภัย',
  admin_not_allowed:
    'บัญชีนี้ล็อกอินได้ แต่ยังไม่ได้รับสิทธิ์เข้า /admin ติดต่อผู้ดูแลให้เพิ่มอีเมลนี้ใน allowlist ก่อน',
} as const

function firstValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0]
  }

  return value
}

function normalizeRedirectPath(pathname: string | undefined) {
  if (!pathname || !pathname.startsWith('/') || pathname.startsWith('/auth')) {
    return '/admin'
  }

  return pathname
}

export default async function Page(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const searchParams = await props.searchParams
  const errorCode = firstValue(searchParams.error) as keyof typeof LOGIN_ERROR_MESSAGES | undefined
  const message = errorCode ? LOGIN_ERROR_MESSAGES[errorCode] : null
  const redirectTo = normalizeRedirectPath(firstValue(searchParams.next))

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <LoginForm
          message={message}
          redirectTo={redirectTo}
          signOutOnMount={Boolean(errorCode)}
        />
      </div>
    </div>
  )
}
