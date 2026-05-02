import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'

import { loginWithPasswordAction } from '@/app/auth/login/actions'

type LoginFormProps = React.ComponentPropsWithoutRef<'div'> & {
  message?: string | null
  redirectTo?: string
}

export function LoginForm({
  className,
  message,
  redirectTo = '/admin',
  ...props
}: LoginFormProps) {
  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Login</CardTitle>
          <CardDescription>Enter your email below to login to your account</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={loginWithPasswordAction}>
            <input type="hidden" name="redirectTo" value={redirectTo} />
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="m@example.com"
                  autoComplete="email"
                  required
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    href="/auth/forgot-password"
                    className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                  >
                    Forgot your password?
                  </Link>
                </div>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </div>
              {message ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  {message}
                </div>
              ) : null}
              <Button type="submit" className="w-full">
                Login
              </Button>
            </div>
            <div className="mt-4 text-center text-sm text-muted-foreground">
              Backoffice accounts are provisioned by an admin only.
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
