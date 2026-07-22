import { useEffect, useState } from 'react'
import { salaryApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ReceiptTextIcon, TrendingUpIcon, TrendingDownIcon } from 'lucide-react'
import { CountUp } from '@/components/ui/count-up'

// 列表项类型（getMyRecords 返回，不含 items）
type PayslipSummary = {
  id: string
  year_month: string
  gross_salary: number
  total_deduction: number
  net_salary: number
}

// 详情项类型（getMyRecord 返回，含 items）
type SalaryItem = {
  id: string
  item_name: string
  item_type: 'income' | 'deduction'
  amount: number
  remark: string | null
}

type PayslipDetail = PayslipSummary & {
  items: SalaryItem[]
}

function formatYearMonth(ym: string): string {
  const [year, month] = ym.split('-')
  return `${year}年${parseInt(month, 10)}月`
}

function formatCurrency(amount: number): string {
  return `¥${amount.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export default function PayslipPage() {
  const employee = useAuthStore((s) => s.employee)
  const [records, setRecords] = useState<PayslipSummary[]>([])
  const [currentRecord, setCurrentRecord] = useState<PayslipDetail | null>(null)
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // 加载已发布工资条列表
  useEffect(() => {
    if (!employee?.id) {
      setLoading(false)
      return
    }
    let cancelled = false

    const loadRecords = async () => {
      setLoading(true)
      try {
        const data = await salaryApi.getMyRecords()
        if (cancelled) return
        const list = (data ?? []) as PayslipSummary[]
        setRecords(list)
        if (list.length > 0) {
          setSelectedMonth(list[0].year_month)
        }
      } catch {
        // 忽略错误，保持空列表
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void loadRecords()

    return () => {
      cancelled = true
    }
  }, [employee?.id])

  // 加载选中月份的详情（含明细项）
  useEffect(() => {
    if (!selectedMonth) {
      setCurrentRecord(null)
      return
    }
    let cancelled = false

    const loadDetail = async () => {
      try {
        const data = await salaryApi.getMyRecord(selectedMonth)
        if (!cancelled) {
          setCurrentRecord(data as PayslipDetail)
        }
      } catch {
        // 月度详情加载失败（可能未发布），清空当前记录
        if (!cancelled) {
          setCurrentRecord(null)
        }
      }
    }
    void loadDetail()

    return () => {
      cancelled = true
    }
  }, [selectedMonth])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="text-muted-foreground">加载中…</div>
      </div>
    )
  }

  if (records.length === 0 || !employee) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="glass-card px-12 py-16 text-center">
          <ReceiptTextIcon className="mx-auto mb-4 size-14 text-muted-foreground/50" />
          <h2 className="text-lg font-semibold text-foreground">暂无工资条</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            您还没有已发放的工资条，请耐心等待。
          </p>
        </div>
      </div>
    )
  }

  const incomeItems =
    currentRecord?.items.filter((i) => i.item_type === 'income') ?? []
  const deductionItems =
    currentRecord?.items.filter((i) => i.item_type === 'deduction') ?? []

  return (
    <div className="space-y-6 p-6">
      {/* Header with month selector */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground page-title">我的工资条</h1>
        <Select
          value={selectedMonth}
          onValueChange={(val) => setSelectedMonth(val as string | null)}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="选择月份">
              {(value: string | null) =>
                value ? formatYearMonth(value) : '选择月份'
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {records.map((record) => (
              <SelectItem key={record.year_month} value={record.year_month}>
                {formatYearMonth(record.year_month)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Main payslip card */}
      {currentRecord && (
        <div className="glass-card overflow-hidden p-4 sm:p-8 anim-pop-in">
          {/* Top: month + status */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">工资周期</p>
              <p className="mt-1 text-lg font-medium text-foreground">
                {formatYearMonth(currentRecord.year_month)}
              </p>
            </div>
            <Badge className="bg-[var(--income-soft)] text-[var(--income)] border-[var(--income-soft)]">
              已发放
            </Badge>
          </div>

          {/* Net salary display */}
          <div className="my-8 text-center">
            <p className="text-sm text-muted-foreground">实发金额</p>
            <p className="mt-2 text-4xl font-bold font-display sm:text-5xl">
              <CountUp
                value={currentRecord.net_salary}
                className="text-[var(--ink)]"
              />
            </p>
          </div>

          {/* Two columns: gross + deduction */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3 border-t-2 border-[var(--income)] p-4 bg-transparent">
              <TrendingUpIcon className="size-5 shrink-0 text-[var(--income)]" />
              <div>
                <p className="text-xs text-muted-foreground">应发合计</p>
                <p className="mt-0.5 text-lg font-semibold text-[var(--income)]">
                  <CountUp value={currentRecord.gross_salary} />
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 border-t-2 border-[var(--deduction)] p-4 bg-transparent">
              <TrendingDownIcon className="size-5 shrink-0 text-[var(--deduction)]" />
              <div>
                <p className="text-xs text-muted-foreground">扣除合计</p>
                <p className="mt-0.5 text-lg font-semibold text-[var(--deduction)]">
                  <CountUp value={currentRecord.total_deduction} />
                </p>
              </div>
            </div>
          </div>

          {/* Detail items */}
          <div className="mt-8">
            <h3 className="mb-3 text-sm font-medium text-foreground section-title">工资明细</h3>
            <div className="space-y-1.5 anim-stagger">
              {incomeItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between border-t border-[var(--ink-rule)] bg-transparent px-0 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-base font-bold text-[var(--income)]">+</span>
                    <div>
                      <p className="text-sm text-foreground">{item.item_name}</p>
                      {item.remark && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {item.remark}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="text-sm font-medium text-[var(--income)]">
                    {formatCurrency(item.amount)}
                  </span>
                </div>
              ))}
              {deductionItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between border-t border-[var(--ink-rule)] bg-transparent px-0 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-base font-bold text-[var(--deduction)]">−</span>
                    <div>
                      <p className="text-sm text-foreground">{item.item_name}</p>
                      {item.remark && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {item.remark}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="text-sm font-medium text-[var(--deduction)]">
                    {formatCurrency(item.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* History months */}
      <div className="glass-card p-6">
        <h3 className="mb-4 text-sm font-medium text-foreground section-title">历史工资条</h3>
        <div className="flex flex-wrap gap-2">
          {records.map((record) => (
            <button
              key={record.year_month}
              onClick={() => setSelectedMonth(record.year_month)}
              className={cn(
                'rounded-lg px-4 py-2 text-sm transition-colors',
                record.year_month === selectedMonth
                  ? 'bg-accent text-accent-foreground'
                  : 'bg-secondary text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              {formatYearMonth(record.year_month)}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
