import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  Loader2Icon,
  SettingsIcon,
  UserIcon,
  PhoneIcon,
  MailIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'

const schema = z.object({
  username: z.string().trim().min(3, '用户名至少 3 个字符'),
  name: z.string().trim().min(1, '姓名不能为空'),
  phone: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || /^1[3-9]\d{9}$/.test(v), '手机号格式不正确'),
  email: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), '邮箱格式不正确'),
})

type FormData = z.infer<typeof schema>

export default function AccountSettingsPage() {
  const employee = useAuthStore((s) => s.employee)
  const refresh = useAuthStore((s) => s.refresh)
  const [submitting, setSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      username: employee?.username || '',
      name: employee?.name || '',
      phone: employee?.phone || '',
      email: employee?.email || '',
    },
  })

  const onSubmit = async (data: FormData) => {
    setSubmitting(true)
    try {
      const res = await authApi.updateProfile({
        username: data.username,
        name: data.name,
        phone: data.phone || '',
        email: data.email || '',
      })
      await refresh()
      toast.success('资料已保存', {
        description:
          data.username !== employee?.username
            ? '用户名已更改，下次登录请使用新用户名'
            : '你的账号信息已更新',
      })
      void res
    } catch (e: any) {
      toast.error('保存失败', { description: e.message || '请重试' })
    } finally {
      setSubmitting(false)
    }
  }

  if (!employee) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="text-muted-foreground">未找到账号信息</div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mx-auto max-w-md border border-[var(--ink)] rounded-none bg-[#FCFAF6] p-10 anim-pop-in">
        {/* 标题 */}
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex size-16 items-center justify-center rounded-none bg-[var(--ink)]">
            <SettingsIcon className="size-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">账号设置</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            修改登录用户名及个人资料
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          {/* 用户名 */}
          <div className="space-y-2">
            <Label htmlFor="username" className="text-foreground">用户名（登录账号）</Label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="username"
                type="text"
                autoComplete="username"
                placeholder="请输入用户名"
                className="h-10 pl-9 bg-white border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:shadow-[0_0_0_3px_var(--focus-ring)] focus-visible:ring-0"
                {...register('username')}
              />
            </div>
            {errors.username && (
              <p className="text-xs text-destructive">{errors.username.message}</p>
            )}
          </div>

          {/* 姓名 */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-foreground">姓名</Label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="name"
                type="text"
                placeholder="请输入姓名"
                className="h-10 pl-9 bg-white border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:shadow-[0_0_0_3px_var(--focus-ring)] focus-visible:ring-0"
                {...register('name')}
              />
            </div>
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          {/* 手机号 */}
          <div className="space-y-2">
            <Label htmlFor="phone" className="text-foreground">手机号</Label>
            <div className="relative">
              <PhoneIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="phone"
                type="tel"
                placeholder="选填"
                className="h-10 pl-9 bg-white border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:shadow-[0_0_0_3px_var(--focus-ring)] focus-visible:ring-0"
                {...register('phone')}
              />
            </div>
            {errors.phone && (
              <p className="text-xs text-destructive">{errors.phone.message}</p>
            )}
          </div>

          {/* 邮箱 */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-foreground">邮箱</Label>
            <div className="relative">
              <MailIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="选填"
                className="h-10 pl-9 bg-white border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:shadow-[0_0_0_3px_var(--focus-ring)] focus-visible:ring-0"
                {...register('email')}
              />
            </div>
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>

          <Button
            type="submit"
            size="lg"
            disabled={submitting}
            className="h-11 w-full bg-gradient-to-b from-primary to-primary/85 text-primary-foreground shadow-sm hover:shadow-md transition-shadow"
          >
            {submitting ? (
              <>
                <Loader2Icon className="size-4 animate-spin" />
                保存中...
              </>
            ) : (
              '保存修改'
            )}
          </Button>
        </form>
      </div>
    </div>
  )
}
