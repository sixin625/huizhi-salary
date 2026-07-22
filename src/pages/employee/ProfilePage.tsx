import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { useAuthStore } from '@/stores/auth'

function formatCurrency(amount: number): string {
  return `¥${amount.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return dateStr
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}

export default function ProfilePage() {
  const employee = useAuthStore((s) => s.employee)

  if (!employee) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="text-muted-foreground">未找到员工信息</div>
      </div>
    )
  }

  const initials = employee.name.slice(0, 1) || '?'
  const campusName = employee.campus_name ?? '未分配'
  const deptName = employee.department_name ?? '未分配部门'

  return (
    <div className="p-6">
      <div className="glass-card p-4 sm:p-8">
        {/* Header: avatar + name */}
        <div className="flex items-center gap-4">
          <Avatar className="size-16">
            <AvatarFallback className="bg-gradient-to-br from-primary/30 to-primary/30 text-xl font-bold text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              {employee.name}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {deptName}
              {campusName !== '未分配' ? ` · ${campusName}` : ''}
            </p>
          </div>
        </div>

        <Separator className="my-6" />

        {/* Basic info */}
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-foreground">基本信息</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <InfoField label="姓名" value={employee.name} />
            <InfoField label="手机号" value={employee.phone} />
            <InfoField
              label="邮箱"
              value={employee.email ?? '未填写'}
            />
          </div>
        </div>

        <Separator className="my-6" />

        {/* Work info */}
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-foreground">工作信息</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <InfoField
              label="校区"
              value={campusName}
            />
            <InfoField
              label="部门"
              value={deptName}
            />
            <InfoField
              label="入职日期"
              value={formatDate(employee.hire_date)}
            />
            <InfoField
              label="基本工资"
              value={
                employee.base_salary != null
                  ? formatCurrency(employee.base_salary)
                  : '未设置'
              }
            />
          </div>
        </div>
      </div>
    </div>
  )
}
