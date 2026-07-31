import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  Loader2Icon,
  LockIcon,
  EyeIcon,
  EyeOffIcon,
  KeyRoundIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authApi } from '@/lib/api'

const schema = z
  .object({
    oldPassword: z.string().min(1, '请输入原密码'),
    newPassword: z.string().min(6, '新密码至少 6 位'),
    confirmPassword: z.string().min(1, '请确认新密码'),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: '两次输入的新密码不一致',
    path: ['confirmPassword'],
  })

type FormData = z.infer<typeof schema>

export default function ChangePasswordPage() {
  const [showOld, setShowOld] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { oldPassword: '', newPassword: '', confirmPassword: '' },
  })

  const onSubmit = async (data: FormData) => {
    setSubmitting(true)
    try {
      await authApi.changePassword(data.oldPassword, data.newPassword)
      toast.success('密码修改成功', { description: '下次登录请使用新密码' })
      reset()
    } catch (e: any) {
      toast.error('修改失败', { description: e.message || '请重试' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-6">
      <div className="mx-auto max-w-md border border-[var(--ink)] rounded-none bg-[#FCFAF6] p-10 anim-pop-in">
        {/* 标题 */}
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex size-16 items-center justify-center rounded-none bg-[var(--ink)]">
            <KeyRoundIcon className="size-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">修改密码</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">请输入原密码并设置新密码</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          {/* 原密码 */}
          <div className="space-y-2">
            <Label htmlFor="oldPassword" className="text-foreground">原密码</Label>
            <div className="relative">
              <LockIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="oldPassword"
                type={showOld ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="请输入原密码"
                className="h-10 pl-9 pr-9 bg-white border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:shadow-[0_0_0_3px_var(--focus-ring)] focus-visible:ring-0"
                {...register('oldPassword')}
              />
              <button
                type="button"
                onClick={() => setShowOld((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                tabIndex={-1}
              >
                {showOld ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
              </button>
            </div>
            {errors.oldPassword && (
              <p className="text-xs text-destructive">{errors.oldPassword.message}</p>
            )}
          </div>

          {/* 新密码 */}
          <div className="space-y-2">
            <Label htmlFor="newPassword" className="text-foreground">新密码</Label>
            <div className="relative">
              <LockIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="newPassword"
                type={showNew ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="至少 6 位"
                className="h-10 pl-9 pr-9 bg-white border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:shadow-[0_0_0_3px_var(--focus-ring)] focus-visible:ring-0"
                {...register('newPassword')}
              />
              <button
                type="button"
                onClick={() => setShowNew((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                tabIndex={-1}
              >
                {showNew ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
              </button>
            </div>
            {errors.newPassword && (
              <p className="text-xs text-destructive">{errors.newPassword.message}</p>
            )}
          </div>

          {/* 确认新密码 */}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-foreground">确认新密码</Label>
            <div className="relative">
              <LockIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="confirmPassword"
                type={showNew ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="再次输入新密码"
                className="h-10 pl-9 bg-white border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:shadow-[0_0_0_3px_var(--focus-ring)] focus-visible:ring-0"
                {...register('confirmPassword')}
              />
            </div>
            {errors.confirmPassword && (
              <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
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
              '保存新密码'
            )}
          </Button>
        </form>
      </div>
    </div>
  )
}
