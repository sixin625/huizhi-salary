import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { toast } from 'sonner'
import {
  PlusIcon,
  Trash2Icon,
  SaveIcon,
  CalendarDaysIcon,
  UsersIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  CircleDollarSignIcon,
  RefreshCwIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  FileTextIcon,
} from 'lucide-react'
import { salaryApi, employeeApi, campusApi, salaryTemplateApi } from '@/lib/api'
import {
  SALARY_CATALOG,
  templateToFormItems,
  calcItemAmount,
  isTieredConfig,
  type TemplateConfig,
  type SalaryCalcMode,
} from '@/lib/salary-catalog'
import type { TieredConfig } from '@/lib/tiered-types'
import TieredSalaryPanel from './TieredSalaryPanel'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { CountUp } from '@/components/ui/count-up'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type {
  Campus,
  Employee,
  SalaryItemType,
  SalaryRecord,
  SalaryRecordItem,
} from '@/types/database'

// ---- 类型（后端返回扁平字段）----

type EmployeeWithRelations = Employee & {
  campus_name: string | null
  department_name: string | null
}

type SavedRecordWithItems = SalaryRecord & {
  employee_name: string | null
  campus_name: string | null
  department_name: string | null
  items: SalaryRecordItem[]
}

interface SalaryItemForm {
  key: string
  item_name: string
  item_type: SalaryItemType
  amount: string
  remark: string
  // 模板相关字段（可选，仅模板展开的项有值）
  calc_mode?: SalaryCalcMode
  catalog_key?: string
  selected_option?: number
  quantity?: string
  base_amount?: string
  base_salary_full?: string
}

// ---- 常量 ----

const ALL_FILTER = 'all'

let keyCounter = 0
const genKey = () => `item-${++keyCounter}`

const DEFAULT_ITEMS: Omit<SalaryItemForm, 'key'>[] = [
  { item_name: '基本工资', item_type: 'income', amount: '', remark: '' },
  { item_name: '课时费/提成', item_type: 'income', amount: '', remark: '' },
  { item_name: '社保', item_type: 'deduction', amount: '', remark: '' },
  { item_name: '个税', item_type: 'deduction', amount: '', remark: '' },
]

const TYPE_ITEMS: Record<string, ReactNode> = {
  income: '收入',
  deduction: '扣除',
}

// ---- 货币格式化 ----

function formatCurrency(val: number): string {
  return (
    '¥' +
    val.toLocaleString('zh-CN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  )
}

// ---- 获取选项标签（档位/比率显示文本）----

function getOptionLabel(item: SalaryItemForm): string {
  if (!item.catalog_key || item.selected_option === undefined) return ''
  const def = SALARY_CATALOG.find((d) => d.key === item.catalog_key)
  if (!def?.options) return ''
  const opt = def.options.find((o) => o.value === item.selected_option)
  return opt?.label ?? ''
}

// ---- 组件 ----

export default function SalaryInputPage() {
  const { user } = useAuthStore()

  // ---- 数据状态 ----
  const [campuses, setCampuses] = useState<Campus[]>([])
  const [employees, setEmployees] = useState<EmployeeWithRelations[]>([])
  const [loading, setLoading] = useState(true)

  // ---- 选择状态 ----
  const [yearMonth, setYearMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [campusFilter, setCampusFilter] = useState<string>(ALL_FILTER)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('')

  // ---- 已保存记录状态 ----
  const [savedRecords, setSavedRecords] = useState<SavedRecordWithItems[]>([])
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  // ---- 薪资项状态 ----
  const [items, setItems] = useState<SalaryItemForm[]>([])
  const [saving, setSaving] = useState(false)

  // ---- 阶梯模板状态 ----
  const [tieredMode, setTieredMode] = useState(false)
  const [tieredConfig, setTieredConfig] = useState<TieredConfig | null>(null)

  // ---- 业绩/绩效工资状态 ----
  const [lecturerActual, setLecturerActual] = useState<number>(0)
  const [lecturerTarget, setLecturerTarget] = useState<number>(0)

  // ---- 获取校区列表 ----
  const fetchCampuses = useCallback(async () => {
    try {
      const data = await campusApi.list()
      setCampuses((data ?? []) as Campus[])
    } catch (err) {
      toast.error('获取校区列表失败：' + (err instanceof Error ? err.message : ''))
    }
  }, [])

  // ---- 获取员工列表（仅在职）----
  const fetchEmployees = useCallback(async () => {
    setLoading(true)
    try {
      const data = await employeeApi.list()
      // 后端不支持 status 筛选，前端过滤在职员工
      const activeEmployees = ((data ?? []) as EmployeeWithRelations[]).filter(
        (e) => e.status === 'active',
      )
      setEmployees(activeEmployees)
    } catch (err) {
      toast.error('获取员工列表失败：' + (err instanceof Error ? err.message : ''))
    } finally {
      setLoading(false)
    }
  }, [])

  // ---- 获取已保存记录 ----
  const fetchSavedRecords = useCallback(async () => {
    if (!yearMonth) return
    try {
      const data = await salaryApi.list(yearMonth)
      setSavedRecords((data ?? []) as SavedRecordWithItems[])
    } catch {
      // 静默失败
    }
  }, [yearMonth])

  // ---- 月份变化时加载已保存记录 ----
  useEffect(() => {
    void fetchSavedRecords()
  }, [fetchSavedRecords])

  // ---- 展开/收起 ----
  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ---- 初始化加载 ----
  useEffect(() => {
    void Promise.all([fetchCampuses(), fetchEmployees()])
  }, [fetchCampuses, fetchEmployees])

  // ---- Select items 映射 ----
  const campusItems = useMemo(() => {
    const map: Record<string, ReactNode> = { [ALL_FILTER]: '全部校区' }
    for (const c of campuses) {
      map[c.id] = c.name
    }
    return map
  }, [campuses])

  // ---- 检测绩效工资项 ----
  const hasPerfItem = useMemo(() =>
    items.some(i => i.item_name?.includes('绩效工资')),
    [items]
  )

  // ---- 绩效工资自动计算 ----
  useEffect(() => {
    if (!hasPerfItem || lecturerTarget <= 0) return
    const ratio = lecturerActual / lecturerTarget
    setItems(prev => prev.map(item => {
      if (item.item_name?.includes('绩效工资') && item.base_salary_full) {
        const fullBase = parseFloat(item.base_salary_full) || 0
        const perfAmount = Math.round(fullBase * 0.4 * ratio * 100) / 100
        const ratioPercent = Math.round(ratio * 1000) / 10
        return {
          ...item,
          amount: String(perfAmount),
          remark: `达成率${ratioPercent}%`
        }
      }
      return item
    }))
  }, [lecturerActual, lecturerTarget, hasPerfItem])

  // ---- 按校区筛选的员工列表 ----
  const filteredEmployees = useMemo(() => {
    if (campusFilter === ALL_FILTER) return employees
    return employees.filter((e) => e.campus_id === campusFilter)
  }, [employees, campusFilter])

  const employeeItems = useMemo(() => {
    const map: Record<string, ReactNode> = {}
    for (const e of filteredEmployees) {
      map[e.id] = e.name
    }
    return map
  }, [filteredEmployees])

  // ---- 选中员工 ----
  const selectedEmployee = useMemo(() => {
    return employees.find((e) => e.id === selectedEmployeeId) ?? null
  }, [employees, selectedEmployeeId])

  // ---- 校区筛选变化时重置员工选择 ----
  const handleCampusChange = (val: string) => {
    setCampusFilter(val)
    setSelectedEmployeeId('')
  }

  // ---- 加载已有记录 ----
  useEffect(() => {
    if (!selectedEmployeeId || !yearMonth) {
      setItems([])
      setTieredMode(false)
      setTieredConfig(null)
      setLecturerActual(0)
      setLecturerTarget(0)
      return
    }

    let cancelled = false

    const loadRecord = async () => {
      try {
        // 后端按年月返回所有记录，前端按 employee_id 筛选
        const allRecords = await salaryApi.list(yearMonth)
        if (cancelled) return

        const recordData = (allRecords ?? []).find(
          (r: any) => r.employee_id === selectedEmployeeId,
        ) as (SalaryRecord & { items: SalaryRecordItem[] }) | undefined

        if (recordData?.items?.length) {
          // 已有记录：阶梯模式关闭
          setTieredMode(false)
          setTieredConfig(null)
          // 加载已有明细
          setItems(
            recordData.items.map((item) => ({
              key: genKey(),
              item_name: item.item_name,
              item_type: item.item_type,
              amount: String(item.amount),
              remark: item.remark ?? '',
            })),
          )
        } else {
          // 优先尝试加载模板
          try {
            const templateResp = await salaryTemplateApi.get(selectedEmployeeId)
            const employee = employees.find((e) => e.id === selectedEmployeeId)
            const baseSalary = employee?.base_salary ?? 0

            if (templateResp?.config) {
              const tplConfig = templateResp.config
              if (isTieredConfig(tplConfig)) {
                setTieredMode(true)
                setTieredConfig(tplConfig as TieredConfig)
                setItems([])
                return
              }
              setTieredMode(false)
              setTieredConfig(null)
              const templateItems = templateToFormItems(tplConfig, baseSalary)
              if (templateItems.length > 0) {
                setItems(templateItems as SalaryItemForm[])
                return
              }
            }
            // 无模板或模板无 enabled 项：回退到 DEFAULT_ITEMS
            setTieredMode(false)
            setTieredConfig(null)
            setItems(
              DEFAULT_ITEMS.map((d) => ({
                ...d,
                key: genKey(),
                amount: d.item_name === '基本工资' && baseSalary ? String(baseSalary) : d.amount,
              })),
            )
          } catch {
            // 模板加载失败也回退到默认
            setTieredMode(false)
            setTieredConfig(null)
            const employee = employees.find((e) => e.id === selectedEmployeeId)
            const baseSalary = employee?.base_salary ?? 0
            setTieredMode(false)
            setTieredConfig(null)
            setItems(
              DEFAULT_ITEMS.map((d) => ({
                ...d,
                key: genKey(),
                amount: d.item_name === '基本工资' && baseSalary ? String(baseSalary) : d.amount,
              })),
            )
          }
        }
      } catch (err) {
        if (!cancelled) {
          toast.error('加载已有记录失败：' + (err instanceof Error ? err.message : ''))
        }
      }
    }

    void loadRecord()

    return () => {
      cancelled = true
    }
  }, [selectedEmployeeId, yearMonth, employees])

  // ---- 实时计算 ----
  const grossTotal = useMemo(() => {
    return items
      .filter((i) => i.item_type === 'income')
      .reduce((sum, i) => sum + calcItemAmount(i), 0)
  }, [items])

  const deductionTotal = useMemo(() => {
    return items
      .filter((i) => i.item_type === 'deduction')
      .reduce((sum, i) => sum + calcItemAmount(i), 0)
  }, [items])

  const netTotal = grossTotal - deductionTotal

  // ---- 薪资项操作 ----
  const addItem = () => {
    setItems((prev) => [
      ...prev,
      {
        key: genKey(),
        item_name: '',
        item_type: 'income' as SalaryItemType,
        amount: '',
        remark: '',
      },
    ])
  }

  const removeItem = (key: string) => {
    setItems((prev) => prev.filter((i) => i.key !== key))
  }

  const updateItem = (key: string, patch: Partial<SalaryItemForm>) => {
    setItems((prev) =>
      prev.map((i) => (i.key === key ? { ...i, ...patch } : i)),
    )
  }

  // ---- 应用模板 ----
  const handleApplyTemplate = async () => {
    if (!selectedEmployeeId) {
      toast.error('请先选择员工')
      return
    }
    try {
      const templateResp = await salaryTemplateApi.get(selectedEmployeeId)
      if (!templateResp?.config) {
        toast.error('该员工尚未配置薪资模板')
        return
      }
      const config: TemplateConfig = templateResp.config
      if (isTieredConfig(config)) {
        setTieredMode(true)
        setTieredConfig(config as TieredConfig)
        toast.success('已应用阶梯提成模板')
        return
      }
      setTieredMode(false)
      setTieredConfig(null)
      const employee = employees.find((e) => e.id === selectedEmployeeId)
      const baseSalary = employee?.base_salary ?? 0
      const templateItems = templateToFormItems(config, baseSalary)
      if (templateItems.length === 0) {
        toast.error('模板中未启用任何薪资项')
        return
      }
      setItems(templateItems as SalaryItemForm[])
      toast.success('已应用薪资模板')
    } catch (err) {
      toast.error('应用模板失败：' + (err instanceof Error ? err.message : ''))
    }
  }

  // ---- 保存 ----
  const handleSave = async () => {
    if (!selectedEmployeeId || !yearMonth || !user) {
      toast.error('请选择员工和月份')
      return
    }

    const employee = employees.find((e) => e.id === selectedEmployeeId)
    if (!employee) {
      toast.error('未找到员工信息')
      return
    }

    // 校验：至少有一个有效项
    const validItems = items.filter((i) => {
      const amt = calcItemAmount(i)
      return i.item_name.trim() !== '' && amt > 0
    })
    if (validItems.length === 0) {
      toast.error('请至少添加一个有效的薪资项')
      return
    }

    setSaving(true)

    try {
      // 后端自动处理 upsert（employee_id+year_month 唯一约束）
      // 并删除旧明细、插入新明细，created_by 由服务端从 JWT 设置
      await salaryApi.save({
        employee_id: selectedEmployeeId,
        year_month: yearMonth,
        campus_id: employee.campus_id,
        department_id: employee.department_id,
        gross_salary: grossTotal,
        total_deduction: deductionTotal,
        net_salary: netTotal,
        items: validItems.map((item) => ({
          item_name: item.item_name.trim(),
          item_type: item.item_type,
          amount: calcItemAmount(item),
          remark: item.remark.trim() || null,
        })),
      })

      toast.success('薪资记录已保存')
      void fetchSavedRecords()
    } catch (err) {
      const msg = err instanceof Error ? err.message : '未知错误'
      toast.error('保存失败：' + msg)
    } finally {
      setSaving(false)
    }
  }

  // ---- 删除已保存记录 ----
  const handleDeleteRecord = async (id: string) => {
    if (!window.confirm('确定要删除这条薪资记录吗？删除后不可恢复。')) return
    try {
      await salaryApi.remove(id)
      toast.success('记录已删除')
      fetchSavedRecords()
    } catch (err) {
      toast.error('删除失败：' + (err instanceof Error ? err.message : '未知错误'))
    }
  }

  // ---- 渲染 ----
  return (
    <div className="space-y-4 p-6">
      {/* 页面标题 */}
      <div className="anim-fade-up">
        <h1 className="text-3xl font-display font-bold text-[var(--ink)] page-title">
          薪资录入
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          为员工录入月度薪资明细 · 支持收入与扣除项的动态管理
        </p>
      </div>

      {/* 主内容 — 两列布局 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr] anim-stagger">
        {/* 左侧：选择控制区 */}
        <div className="glass-card space-y-5 p-5">
          {/* 月份选择 */}
          <div className="space-y-1.5">
            <Label
              htmlFor="year-month"
              className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground"
            >
              <CalendarDaysIcon className="size-3.5" />
              月份
            </Label>
            <Input
              id="year-month"
              type="month"
              value={yearMonth}
              onChange={(e) => setYearMonth(e.target.value)}
              className="input-underline"
            />
          </div>

          {/* 校区筛选 */}
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              校区筛选
            </Label>
            <Select
              value={campusFilter}
              onValueChange={(val) => handleCampusChange(val as string)}
              items={campusItems}
            >
              <SelectTrigger className="select-underline w-full">
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
          </div>

          {/* 员工选择 */}
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              选择员工
            </Label>
            {loading ? (
              <div className="flex h-8 items-center border-b border-[var(--ink-rule)] px-0.5 text-sm text-muted-foreground">
                加载中...
              </div>
            ) : filteredEmployees.length === 0 ? (
              <div className="flex h-8 items-center border-b border-[var(--ink-rule)] px-0.5 text-sm text-muted-foreground">
                无可选员工
              </div>
            ) : (
              <Select
                value={selectedEmployeeId || null}
                onValueChange={(val) =>
                  setSelectedEmployeeId((val as string) ?? '')
                }
                items={employeeItems}
              >
                <SelectTrigger className="select-underline w-full">
                  <SelectValue placeholder="请选择员工" />
                </SelectTrigger>
                <SelectContent>
                  {filteredEmployees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* 选中员工信息 */}
          {selectedEmployee && (
            <div className="space-y-3 border-t-2 border-[var(--ink)] pt-4">
              <div className="flex items-center gap-2">
                <UsersIcon className="size-4 text-muted-foreground" />
                <span className="font-display text-lg font-bold text-[var(--ink)]">
                  {selectedEmployee.name}
                </span>
                {selectedEmployee.is_admin && (
                  <span className="border border-[var(--ink-rule)] px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                    管理员
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
                <div className="border-t border-[var(--ink-rule)] pt-1.5">
                  <span className="text-xs text-muted-foreground">校区</span>
                  <p className="mt-0.5">{selectedEmployee.campus_name ?? '-'}</p>
                </div>
                <div className="border-t border-[var(--ink-rule)] pt-1.5">
                  <span className="text-xs text-muted-foreground">部门</span>
                  <p className="mt-0.5">
                    {selectedEmployee.department_name ?? '-'}
                  </p>
                </div>
                <div className="border-t border-[var(--ink-rule)] pt-1.5">
                  <span className="text-xs text-muted-foreground">基本工资</span>
                  <p className="mt-0.5 font-mono">
                    {formatCurrency(selectedEmployee.base_salary ?? 0)}
                  </p>
                </div>
                <div className="border-t border-[var(--ink-rule)] pt-1.5">
                  <span className="text-xs text-muted-foreground">入职日期</span>
                  <p className="mt-0.5">{selectedEmployee.hire_date}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 右侧：薪资项录入区 */}
        <div className="glass-card space-y-5 p-5">
          {selectedEmployee ? (
            tieredMode && tieredConfig ? (
              <TieredSalaryPanel
                key={selectedEmployeeId}
                employee={selectedEmployee}
                template={tieredConfig}
                yearMonth={yearMonth}
                employees={employees}
              />
            ) : (
            <>
              {/* 表单标题 + 添加按钮 */}
              <div className="flex items-end justify-between border-b border-[var(--ink-rule)] pb-3">
                <div>
                  <h2 className="font-display text-lg font-bold text-[var(--ink)]">
                    薪资项目
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {yearMonth} 薪资明细
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleApplyTemplate}>
                    <RefreshCwIcon />
                    应用模板
                  </Button>
                  <Button variant="outline" size="sm" onClick={addItem}>
                    <PlusIcon />
                    添加项目
                  </Button>
                </div>
              </div>

              {/* 业绩输入（绩效工资联动） */}
              {!tieredMode && hasPerfItem && (
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">实际业绩</Label>
                    <Input
                      type="number"
                      value={lecturerActual || ''}
                      onChange={(e) => setLecturerActual(Number(e.target.value))}
                      placeholder="0"
                      className="input-underline"
                    />
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">目标业绩</Label>
                    <Input
                      type="number"
                      value={lecturerTarget || ''}
                      onChange={(e) => setLecturerTarget(Number(e.target.value))}
                      placeholder="0"
                      className="input-underline"
                    />
                  </div>
                </div>
              )}

              {/* 薪资项列表 */}
              <div className="space-y-2 overflow-x-auto">
                {/* 表头 */}
                <div className="item-head grid min-w-[560px] grid-cols-[1fr_90px_120px_1fr_36px] gap-2 px-1">
                  <span>项目名称</span>
                  <span>类型</span>
                  <span className="text-right">金额</span>
                  <span>备注</span>
                  <span></span>
                </div>

                {/* 行 */}
                {items.map((item) => {
                  // 备注 + 删除按钮（所有模式通用）
                  const remarkInput = (
                    <Input
                      value={item.remark}
                      onChange={(e) =>
                        updateItem(item.key, { remark: e.target.value })
                      }
                      placeholder="备注（可选）"
                      className="input-underline"
                    />
                  )
                  const deleteBtn = (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeItem(item.key)}
                    >
                      <Trash2Icon />
                    </Button>
                  )

                  // ---- 底薪 (source) / 手动输入 (manual_input)：金额可编辑 ----
                  // 绩效工资行只读化
                  const isPerfRow = item.item_name?.includes('绩效工资')
                  if (item.calc_mode === 'source' || item.calc_mode === 'manual_input') {
                    return (
                      <div
                        key={item.key}
                        className={cn(
                          "grid min-w-[560px] grid-cols-[1fr_90px_120px_1fr_36px] items-center gap-2",
                          isPerfRow && "bg-muted/50 rounded-md px-1"
                        )}
                      >
                        <div className="flex h-9 items-center px-2 text-sm">
                          {item.item_name}
                        </div>
                        <div className="flex h-9 items-center justify-center text-sm text-muted-foreground">
                          {TYPE_ITEMS[item.item_type]}
                        </div>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.amount}
                          onChange={(e) =>
                            updateItem(item.key, { amount: e.target.value })
                          }
                          placeholder="0.00"
                          className={cn("text-right font-mono input-underline", isPerfRow && "bg-muted/50")}
                          readOnly={isPerfRow}
                        />
                        {remarkInput}
                        {deleteBtn}
                      </div>
                    )
                  }

                  // ---- 按量计算 (per_unit)：档位 + 数量 ----
                  if (item.calc_mode === 'per_unit') {
                    return (
                      <div
                        key={item.key}
                        className="grid min-w-[640px] grid-cols-[1fr_100px_80px_100px_1fr_36px] items-center gap-2"
                      >
                        <div className="flex h-9 items-center px-2 text-sm">
                          {item.item_name}
                        </div>
                        <div className="flex h-9 items-center justify-center px-1 text-sm text-muted-foreground">
                          {getOptionLabel(item)}
                        </div>
                        <Input
                          type="number"
                          step="1"
                          min="0"
                          value={item.quantity ?? ''}
                          onChange={(e) =>
                            updateItem(item.key, { quantity: e.target.value })
                          }
                          placeholder="数量"
                          className="text-right font-mono input-underline"
                        />
                        <div className="flex h-9 items-center justify-end px-2 font-mono text-sm">
                          {calcItemAmount(item).toFixed(2)}
                        </div>
                        {remarkInput}
                        {deleteBtn}
                      </div>
                    )
                  }

                  // ---- 按比率计算 (percentage)：比率 + 基数 ----
                  if (item.calc_mode === 'percentage') {
                    return (
                      <div
                        key={item.key}
                        className="grid min-w-[640px] grid-cols-[1fr_100px_80px_100px_1fr_36px] items-center gap-2"
                      >
                        <div className="flex h-9 items-center px-2 text-sm">
                          {item.item_name}
                        </div>
                        <div className="flex h-9 items-center justify-center px-1 text-sm text-muted-foreground">
                          {getOptionLabel(item)}
                        </div>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.base_amount ?? ''}
                          onChange={(e) =>
                            updateItem(item.key, { base_amount: e.target.value })
                          }
                          placeholder="基数"
                          className="text-right font-mono input-underline"
                        />
                        <div className="flex h-9 items-center justify-end px-2 font-mono text-sm">
                          {calcItemAmount(item).toFixed(2)}
                        </div>
                        {remarkInput}
                        {deleteBtn}
                      </div>
                    )
                  }

                  // ---- 手动添加的项（无 calc_mode）：全部可编辑 ----
                  return (
                    <div
                      key={item.key}
                      className="grid min-w-[560px] grid-cols-[1fr_90px_120px_1fr_36px] items-center gap-2"
                    >
                      <Input
                        value={item.item_name}
                        onChange={(e) =>
                          updateItem(item.key, { item_name: e.target.value })
                        }
                        placeholder="项目名称"
                        className="input-underline"
                      />
                      <Select
                        value={item.item_type}
                        onValueChange={(val) =>
                          updateItem(item.key, {
                            item_type: (val as SalaryItemType) ?? 'income',
                          })
                        }
                        items={TYPE_ITEMS}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="income">收入</SelectItem>
                          <SelectItem value="deduction">扣除</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.amount}
                        onChange={(e) =>
                          updateItem(item.key, { amount: e.target.value })
                        }
                        placeholder="0.00"
                        className="text-right font-mono input-underline"
                      />
                      {remarkInput}
                      {deleteBtn}
                    </div>
                  )
                })}

                {items.length === 0 && (
                  <div className="flex h-20 items-center justify-center border-t-2 border-dashed border-[var(--ink-rule)] text-sm text-muted-foreground">
                    暂无薪资项，点击"添加项目"开始录入
                  </div>
                )}
              </div>

              {/* 实时计算预览 — 编辑风合计区块 */}
              <div className="editorial-summary grid grid-cols-3">
                <div>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <TrendingUpIcon className="size-3.5" />
                    应发合计
                  </div>
                  <p className="mt-1 text-2xl font-display font-bold text-[var(--income)]">
                    <CountUp value={grossTotal} />
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <TrendingDownIcon className="size-3.5" />
                    扣除合计
                  </div>
                  <p className="mt-1 text-2xl font-display font-bold text-[var(--deduction)]">
                    <CountUp value={deductionTotal} />
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <CircleDollarSignIcon className="size-3.5" />
                    实发金额
                  </div>
                  <p className="mt-1 text-2xl font-display font-bold text-[var(--ink)]">
                    <CountUp value={netTotal} />
                  </p>
                </div>
              </div>

              {/* 保存按钮 */}
              <div className="flex justify-end">
                <Button
                  onClick={handleSave}
                  disabled={saving || !selectedEmployeeId}
                >
                  <SaveIcon />
                  {saving ? '保存中...' : '保存记录'}
                </Button>
              </div>
            </>
            )
          ) : (
            <div className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
              <UsersIcon className="size-10 opacity-40" />
              <p>请先选择员工开始录入薪资</p>
            </div>
          )}
        </div>
      </div>
      {/* 已保存记录列表 */}
      {savedRecords.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--ink-rule)] px-4 py-3">
            <div className="flex items-center gap-2">
              <FileTextIcon className="size-4 text-muted-foreground" />
              <h2 className="font-display text-base font-bold text-[var(--ink)]">已保存记录</h2>
              <span className="text-xs text-muted-foreground">
                共 {savedRecords.length} 条
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--ink-rule)] text-xs text-muted-foreground">
                  <th className="w-8 px-2 py-2"></th>
                  <th className="min-w-[80px] px-2 py-2 text-left font-medium">员工</th>
                  <th className="min-w-[80px] px-2 py-2 text-left font-medium">校区</th>
                  <th className="min-w-[80px] px-2 py-2 text-left font-medium">部门</th>
                  <th className="min-w-[100px] px-2 py-2 text-right font-medium">收入合计</th>
                  <th className="min-w-[100px] px-2 py-2 text-right font-medium">扣除合计</th>
                  <th className="min-w-[100px] px-2 py-2 text-right font-medium">实发工资</th>
                  <th className="w-10 px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {savedRecords.map((record) => (
                  <Fragment key={record.id}>
                    {/* 主行 */}
                    <tr className="border-b border-[var(--ink-rule)] hover:bg-muted/40">
                      <td className="px-2 py-2">
                        <button
                          onClick={() => toggleExpand(record.id)}
                          className="flex size-6 items-center justify-center rounded hover:bg-muted"
                        >
                          {expandedIds.has(record.id) ? (
                            <ChevronDownIcon className="size-4" />
                          ) : (
                            <ChevronRightIcon className="size-4" />
                          )}
                        </button>
                      </td>
                      <td className="px-2 py-2 font-medium">
                        {record.employee_name ?? '-'}
                      </td>
                      <td className="px-2 py-2 text-muted-foreground">
                        {record.campus_name ?? '-'}
                      </td>
                      <td className="px-2 py-2 text-muted-foreground">
                        {record.department_name ?? '-'}
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-[var(--income)]">
                        {formatCurrency(record.gross_salary)}
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-[var(--deduction)]">
                        {formatCurrency(record.total_deduction)}
                      </td>
                      <td className="px-2 py-2 text-right font-mono font-bold">
                        {formatCurrency(record.net_salary)}
                      </td>
                      <td className="px-2 py-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteRecord(record.id)
                          }}
                          title="删除记录"
                        >
                          <Trash2Icon className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>

                    {/* 展开行 — 明细 */}
                    {expandedIds.has(record.id) && (
                      <tr className="hover:bg-transparent">
                        <td colSpan={8} className="bg-muted/20 p-4">
                          <div className="space-y-2">
                            <h4 className="text-sm font-medium text-foreground">
                              薪资明细
                            </h4>
                            {record.items && record.items.length > 0 ? (
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="border-b border-[var(--ink-rule)] text-xs text-muted-foreground">
                                      <th className="px-2 py-1 text-left font-medium">项目名称</th>
                                      <th className="px-2 py-1 text-left font-medium">类型</th>
                                      <th className="px-2 py-1 text-right font-medium">金额</th>
                                      <th className="px-2 py-1 text-left font-medium">备注</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {record.items.map((item) => (
                                      <tr key={item.id} className="border-b border-[var(--ink-rule)]">
                                        <td className="px-2 py-1.5">{item.item_name}</td>
                                        <td className="px-2 py-1.5">
                                          <span
                                            className={cn(
                                              'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
                                              item.item_type === 'income'
                                              ? 'bg-[var(--income-soft)] text-[var(--income)] border-[var(--income-soft)]'
                                              : 'bg-[var(--deduction-soft)] text-[var(--deduction)] border-[var(--deduction-soft)]',
                                            )}
                                          >
                                            {item.item_type === 'income' ? '收入' : '扣除'}
                                          </span>
                                        </td>
                                        <td
                                          className={cn(
                                            'px-2 py-1.5 text-right font-mono',
                                            item.item_type === 'income'
                                              ? 'text-[var(--income)]'
                                              : 'text-[var(--deduction)]',
                                          )}
                                        >
                                          {formatCurrency(item.amount)}
                                        </td>
                                        <td className="px-2 py-1.5 text-muted-foreground">
                                          {item.remark ?? '-'}
                                        </td>
                                      </tr>
                                    ))}
                                    {/* 汇总行 */}
                                    <tr className="border-t border-border/50 font-bold">
                                      <td className="px-2 py-1.5" colSpan={2}>汇总</td>
                                      <td className="px-2 py-1.5 text-right">
                                        <span className="text-[var(--income)]">
                                          收入 {formatCurrency(record.gross_salary)}
                                        </span>
                                        <span className="mx-2 text-muted-foreground">|</span>
                                        <span className="text-[var(--deduction)]">
                                          扣除 {formatCurrency(record.total_deduction)}
                                        </span>
                                        <span className="mx-2 text-muted-foreground">|</span>
                                        <span className="text-primary">
                                          实发 {formatCurrency(record.net_salary)}
                                        </span>
                                      </td>
                                      <td></td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground">
                                暂无明细数据
                              </p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
