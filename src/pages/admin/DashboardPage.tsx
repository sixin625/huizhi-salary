import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  CircleDollarSignIcon,
  UsersIcon,
  Building2Icon,
  BriefcaseIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  ArrowRightIcon,
  FileTextIcon,
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
import { dashboardApi, salaryApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import { CountUp } from '@/components/ui/count-up'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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

function getMonthString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function formatMonthLabel(ym: string): string {
  const [, month] = ym.split('-')
  return `${parseInt(month, 10)}月`
}

function formatCurrency(val: number): string {
  return '¥' + val.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatCompact(val: number): string {
  if (Math.abs(val) >= 10000) return '¥' + (val / 10000).toFixed(1) + '万'
  return formatCurrency(val)
}

// ============================================================
// 图表配色 & 样式
// ============================================================

const CHART_COLORS = ['#F4845F', '#3FA98C', '#2EC4B6', '#F6B26B', '#C9A0DC', '#F2C14E']

const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
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

// ============================================================
// 类型定义
// ============================================================

type RecentRecord = {
  id: string
  year_month: string
  net_salary: number
  status: SalaryRecordStatus
  employee_name: string | null
}

// ============================================================
// 组件
// ============================================================

export default function DashboardPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<any>(null)
  const [salaryRecords, setSalaryRecords] = useState<any[]>([])
  const currentMonth = useMemo(() => getMonthString(new Date()), [])

  const fetchDashboardData = useCallback(async () => {
    setLoading(true)
    try {
      const [statsData, recordsData] = await Promise.all([
        dashboardApi.stats(),
        salaryApi.list(currentMonth),
      ])
      setStats(statsData)
      setSalaryRecords(recordsData ?? [])
    } catch (err) {
      toast.error('获取看板数据失败：' + (err instanceof Error ? err.message : ''))
    } finally {
      setLoading(false)
    }
  }, [currentMonth])

  useEffect(() => {
    void fetchDashboardData()
  }, [fetchDashboardData])

  // 当月薪资总额
  const currentMonthTotal = stats?.currentMonthTotal ?? 0
  // 上月薪资总额
  const prevMonthTotal = stats?.lastMonthTotal ?? 0

  const salaryChangePercent = useMemo(() => {
    if (prevMonthTotal === 0) return null
    return ((currentMonthTotal - prevMonthTotal) / prevMonthTotal) * 100
  }, [currentMonthTotal, prevMonthTotal])

  const activeEmployeeCount = stats?.employeeCount ?? 0

  const campusDist = useMemo(
    () => (stats?.campusBreakdown ?? []) as { name: string; count: number }[],
    [stats],
  )

  const deptDist = useMemo(
    () => (stats?.departmentBreakdown ?? []) as { name: string; count: number }[],
    [stats],
  )

  const trendData = useMemo(() => {
    const trend = (stats?.trend ?? []) as { year_month: string; total: number }[]
    return trend.map((t) => ({
      month: formatMonthLabel(t.year_month),
      total: Math.round(t.total * 100) / 100,
    }))
  }, [stats])

  const campusComparison = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of salaryRecords) {
      const name = r.campus_name ?? '未知'
      map.set(name, (map.get(name) ?? 0) + (r.net_salary || 0))
    }
    return Array.from(map.entries()).map(([name, total]) => ({ name, total }))
  }, [salaryRecords])

  const departmentRatio = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of salaryRecords) {
      const name = r.department_name ?? '未知'
      map.set(name, (map.get(name) ?? 0) + (r.net_salary || 0))
    }
    return Array.from(map.entries())
      .map(([name, value], i) => ({
        name,
        value,
        color: CHART_COLORS[i % CHART_COLORS.length],
      }))
      .filter((d) => d.value > 0)
  }, [salaryRecords])

  const recentRecords = useMemo(
    () => (stats?.recentRecords ?? []) as RecentRecord[],
    [stats],
  )

  if (loading) {
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
      <div className="anim-fade-up">
        <h1 className="text-2xl font-bold text-foreground page-title">数据看板</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          薪资统计与数据分析 · {currentMonth}
        </p>
      </div>

      {/* KPI 卡片 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 anim-stagger editorial-kpi">
        <div className="glass-card glass-card-hover p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
              <CircleDollarSignIcon className="size-5 text-primary" />
            </div>
            当月薪资总额
          </div>
          <p className="mt-3 text-2xl font-semibold text-foreground kpi-val">
            <CountUp value={currentMonthTotal} format={formatCompact} />
          </p>
          {salaryChangePercent !== null ? (
            <div className="mt-1 flex items-center gap-1 text-xs">
              <span className={cn('flex items-center gap-0.5', salaryChangePercent >= 0 ? 'text-[var(--income)]' : 'text-[var(--deduction)]')}>
                {salaryChangePercent >= 0 ? <TrendingUpIcon className="size-3" /> : <TrendingDownIcon className="size-3" />}
                {salaryChangePercent >= 0 ? '+' : ''}
                {salaryChangePercent.toFixed(1)}%
              </span>
              <span className="text-muted-foreground">较上月</span>
            </div>
          ) : (
            <div className="mt-1 text-xs text-muted-foreground">暂无上月数据</div>
          )}
        </div>

        <div className="glass-card glass-card-hover p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
              <UsersIcon className="size-5 text-primary" />
            </div>
            员工总数
          </div>
          <p className="mt-3 text-2xl font-semibold text-foreground kpi-val">
            <CountUp value={activeEmployeeCount} decimals={0} prefix="" />
            <span className="ml-1 text-sm font-normal text-muted-foreground">人</span>
          </p>
          <div className="mt-1 text-xs text-muted-foreground">在职员工</div>
        </div>

        <div className="glass-card glass-card-hover p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
              <Building2Icon className="size-5 text-primary" />
            </div>
            校区分布
          </div>
          <div className="mt-3 space-y-1.5">
            {campusDist.length > 0 ? (
              campusDist.map((c) => (
                <div key={c.name} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{c.name}</span>
                  <span className="font-medium text-foreground">{c.count} 人</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">暂无数据</p>
            )}
          </div>
        </div>

        <div className="glass-card glass-card-hover p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
              <BriefcaseIcon className="size-5 text-primary" />
            </div>
            部门分布
          </div>
          <div className="mt-3 space-y-1">
            {deptDist.length > 0 ? (
              deptDist.map((d) => (
                <div key={d.name} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{d.name}</span>
                  <span className="font-medium text-foreground">{d.count} 人</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">暂无数据</p>
            )}
          </div>
        </div>
      </div>

      {/* 图表区 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 anim-stagger">
        <div className="glass-card p-4 lg:col-span-2">
          <h3 className="mb-4 text-sm font-medium text-foreground section-title">薪资趋势（最近6个月）</h3>
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={288}>
              <AreaChart data={trendData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <defs>
                  <linearGradient id="salaryGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F4845F" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#F4845F" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 90%)" />
                <XAxis dataKey="month" tick={{ fill: 'hsl(0 0% 45%)', fontSize: 12 }} axisLine={{ stroke: 'hsl(0 0% 90%)' }} tickLine={false} />
                <YAxis tick={{ fill: 'hsl(0 0% 45%)', fontSize: 12 }} axisLine={{ stroke: 'hsl(0 0% 90%)' }} tickLine={false} tickFormatter={(v) => formatCompact(Number(v))} />
                <Tooltip {...TOOLTIP_STYLE} formatter={(value) => [formatCurrency(Number(value)), '实发总额']} />
                <Area type="monotone" dataKey="total" stroke="#F4845F" strokeWidth={2} fill="url(#salaryGradient)" dot={{ fill: '#F4845F', r: 4 }} activeDot={{ r: 6 }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-72 items-center justify-center text-muted-foreground">
              <div className="flex flex-col items-center gap-2">
                <FileTextIcon className="size-8 text-muted-foreground/50" />
                <span>暂无数据</span>
              </div>
            </div>
          )}
        </div>

        <div className="glass-card p-4">
          <h3 className="mb-4 text-sm font-medium text-foreground section-title">校区薪资对比（当月）</h3>
          {campusComparison.some((c) => c.total > 0) ? (
            <ResponsiveContainer width="100%" height={288}>
              <BarChart data={campusComparison} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 90%)" />
                <XAxis dataKey="name" tick={{ fill: 'hsl(0 0% 45%)', fontSize: 12 }} axisLine={{ stroke: 'hsl(0 0% 90%)' }} tickLine={false} />
                <YAxis tick={{ fill: 'hsl(0 0% 45%)', fontSize: 12 }} axisLine={{ stroke: 'hsl(0 0% 90%)' }} tickLine={false} tickFormatter={(v) => formatCompact(Number(v))} />
                <Tooltip {...TOOLTIP_STYLE} formatter={(value) => [formatCurrency(Number(value)), '实发总额']} cursor={{ fill: 'hsl(0 0% 95%)' }} />
                <Bar dataKey="total" radius={[6, 6, 0, 0]} fill="rgba(244, 132, 95, 0.45)" stroke="#F4845F" strokeWidth={1} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-72 items-center justify-center text-muted-foreground">
              <div className="flex flex-col items-center gap-2">
                <FileTextIcon className="size-8 text-muted-foreground/50" />
                <span>暂无数据</span>
              </div>
            </div>
          )}
        </div>

        <div className="glass-card p-4">
          <h3 className="mb-4 text-sm font-medium text-foreground section-title">部门薪资占比（当月）</h3>
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
            <div className="flex h-72 items-center justify-center text-muted-foreground">
              <div className="flex flex-col items-center gap-2">
                <FileTextIcon className="size-8 text-muted-foreground/50" />
                <span>暂无数据</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 最近薪资记录 */}
      <div className="glass-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-border/50 p-4">
          <h3 className="text-sm font-medium text-foreground section-title">最近薪资记录</h3>
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin/salary/records')}>
            查看全部
            <ArrowRightIcon className="size-4" />
          </Button>
        </div>
        {recentRecords.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow className="border-border/50">
                <TableHead className="min-w-[80px]">员工姓名</TableHead>
                <TableHead className="min-w-[90px]">月份</TableHead>
                <TableHead className="min-w-[100px] text-right">实发金额</TableHead>
                <TableHead className="min-w-[70px]">状态</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="anim-stagger">
              {recentRecords.map((record) => (
                <TableRow key={record.id} className="cursor-pointer border-border/30 hover:bg-muted/50" onClick={() => navigate('/admin/salary/records')}>
                  <TableCell className="font-medium">{record.employee_name ?? '-'}</TableCell>
                  <TableCell className="text-muted-foreground">{record.year_month}</TableCell>
                  <TableCell className="text-right font-mono text-sm font-bold">{formatCurrency(record.net_salary)}</TableCell>
                  <TableCell>
                    <Badge
                      variant={record.status === 'published' ? 'default' : 'secondary'}
                      className={record.status === 'published' ? 'bg-[var(--income-soft)] text-[var(--income)] border-[var(--income-soft)]' : 'bg-muted text-muted-foreground'}
                    >
                      {record.status === 'published' ? '已发布' : '草稿'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="flex h-32 items-center justify-center text-muted-foreground">
            <div className="flex flex-col items-center gap-2">
              <FileTextIcon className="size-8 text-muted-foreground/50" />
              <span>暂无薪资记录</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
