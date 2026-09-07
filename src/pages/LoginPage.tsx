import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Loader2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/stores/auth'

const loginSchema = z.object({
  username: z.string().min(1, '请输入用户名'),
  password: z.string().min(1, '请输入密码'),
})

type LoginFormData = z.infer<typeof loginSchema>

export default function LoginPage() {
  const { user, loading, signIn } = useAuthStore()
  const [submitting, setSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '' },
  })

  // Auth store 初始化中 — 显示加载画面
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-7 py-5 shadow-md">
          <Loader2Icon className="size-5 animate-spin text-primary" />
          <span className="text-muted-foreground">加载中...</span>
        </div>
      </div>
    )
  }

  // 已登录 — 由路由自动跳转（员工自助端已下线，统一进管理员后台）
  if (user) {
    return <Navigate to="/admin/dashboard" replace />
  }

  const onSubmit = async (data: LoginFormData) => {
    setSubmitting(true)
    const { error } = await signIn(data.username, data.password)
    if (error) {
      toast.error('登录失败', { description: error })
    }
    setSubmitting(false)
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      {/* 装饰性柔光 */}
      <div className="pointer-events-none absolute -top-32 -left-24 size-96 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-24 size-96 rounded-full bg-[var(--deco)]/10 blur-3xl" />

      {/* 登录卡片（v2：去掉容器，靠排印与留白） */}
      <div className="relative z-10 w-full max-w-md p-9 anim-pop-in">
        {/* Logo / 标题区域 */}
        <div className="mb-9 text-left">
          <div className="mb-6 inline-flex size-11 items-center justify-center rounded-xl bg-[var(--ink)] text-[var(--background)] text-base font-bold">
            喙
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            喙语教育
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">薪资管理系统</p>
        </div>

        {/* 登录表单 */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
          {/* 用户名输入框（v2：下划线） */}
          <div className="space-y-2">
            <Label
              htmlFor="username"
              className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground"
            >
              用户名
            </Label>
            <Input
              id="username"
              type="text"
              autoComplete="username"
              placeholder="请输入用户名"
              className="input-underline h-10 text-foreground placeholder:text-muted-foreground"
              {...register('username')}
            />
            {errors.username && (
              <p className="text-xs text-destructive">{errors.username.message}</p>
            )}
          </div>

          {/* 密码输入框（v2：下划线） */}
          <div className="space-y-2">
            <Label
              htmlFor="password"
              className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground"
            >
              密码
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="请输入密码"
              className="input-underline h-10 text-foreground placeholder:text-muted-foreground"
              {...register('password')}
            />
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password.message}</p>
            )}
          </div>

          {/* 登录按钮（v2：pill 全圆角） */}
          <Button
            type="submit"
            size="lg"
            disabled={submitting}
            className="h-12 w-full rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-90"
          >
            {submitting ? (
              <>
                <Loader2Icon className="size-4 animate-spin" />
                登录中...
              </>
            ) : (
              '登录'
            )}
          </Button>
        </form>

        {/* 底部版权信息 */}
        <div className="mt-8 text-center text-xs text-muted-foreground anim-fade-in">
          <p>© 2025 青岛喙语教育科技有限公司</p>
          <p className="mt-1">v1.0.0</p>
        </div>
      </div>
    </div>
  )
}
