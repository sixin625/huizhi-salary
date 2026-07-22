import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { toast } from 'sonner'
import {
  PlusIcon,
  SearchIcon,
  PencilIcon,
  PowerIcon,
  ClipboardListIcon,
  UsersIcon,
} from 'lucide-react'
import { employeeApi, campusApi, departmentApi } from '@/lib/api'
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
import { EmployeeForm } from '@/components/EmployeeForm'
import { SalaryTemplateForm } from '@/components/SalaryTemplateForm'
import type {
  Campus,
  Department,
  Employee,
  EmployeeStatus,
} from '@/types/database'

// 员工行（含校区和部门名称 — 后端返回扁平字段）
type EmployeeWithRelations = Employee & {
  campus_name: string | null
  department_name: string | null
}

// 筛选"全部"的哨兵值
const ALL_FILTER = 'all'

export default function EmployeesPage() {
  // ---- 数据状态 ----
  const [employees, setEmployees] = useState<EmployeeWithRelations[]>([])
  const [campuses, setCampuses] = useState<Campus[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)

  // ---- 筛选状态 ----
  const [search, setSearch] = useState('')
  const [campusFilter, setCampusFilter] = useState<string>(ALL_FILTER)
  const [departmentFilter, setDepartmentFilter] = useState<string>(ALL_FILTER)

  // ---- 表单弹窗状态 ----
  const [formOpen, setFormOpen] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)

  // ---- 切换状态 loading ----
  const [togglingId, setTogglingId] = useState<string | null>(null)

  // ---- 薪资模板弹窗状态 ----
  const [templateEmployee, setTemplateEmployee] =
    useState<EmployeeWithRelations | null>(null)
  const [templateOpen, setTemplateOpen] = useState(false)

  // ---- 获取校区列表 ----
  const fetchCampuses = useCallback(async () => {
    try {
      const data = await campusApi.list()
      setCampuses((data ?? []) as Campus[])
    } catch (err) {
      toast.error('获取校区列表失败：' + (err instanceof Error ? err.message : ''))
    }
  }, [])

  // ---- 获取部门列表 ----
  const fetchDepartments = useCallback(async () => {
    try {
      const data = await departmentApi.list()
      setDepartments((data ?? []) as Department[])
    } catch (err) {
      toast.error('获取部门列表失败：' + (err instanceof Error ? err.message : ''))
    }
  }, [])

  // ---- 获取员工列表（含关联名称）----
  const fetchEmployees = useCallback(async () => {
    setLoading(true)
    try {
      const data = await employeeApi.list()
      setEmployees((data ?? []) as EmployeeWithRelations[])
    } catch (err) {
      toast.error('获取员工列表失败：' + (err instanceof Error ? err.message : ''))
    } finally {
      setLoading(false)
    }
  }, [])

  // ---- 初始化加载 ----
  useEffect(() => {
    void Promise.all([fetchCampuses(), fetchDepartments(), fetchEmployees()])
  }, [fetchCampuses, fetchDepartments, fetchEmployees])

  // ---- Select items 映射 ----
  const campusItems = useMemo(() => {
    const map: Record<string, ReactNode> = { [ALL_FILTER]: '全部校区' }
    for (const c of campuses) {
      map[c.id] = c.name
    }
    return map
  }, [campuses])

  const departmentItems = useMemo(() => {
    const map: Record<string, ReactNode> = { [ALL_FILTER]: '全部部门' }
    for (const d of departments) {
      map[d.id] = d.name
    }
    return map
  }, [departments])

  // ---- 筛选后的员工列表 ----
  const filteredEmployees = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    return employees.filter((e) => {
      const matchesSearch =
        !keyword ||
        e.name.toLowerCase().includes(keyword) ||
        e.phone.includes(keyword)
      const matchesCampus =
        campusFilter === ALL_FILTER || e.campus_id === campusFilter
      const matchesDept =
        departmentFilter === ALL_FILTER ||
        e.department_id === departmentFilter
      return matchesSearch && matchesCampus && matchesDept
    })
  }, [employees, search, campusFilter, departmentFilter])

  // ---- 新增员工 ----
  const handleAdd = () => {
    setEditingEmployee(null)
    setFormOpen(true)
  }

  // ---- 编辑员工 ----
  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee)
    setFormOpen(true)
  }

  // ---- 停用/启用 ----
  const handleToggleStatus = async (employee: Employee) => {
    const newStatus: EmployeeStatus =
      employee.status === 'active' ? 'inactive' : 'active'
    setTogglingId(employee.id)
    try {
      await employeeApi.updateStatus(employee.id, newStatus)
      toast.success(newStatus === 'active' ? '已启用' : '已停用')
      void fetchEmployees()
    } catch (err) {
      toast.error('操作失败：' + (err instanceof Error ? err.message : ''))
    } finally {
      setTogglingId(null)
    }
  }

  // ---- 格式化工资 ----
  const formatSalary = (val: number | null): string => {
    if (val == null) return '-'
    return '¥' + val.toLocaleString('zh-CN', { minimumFractionDigits: 2 })
  }

  // ---- 格式化日期 ----
  const formatDate = (val: string): string => {
    if (!val) return '-'
    return val
  }

  return (
    <div className="space-y-6 p-6">
      {/* 页面标题 */}
      <div className="flex items-end justify-between gap-4 anim-fade-up">
        <div>
          <h1 className="text-3xl font-display font-bold text-[var(--ink)] page-title">
            员工管理
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            员工名册 · 校区与部门分配 · 在职状态
          </p>
        </div>
        <Button onClick={handleAdd} className="shrink-0">
          <PlusIcon />
          新增员工
        </Button>
      </div>

      {/* 筛选栏（编辑风：上下细线 + 下划线字段） */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-y border-[var(--ink-rule)] py-3 anim-fade-up">
        {/* 搜索框 */}
        <div className="relative min-w-[200px] flex-1">
          <SearchIcon className="absolute left-0 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="搜索姓名或手机号..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-underline has-icon"
          />
        </div>

        {/* 校区筛选 */}
        <Select
          value={campusFilter}
          onValueChange={(val) => setCampusFilter(val as string)}
          items={campusItems}
        >
          <SelectTrigger className="select-underline sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>全部校区</SelectItem>
            {campuses.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* 部门筛选 */}
        <Select
          value={departmentFilter}
          onValueChange={(val) => setDepartmentFilter(val as string)}
          items={departmentItems}
        >
          <SelectTrigger className="select-underline sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>全部部门</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="ml-auto whitespace-nowrap text-sm text-muted-foreground tabular-nums">
          共 {filteredEmployees.length} 位员工
        </span>
      </div>

      {/* 员工名册列表 */}
      <div className="anim-stagger">
        {loading ? (
          <div className="roster-row flex items-center justify-center py-16 text-sm text-muted-foreground">
            加载中...
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="roster-row flex flex-col items-center gap-2 py-16 text-muted-foreground">
            <UsersIcon className="size-8 opacity-50" />
            <span className="text-sm">暂无员工数据</span>
          </div>
        ) : (
          filteredEmployees.map((emp, idx) => (
            <div
              key={emp.id}
              className={cn(
                'roster-row group flex flex-wrap items-center gap-x-5 gap-y-3 px-1 py-4',
                emp.status === 'inactive' && 'opacity-60',
              )}
            >
              {/* 序号 */}
              <div className="roster-index w-8 shrink-0 text-right">
                {String(idx + 1).padStart(2, '0')}
              </div>

              {/* 姓名 + 元信息 */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-display text-lg font-bold text-[var(--ink)]">
                    {emp.name}
                  </span>
                  {emp.is_admin && (
                    <span className="rounded-none border border-[var(--ink-rule)] px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                      管理员
                    </span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                  <span>{emp.phone || '无手机'}</span>
                  <span className="text-[var(--ink-rule)]">·</span>
                  <span>{emp.email ?? '无邮箱'}</span>
                  <span className="text-[var(--ink-rule)]">·</span>
                  <span>{emp.campus_name ?? '—'}</span>
                  <span className="text-[var(--ink-rule)]">·</span>
                  <span>{emp.department_name ?? '—'}</span>
                  <span className="text-[var(--ink-rule)]">·</span>
                  <span>入职 {formatDate(emp.hire_date)}</span>
                </div>
              </div>

              {/* 基本工资 + 状态 */}
              <div className="shrink-0 text-right">
                <div className="font-display text-lg font-bold text-[var(--ink)] tabular-nums">
                  {formatSalary(emp.base_salary)}
                </div>
                <div
                  className={cn(
                    'mt-0.5 text-xs',
                    emp.status === 'active'
                      ? 'text-[var(--income)]'
                      : 'text-muted-foreground',
                  )}
                >
                  {emp.status === 'active' ? '在职' : '停用'}
                </div>
              </div>

              {/* 操作：编辑风文字链接 */}
              <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-1 pl-2">
                <button className="text-link" onClick={() => handleEdit(emp)}>
                  <PencilIcon />
                  编辑
                </button>
                <button
                  className="text-link"
                  onClick={() => {
                    setTemplateEmployee(emp)
                    setTemplateOpen(true)
                  }}
                >
                  <ClipboardListIcon />
                  薪资模板
                </button>
                <button
                  className="text-link"
                  data-active={emp.status === 'inactive'}
                  onClick={() => handleToggleStatus(emp)}
                  disabled={togglingId === emp.id}
                >
                  <PowerIcon />
                  {emp.status === 'active' ? '停用' : '启用'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 新增/编辑表单弹窗 */}
      <EmployeeForm
        open={formOpen}
        onOpenChange={setFormOpen}
        employee={editingEmployee}
        campuses={campuses}
        departments={departments}
        onSuccess={fetchEmployees}
      />

      {/* 薪资模板弹窗 */}
      <SalaryTemplateForm
        employee={templateEmployee}
        open={templateOpen}
        onOpenChange={setTemplateOpen}
      />
    </div>
  )
}
