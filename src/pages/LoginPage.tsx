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
  EyeIcon,
  EyeOffIcon,
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
  const [showPassword, setShowPassword] = useState(false)
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#FFF7F0] to-[#FCE6DA]">
        <div className="glass-card p-8">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2Icon className="size-5 animate-spin" />
            <span>加载中...</span>
          </div>
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4 bg-[#FBF4EC]">
      {/* 登录卡片 */}
      <div className="relative z-10 w-full max-w-md border border-[var(--ink)] rounded-none bg-[#FCFAF6] shadow-none p-10 anim-pop-in">
        {/* Logo / 标题区域 */}
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex size-16 items-center justify-center rounded-none bg-[var(--ink)]">
            <LockIcon className="size-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">喙语教育</h1>
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
                className="h-10 pl-9 bg-white border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:shadow-[0_0_0_3px_var(--focus-ring)] focus-visible:ring-0"
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
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                className="h-10 pl-9 pr-9 bg-white border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:shadow-[0_0_0_3px_var(--focus-ring)] focus-visible:ring-0"
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOffIcon className="size-4" />
                ) : (
                  <EyeIcon className="size-4" />
                )}
              </button>
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
        <div className="mt-6 rounded-none border border-[var(--ink-rule)] bg-transparent p-3 text-center anim-fade-in">
          <p className="text-xs text-primary">管理员：admin / admin123</p>
          <p className="text-xs text-primary">普通员工：tom / 123456</p>
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
