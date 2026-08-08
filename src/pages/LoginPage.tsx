import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  Loader2Icon,
  LockIcon,
  UserIcon,
} from 'lucide-react'
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
  const { user, loading, signIn, isAdmin } = useAuthStore()
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

  // 已登录 — 由路由自动跳转
  if (user) {
    return <Navigate to={isAdmin() ? '/admin/dashboard' : '/employee/payslip'} replace />
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

      {/* 登录卡片 */}
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card p-9 shadow-xl anim-pop-in">
        {/* Logo / 标题区域 */}
        <div className="mb-8 text-center">
          <div className="mb-5 inline-flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-[var(--deco)] text-[var(--primary-foreground)] shadow-lg">
            <LockIcon className="size-8" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            喙语教育
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">薪资管理系统</p>
        </div>

        {/* 登录表单 */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          {/* 用户名输入框 */}
          <div className="space-y-2">
            <Label htmlFor="username" className="text-foreground">用户名</Label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="username"
                type="text"
                autoComplete="username"
                placeholder="请输入用户名"
                className="h-10 pl-9 bg-secondary/40 border-border rounded-lg text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:shadow-[0_0_0_3px_var(--focus-ring)] focus-visible:ring-0"
                {...register('username')}
              />
            </div>
            {errors.username && (
              <p className="text-xs text-destructive">{errors.username.message}</p>
            )}
          </div>

          {/* 密码输入框 */}
          <div className="space-y-2">
            <Label htmlFor="password" className="text-foreground">密码</Label>
            <div className="relative">
              <LockIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                className="h-10 pl-9 bg-secondary/40 border-border rounded-lg text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:shadow-[0_0_0_3px_var(--focus-ring)] focus-visible:ring-0"
                {...register('password')}
              />
            </div>
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password.message}</p>
            )}
          </div>

          {/* 登录按钮 */}
          <Button
            type="submit"
            size="lg"
            disabled={submitting}
            className="h-11 w-full bg-gradient-to-b from-primary to-primary/85 text-primary-foreground shadow-sm hover:shadow-md transition-shadow"
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

        {/* 演示账号提示 */}
        <div className="mt-6 rounded-xl border border-border bg-secondary/50 p-3 text-center anim-fade-in">
          <p className="text-xs text-primary">普通员工：tom / 123456</p>
          <p className="text-xs text-muted-foreground">管理员密码已单独设置，请用新密码登录</p>
        </div>

        {/* 底部版权信息 */}
        <div className="mt-4 text-center text-xs text-muted-foreground">
          <p>© 2025 青岛喙语教育科技有限公司</p>
          <p className="mt-1">v1.0.0</p>
        </div>
      </div>
    </div>
  )
}
