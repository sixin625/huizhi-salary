import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  CircleDollarSignIcon,
  UsersIcon,
  WalletIcon,
  ReceiptIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  ArrowRightIcon,
  CalendarIcon,
  Building2Icon,
  BriefcaseIcon,
  FileTextIcon,
  MinusIcon,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { dashboardApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import { CountUp } from '@/components/ui/count-up'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { SalaryRecordStatus } from '@/types/database'

// ============================================================
// 工具函数
// ============================================================

function formatMonthLabel(ym: string): string {
  const [, month] = ym.split('-')
  return `${parseInt(month, 10)}月`
}

function formatYearLabel(ym: string): string {
  const [year, month] = ym.split('-')
  return `${year}年${parseInt(month, 10)}月`
}

function formatCurrency(val: number): string {
  return '¥' + (Number(val) || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatCompact(val: number): string {
  const n = Number(val) || 0
  if (Math.abs(n) >= 10000) return '¥' + (n / 10000).toFixed(1) + '万'
  return formatCurrency(n)
}

// ============================================================
// 图表配色 & 样式（象牙金高级风）
// ============================================================

const CHART_COLORS = ['#B89455', '#3FA98C', '#7E9CB8', '#C9A66B', '#A6814F', '#5E7080']

const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    backdropFilter: 'blur(8px)',
    border: '1px solid hsl(0 0% 90%)',
    borderRadius: '8px',
    color: 'hsl(0 0% 10%)',
    fontSize: '13px',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07)',
  },
  labelStyle: { color: 'hsl(0 0% 45%)', marginBottom: '4px' },
  itemStyle: { color: 'hsl(0 0% 10%)' },
} as const

// 环比变化指示
function ChangeBadge({ pct, invert = false }: { pct: number | null; invert?: boolean }) {
  if (pct === null) {
    return (
      <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
        <MinusIcon className="size-3" /> 环比持平
      </span>
    )
  }
  const up = pct >= 0
  // 默认“上升=利好(绿)”；invert 用于扣款类指标（上升=不利）
  const good = invert ? !up : up
  const color = good ? 'text-[var(--income)]' : 'text-[var(--deduction)]'
  return (
    <span className={cn('flex items-center gap-0.5 text-xs', color)}>
      {up ? <TrendingUpIcon className="size-3" /> : <TrendingDownIcon className="size-3" />}
      {up ? '+' : ''}
      {pct.toFixed(1)}%
    </span>
  )
}

// ============================================================
// 类型
// ============================================================

type MonthlyData = {
  month: string
  prevMonth: string
  defaultMonth: string
  currentMonth: string
  availableMonths: string[]
  summary: {
    netTotal: number
    grossTotal: number
    deductionTotal: number
    recordCount: number
    paidCount: number
    publishedCount: number
    draftCount: number
    avgNet: number
  }
  comparison: {
    prevMonth: string
    netTotalPrev: number
    grossTotalPrev: number
    paidCountPrev: number
    netChange: number
    netChangePct: number | null
    grossChangePct: number | null
    paidChange: number
  }
  trend: { year_month: string; month: string; total: number }[]
  campusBreakdown: { name: string; net: number; count: number }[]
  departmentBreakdown: { name: string; net: number; count: number }[]
  detail: {
    id: string
    employee_id: string
    employee_name: string | null
    campus_name: string | null
    department_name: string | null
    gross_salary: number
    total_deduction: number
    net_salary: number
    status: SalaryRecordStatus
  }[]
}

// ============================================================
// 组件
// ============================================================

export default function DashboardPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<MonthlyData | null>(null)
  const [selectedMonth, setSelectedMonth] = useState<string>('')
  const [availableMonths, setAvailableMonths] = useState<string[]>([])

  const load = useCallback(async (month?: string) => {
    setLoading(true)
    try {
      const res = await dashboardApi.monthly(month)
      setData(res)
      setAvailableMonths(res.availableMonths ?? [])
      setSelectedMonth(res.month)
    } catch (err) {
      toast.error('获取看板数据失败：' + (err instanceof Error ? err.message : ''))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const handleMonthChange = (m: string | null) => {
    if (!m) return
    setSelectedMonth(m)
    void load(m)
  }

  const summary = data?.summary
  const comparison = data?.comparison
  const hasData = (summary?.recordCount ?? 0) > 0

  const trendData = useMemo(
    () => (data?.trend ?? []).map((t) => ({ month: t.month, total: t.total })),
    [data],
  )

  const campusComparison = useMemo(
    () => (data?.campusBreakdown ?? []).filter((c) => c.net > 0),
    [data],
  )

  const departmentRatio = useMemo(
    () =>
      (data?.departmentBreakdown ?? [])
        .map((d, i) => ({ name: d.name, value: d.net, color: CHART_COLORS[i % CHART_COLORS.length] }))
        .filter((d) => d.value > 0),
    [data],
  )

  const detail = useMemo(() => data?.detail ?? [], [data])

  // 加载骨架
  if (loading && !data) {
    return (
      <div className="space-y-4 p-6">
        <div>
          <div className="h-8 w-48 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-4 w-64 animate-pulse rounded bg-muted/60" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="glass-card h-32 animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="glass-card h-80 animate-pulse lg:col-span-2" />
          <div className="glass-card h-80 animate-pulse" />
          <div className="glass-card h-80 animate-pulse" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-6">
      {/* 标题 + 月份选择器 */}
      <div className="flex flex-col gap-3 anim-fade-up sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground page-title">数据看板</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            薪资统计与数据分析 · 按月查看核心指标
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CalendarIcon className="size-4 text-muted-foreground" />
          <Select value={selectedMonth} onValueChange={handleMonthChange}>
            <SelectTrigger className="w-[168px] bg-card">
              <SelectValue placeholder="选择月份" />
            </SelectTrigger>
            <SelectContent>
              {availableMonths.map((m) => (
                <SelectItem key={m} value={m}>
                  {formatYearLabel(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!hasData ? (
        // 该月暂无数据
        <div className="glass-card flex flex-col items-center justify-center gap-3 py-24 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-muted/60">
            <FileTextIcon className="size-7 text-muted-foreground/60" />
          </div>
          <div>
            <p className="text-base font-medium text-foreground">
              {data ? formatYearLabel(data.month) : ''} 暂无薪资数据
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              该月份尚未录入薪资记录，切换其他月份或前往「薪资录入」添加。
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/admin/salary/input')}>
            去录入薪资
            <ArrowRightIcon className="size-4" />
          </Button>
        </div>
      ) : (
        <>
          {/* KPI 卡片 */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 anim-stagger editorial-kpi">
            {/* 实发总额 */}
            <div className="glass-card glass-card-hover p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
                  <CircleDollarSignIcon className="size-5 text-primary" />
                </div>
                实发总额
              </div>
              <p className="mt-3 text-2xl font-semibold text-foreground kpi-val">
                <CountUp value={summary!.netTotal} format={formatCompact} />
              </p>
              <div className="mt-1 flex items-center justify-between">
                <ChangeBadge pct={comparison!.netChangePct} />
                <span className="text-xs text-muted-foreground">较 {formatMonthLabel(comparison!.prevMonth)}</span>
              </div>
            </div>

            {/* 应发总额 */}
            <div className="glass-card glass-card-hover p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
                  <WalletIcon className="size-5 text-primary" />
                </div>
                应发总额
              </div>
              <p className="mt-3 text-2xl font-semibold text-foreground kpi-val">
                <CountUp value={summary!.grossTotal} format={formatCompact} />
              </p>
              <div className="mt-1 flex items-center justify-between">
                <ChangeBadge pct={comparison!.grossChangePct} />
                <span className="text-xs text-muted-foreground">较上月</span>
              </div>
            </div>

            {/* 扣款总额 */}
            <div className="glass-card glass-card-hover p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
                  <ReceiptIcon className="size-5 text-primary" />
                </div>
                扣款总额
              </div>
              <p className="mt-3 text-2xl font-semibold text-foreground kpi-val">
                <CountUp value={summary!.deductionTotal} format={formatCompact} />
              </p>
              <div className="mt-1 text-xs text-muted-foreground">
                占应发{' '}
                {summary!.grossTotal > 0
                  ? ((summary!.deductionTotal / summary!.grossTotal) * 100).toFixed(1)
                  : '0.0'}
                %
              </div>
            </div>

            {/* 发薪人数 */}
            <div className="glass-card glass-card-hover p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
                  <UsersIcon className="size-5 text-primary" />
                </div>
                发薪人数
              </div>
              <p className="mt-3 text-2xl font-semibold text-foreground kpi-val">
                <CountUp value={summary!.paidCount} decimals={0} />
                <span className="ml-1 text-sm font-normal text-muted-foreground">人</span>
              </p>
              <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  记录 {summary!.recordCount} 条 · 发布 {summary!.publishedCount}/草稿 {summary!.draftCount}
                </span>
              </div>
            </div>
          </div>

          {/* 图表区 */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 anim-stagger">
            {/* 趋势 */}
            <div className="glass-card p-4 lg:col-span-2">
              <h3 className="mb-4 text-sm font-medium text-foreground section-title">
                薪资趋势（近 12 个月 · 截至 {data?.month ? formatYearLabel(data.month) : ''}）
              </h3>
              {trendData.some((t) => t.total > 0) ? (
                <ResponsiveContainer width="100%" height={288}>
                  <AreaChart data={trendData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <defs>
                      <linearGradient id="salaryGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#B89455" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#B89455" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 90%)" />
                    <XAxis dataKey="month" tick={{ fill: 'hsl(0 0% 45%)', fontSize: 12 }} axisLine={{ stroke: 'hsl(0 0% 90%)' }} tickLine={false} />
                    <YAxis tick={{ fill: 'hsl(0 0% 45%)', fontSize: 12 }} axisLine={{ stroke: 'hsl(0 0% 90%)' }} tickLine={false} tickFormatter={(v) => formatCompact(Number(v))} />
                    <Tooltip {...TOOLTIP_STYLE} formatter={(value) => [formatCurrency(Number(value)), '实发总额']} />
                    <Area type="monotone" dataKey="total" stroke="#B89455" strokeWidth={2} fill="url(#salaryGradient)" dot={{ fill: '#B89455', r: 4 }} activeDot={{ r: 6 }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart />
              )}
            </div>

            {/* 校区对比 */}
            <div className="glass-card p-4">
              <h3 className="mb-4 text-sm font-medium text-foreground section-title">
                <Building2Icon className="mr-1 inline size-4" />校区实发对比（{data ? formatYearLabel(data.month) : ''}）
              </h3>
              {campusComparison.length > 0 ? (
                <ResponsiveContainer width="100%" height={288}>
                  <BarChart data={campusComparison} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 90%)" />
                    <XAxis dataKey="name" tick={{ fill: 'hsl(0 0% 45%)', fontSize: 12 }} axisLine={{ stroke: 'hsl(0 0% 90%)' }} tickLine={false} />
                    <YAxis tick={{ fill: 'hsl(0 0% 45%)', fontSize: 12 }} axisLine={{ stroke: 'hsl(0 0% 90%)' }} tickLine={false} tickFormatter={(v) => formatCompact(Number(v))} />
                    <Tooltip {...TOOLTIP_STYLE} formatter={(value) => [formatCurrency(Number(value)), '实发总额']} cursor={{ fill: 'hsl(0 0% 95%)' }} />
                    <Bar dataKey="net" radius={[6, 6, 0, 0]} fill="rgba(184, 148, 85, 0.45)" stroke="#B89455" strokeWidth={1} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart />
              )}
            </div>

            {/* 部门占比 */}
            <div className="glass-card p-4">
              <h3 className="mb-4 text-sm font-medium text-foreground section-title">
                <BriefcaseIcon className="mr-1 inline size-4" />部门实发占比（{data ? formatYearLabel(data.month) : ''}）
              </h3>
              {departmentRatio.length > 0 ? (
                <ResponsiveContainer width="100%" height={288}>
                  <PieChart>
                    <Pie data={departmentRatio} dataKey="value" nameKey="name" cx="50%" cy="45%" outerRadius={85} innerRadius={45} paddingAngle={2}>
                      {departmentRatio.map((entry, i) => (
                        <Cell key={i} fill={entry.color} stroke="white" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip {...TOOLTIP_STYLE} formatter={(value) => formatCurrency(Number(value))} />
                    <Legend verticalAlign="bottom" iconType="circle" formatter={(value) => <span style={{ color: 'hsl(0 0% 45%)', fontSize: '12px' }}>{String(value)}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart />
              )}
            </div>
          </div>

          {/* 明细表 */}
          <div className="glass-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-border/50 p-4">
              <h3 className="text-sm font-medium text-foreground section-title">
                薪资明细（{data ? formatYearLabel(data.month) : ''}）
              </h3>
              <Button variant="ghost" size="sm" onClick={() => navigate('/admin/salary/records')}>
                查看全部
                <ArrowRightIcon className="size-4" />
              </Button>
            </div>
            {detail.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50">
                    <TableHead className="min-w-[80px]">员工</TableHead>
                    <TableHead>校区</TableHead>
                    <TableHead>部门</TableHead>
                    <TableHead className="text-right">应发</TableHead>
                    <TableHead className="text-right">扣款</TableHead>
                    <TableHead className="min-w-[100px] text-right">实发</TableHead>
                    <TableHead className="min-w-[70px]">状态</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="anim-stagger">
                  {detail.map((r) => (
                    <TableRow key={r.id} className="cursor-pointer border-border/30 hover:bg-muted/50" onClick={() => navigate('/admin/salary/records')}>
                      <TableCell className="font-medium">{r.employee_name ?? '-'}</TableCell>
                      <TableCell className="text-muted-foreground">{r.campus_name ?? '-'}</TableCell>
                      <TableCell className="text-muted-foreground">{r.department_name ?? '-'}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{formatCurrency(r.gross_salary)}</TableCell>
                      <TableCell className="text-right font-mono text-sm text-[var(--deduction)]">{formatCurrency(r.total_deduction)}</TableCell>
                      <TableCell className="text-right font-mono text-sm font-bold">{formatCurrency(r.net_salary)}</TableCell>
                      <TableCell>
                        <Badge
                          variant={r.status === 'published' ? 'default' : 'secondary'}
                          className={r.status === 'published' ? 'bg-[var(--income-soft)] text-[var(--income)] border-[var(--income-soft)]' : 'bg-muted text-muted-foreground'}
                        >
                          {r.status === 'published' ? '已发布' : '草稿'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyChart height="h-32" />
            )}
          </div>
        </>
      )}
    </div>
  )
}

function EmptyChart({ height = 'h-72' }: { height?: string }) {
  return (
    <div className={cn('flex items-center justify-center text-muted-foreground', height)}>
      <div className="flex flex-col items-center gap-2">
        <FileTextIcon className="size-8 text-muted-foreground/50" />
        <span>暂无数据</span>
      </div>
    </div>
  )
}
