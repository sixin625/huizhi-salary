import { useEffect, useMemo } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import type { ReactNode } from 'react'
import { employeeApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type {
  Campus,
  Department,
  Employee,
} from '@/types/database'

// ---- Zod 校验 schema ----
const employeeSchema = z.object({
  username: z
    .string()
    .min(2, '用户名至少2个字符')
    .max(50, '用户名最多50个字符'),
  password: z.string().optional(),
  name: z
    .string()
    .min(2, '姓名至少2个字符')
    .max(50, '姓名最多50个字符'),
  phone: z
    .string()
    .nullable()
    .refine(
      (val) => !val || /^1\d{10}$/.test(val),
      '请输入正确的11位手机号',
    ),
  email: z
    .string()
    .refine(
      (val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
      '邮箱格式不正确',
    ),
  campus_id: z.string().min(1, '请选择校区'),
  department_id: z.string().min(1, '请选择部门'),
  hire_date: z.string().min(1, '请选择入职日期'),
  base_salary: z
    .string()
    .refine((val) => !val || Number(val) >= 0, '基本工资不能为负数'),
  is_admin: z.boolean(),
})

type FormValues = z.infer<typeof employeeSchema>

interface EmployeeFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  employee?: Employee | null
  campuses: Campus[]
  departments: Department[]
  onSuccess: () => void
}

export function EmployeeForm({
  open,
  onOpenChange,
  employee,
  campuses,
  departments,
  onSuccess,
}: EmployeeFormProps) {
  const isEdit = !!employee

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      username: '',
      password: '',
      name: '',
      phone: '',
      email: '',
      campus_id: '',
      department_id: '',
      hire_date: '',
      base_salary: '',
      is_admin: false,
    },
  })

  // 打开时根据 employee 重置表单
  useEffect(() => {
    if (!open) return
    if (employee) {
      reset({
        username: employee.username ?? '',
        password: '', // 编辑时密码留空表示不修改
        name: employee.name,
        phone: employee.phone ?? '',
        email: employee.email ?? '',
        campus_id: employee.campus_id ?? '',
        department_id: employee.department_id ?? '',
        hire_date: employee.hire_date,
        base_salary:
          employee.base_salary != null
            ? String(employee.base_salary)
            : '',
        is_admin: employee.is_admin,
      })
    } else {
      reset({
        username: '',
        password: '',
        name: '',
        phone: '',
        email: '',
        campus_id: '',
        department_id: '',
        hire_date: '',
        base_salary: '',
        is_admin: false,
      })
    }
  }, [open, employee, reset])

  // Select items 映射（让 trigger 显示 label 而非 raw value）
  const campusItems = useMemo(() => {
    const map: Record<string, ReactNode> = {}
    for (const c of campuses) {
      map[c.id] = c.name
    }
    return map
  }, [campuses])

  const departmentItems = useMemo(() => {
    const map: Record<string, ReactNode> = {}
    for (const d of departments) {
      map[d.id] = d.name
    }
    return map
  }, [departments])

  const onSubmit = async (data: FormValues) => {
    try {
      const payload: Record<string, unknown> = {
        username: data.username,
        name: data.name,
        phone: data.phone || null,
        email: data.email || null,
        campus_id: data.campus_id,
        department_id: data.department_id,
        hire_date: data.hire_date,
        base_salary: data.base_salary ? Number(data.base_salary) : 0,
        is_admin: data.is_admin,
      }

      if (isEdit && employee) {
        // 编辑时：密码留空则不修改
        if (data.password) {
          payload.password = data.password
        }
        await employeeApi.update(employee.id, payload)
        toast.success('员工信息已更新')
      } else {
        // 新增时：密码必填
        if (!data.password) {
          toast.error('请设置密码')
          return
        }
        payload.password = data.password
        await employeeApi.create(payload)
        toast.success('员工已添加')
      }

      onOpenChange(false)
      onSuccess()
    } catch (err) {
      const msg = err instanceof Error ? err.message : '未知错误'
      toast.error(isEdit ? '更新失败：' : '新增失败：', { description: msg })
    }
  }

  /* ─── 辅助渲染：下划线输入框 + 错误 ─── */
  function UnderlineInput(props: Parameters<typeof Input>[0] & { error?: string }) {
    return (
      <div>
        <Input {...props} className={cn('input-underline', props.className)} />
        {props.error && <p className="field-error">{props.error}</p>}
      </div>
    )
  }

  function UnderlineSelect({
    value,
    onValueChange,
    items,
    placeholder,
    children,
    error,
    ariaInvalid,
  }: {
    value: string | null
    onValueChange: (val: string | null) => void
    items: Record<string, ReactNode>
    placeholder: string
    children: React.ReactNode
    error?: string
    ariaInvalid?: boolean
  }) {
    return (
      <div>
        <Select value={value} onValueChange={onValueChange} items={items}>
          <SelectTrigger className="select-underline w-full" aria-invalid={ariaInvalid}>
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>{children}</SelectContent>
        </Select>
        {error && <p className="field-error">{error}</p>}
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="editorial-dialog" showCloseButton>
        {/* ── 头部：衬线标题 + 细线 ── */}
        <DialogHeader className="editorial-dialog-header">
          <DialogTitle className="editorial-dialog-title">
            {isEdit ? '编辑员工' : '新增员工'}
          </DialogTitle>
          <DialogDescription className="editorial-dialog-subtitle">
            {isEdit ? '修改员工的基本信息与权限' : '填写新员工的账号与基本信息'}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(onSubmit, () =>
            toast.error('请检查表单中标红的字段')
          )}
          className="editorial-form"
        >
          {/* ═══ Section 1：账号信息 ═══ */}
          <div className="editorial-form-section">
            <span className="editorial-section-label">账号</span>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label htmlFor="username" className="form-label">用户名</label>
                <UnderlineInput
                  id="username"
                  placeholder="登录用户名"
                  aria-invalid={!!errors.username}
                  error={errors.username?.message}
                  {...register('username')}
                />
              </div>
              <div>
                <label htmlFor="password" className="form-label">
                  密码{isEdit ? '（留空不修改）' : ''}
                </label>
                <UnderlineInput
                  id="password"
                  type="password"
                  placeholder={isEdit ? '••••••••' : '设置登录密码'}
                  aria-invalid={!!errors.password}
                  error={errors.password?.message}
                  {...register('password')}
                />
              </div>
            </div>
          </div>

          {/* ═══ Section 2：个人信息 ═══ */}
          <div className="editorial-form-section">
            <span className="editorial-section-label">个人信息</span>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label htmlFor="name" className="form-label">姓名</label>
                <UnderlineInput
                  id="name"
                  placeholder="请输入姓名"
                  aria-invalid={!!errors.name}
                  error={errors.name?.message}
                  {...register('name')}
                />
              </div>
              <div>
                <label htmlFor="phone" className="form-label">手机号（选填）</label>
                <UnderlineInput
                  id="phone"
                  placeholder="选填，11位手机号"
                  maxLength={11}
                  aria-invalid={!!errors.phone}
                  error={errors.phone?.message}
                  {...register('phone')}
                />
              </div>
            </div>
            <div className="mt-5">
              <label htmlFor="email" className="form-label">邮箱（选填）</label>
              <UnderlineInput
                id="email"
                type="email"
                placeholder="example@company.com"
                aria-invalid={!!errors.email}
                error={errors.email?.message}
                {...register('email')}
              />
            </div>
          </div>

          {/* ═══ Section 3：组织归属 ═══ */}
          <div className="editorial-form-section">
            <span className="editorial-section-label">组织归属</span>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="form-label">校区</label>
                <Controller
                  control={control}
                  name="campus_id"
                  render={({ field }) => (
                    <UnderlineSelect
                      value={field.value || null}
                      onValueChange={(val) => field.onChange(val)}
                      items={campusItems}
                      placeholder="请选择校区"
                      ariaInvalid={!!errors.campus_id}
                      error={errors.campus_id?.message}
                    >
                      {campuses.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </UnderlineSelect>
                  )}
                />
              </div>
              <div>
                <label className="form-label">部门</label>
                <Controller
                  control={control}
                  name="department_id"
                  render={({ field }) => (
                    <UnderlineSelect
                      value={field.value || null}
                      onValueChange={(val) => field.onChange(val)}
                      items={departmentItems}
                      placeholder="请选择部门"
                      ariaInvalid={!!errors.department_id}
                      error={errors.department_id?.message}
                    >
                      {departments.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </UnderlineSelect>
                  )}
                />
              </div>
            </div>
          </div>

          {/* ═══ Section 4：聘用信息 ═══ */}
          <div className="editorial-form-section">
            <span className="editorial-section-label">聘用信息</span>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label htmlFor="hire_date" className="form-label">入职日期</label>
                <UnderlineInput
                  id="hire_date"
                  type="date"
                  aria-invalid={!!errors.hire_date}
                  error={errors.hire_date?.message}
                  {...register('hire_date')}
                />
              </div>
              <div>
                <label htmlFor="base_salary" className="form-label">基本工资（元 / 月）</label>
                <UnderlineInput
                  id="base_salary"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="如 5000"
                  aria-invalid={!!errors.base_salary}
                  error={errors.base_salary?.message}
                  {...register('base_salary')}
                />
              </div>
            </div>
          </div>

          {/* ═══ Section 5：权限开关 ═══ */}
          <div className="editorial-form-section">
            <Controller
              control={control}
              name="is_admin"
              render={({ field }) => (
                <label
                  className="flex items-center justify-between cursor-pointer py-1"
                >
                  <div>
                    <span className="text-sm font-medium text-[var(--ink)]">
                      管理员权限
                    </span>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      开启后可访问后台管理功能
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={field.value}
                    onClick={() => field.onChange(!field.value)}
                    className="editorial-switch"
                  >
                    <span
                      className={cn(
                        'editorial-switch-track',
                        field.value && '[aria-checked=true]'
                      )}
                      aria-checked={field.value}
                    >
                      <span className="editorial-switch-thumb" />
                    </span>
                  </button>
                </label>
              )}
            />
          </div>
        </form>

        {/* ── 底部操作栏 ── */}
        <div className="editorial-dialog-footer">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-muted-foreground hover:text-foreground"
          >
            取消
          </Button>
          <Button
            type="button"
            disabled={isSubmitting}
            size="sm"
            onClick={() =>
              void handleSubmit(onSubmit, () =>
                toast.error('请检查表单中标红的字段')
              )()
            }
          >
            {isSubmitting ? '保存中…' : isEdit ? '保存更改' : '确认新增'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
