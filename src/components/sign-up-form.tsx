import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import Link from 'next/link'

export function SignUpForm({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Backoffice Sign-Up Disabled</CardTitle>
          <CardDescription>
            บัญชีหลังบ้านจะถูกสร้างโดยผู้ดูแลระบบเท่านั้น เพื่อป้องกันคนที่ไม่ได้รับอนุญาตเข้าหน้า admin
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            ถ้าต้องการเข้าใช้งานหลังบ้าน ให้ผู้ดูแลระบบสร้างผู้ใช้ใน Supabase Auth แล้วเพิ่มอีเมลไว้ใน allowlist ของระบบก่อน
          </div>
          <Button asChild className="w-full">
            <Link href="/auth/login">Back to login</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
