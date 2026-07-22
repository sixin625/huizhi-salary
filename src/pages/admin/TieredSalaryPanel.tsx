import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  TrendingUpIcon,
  TrendingDownIcon,
  CircleDollarSignIcon,
  SaveIcon,
  PercentIcon,
} from 'lucide-react'
import type { TieredConfig } from '@/lib/tiered-types'
import { calcTieredSalary, findTier } from '@/lib/tiered-calculator'
import { salaryApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'

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

// ---- Props ----

interface TieredSalaryPanelProps {
  employee: {
    id: string
    name: string
    campus_id?: string | null
    department_id?: string | null
  }
  template: TieredConfig
  yearMonth: string
  employees: any[]
}

// ---- 组件 ----

export default function TieredSalaryPanel({
  employee,
  template,
  yearMonth,
}: TieredSalaryPanelProps) {
  const deductions = template.deductions

  // ---- 输入状态 ----
  const [actualPerformance, setActualPerformance] = useState(0)
  const [targetPerformance, setTargetPerformance] = useState(0)
  const [bonus, setBonus] = useState(0)
  const [tutoring, setTutoring] = useState(0)
  const [socialInsurance, setSocialInsurance] = useState(
    deductions.social_insurance.amount,
  )
  const [housingFund, setHousingFund] = useState(deductions.housing_fund.amount)
  const [tax, setTax] = useState(0)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  // ---- 实时计算 ----
  const hasTiers = template.tiers && template.tiers.length > 0

  const result = useMemo(
    () =>
      hasTiers
        ? calcTieredSalary({
            config: template,
            actualPerformance,
            targetPerformance,
            bonus,
            tutoring,
            socialInsurance: deductions.social_insurance.enabled ? socialInsurance : 0,
            housingFund: deductions.housing_fund.enabled ? housingFund : 0,
            tax: deductions.tax.enabled ? tax : 0,
          })
        : null,
    [actualPerformance, targetPerformance, bonus, tutoring, socialInsurance, housingFund, tax, hasTiers],
  )

  // 当前匹配档位
  const matchedTier = useMemo(
    () => (hasTiers ? findTier(template.tiers, actualPerformance) : null),
    [actualPerformance, template.tiers, hasTiers],
  )

  const tierIndex = hasTiers
    ? template.tiers.findIndex((t) => t === matchedTier)
    : -1

  // ---- 保存 ----
  const handleSave = async () => {
    setSaving(true)
    try {
      const calcResult = calcTieredSalary({
        config: template,
        actualPerformance,
        targetPerformance,
        bonus,
        tutoring,
        socialInsurance: deductions.social_insurance.enabled ? socialInsurance : 0,
        housingFund: deductions.housing_fund.enabled ? housingFund : 0,
        tax: deductions.tax.enabled ? tax : 0,
      })

      const items: Array<{
        item_name: string
        item_type: string
        amount: number
        remark: string | null
      }> = []

      if (calcResult.baseSalary > 0)
        items.push({ item_name: '基本工资', item_type: 'income', amount: calcResult.baseSalary, remark: null })
      if (calcResult.performanceSalary > 0)
        items.push({ item_name: '绩效工资', item_type: 'income', amount: calcResult.performanceSalary, remark: null })
      if (calcResult.commission > 0) {
        items.push({
          item_name: '阶梯提成',
          item_type: 'income',
          amount: calcResult.commission,
          remark: `业绩${actualPerformance.toLocaleString()}元`,
        })
      }
      if (bonus > 0)
        items.push({ item_name: '奖金', item_type: 'income', amount: bonus, remark: null })
      if (tutoring > 0)
        items.push({ item_name: '个人辅导', item_type: 'income', amount: tutoring, remark: null })
      if (socialInsurance > 0 && deductions.social_insurance.enabled)
        items.push({ item_name: '社保', item_type: 'deduction', amount: socialInsurance, remark: null })
      if (housingFund > 0 && deductions.housing_fund.enabled)
        items.push({ item_name: '公积金', item_type: 'deduction', amount: housingFund, remark: null })
      if (tax > 0 && deductions.tax.enabled)
        items.push({ item_name: '个税', item_type: 'deduction', amount: tax, remark: null })
      if (notes.trim())
        items.push({ item_name: '备注', item_type: 'income', amount: 0, remark: notes.trim() })

      await salaryApi.save({
        employee_id: employee.id,
        year_month: yearMonth,
        campus_id: employee.campus_id,
        department_id: employee.department_id,
        gross_salary: calcResult.grossTotal,
        total_deduction: calcResult.deductionTotal,
        net_salary: calcResult.netTotal,
        items,
      })

      toast.success('薪资记录已保存')
    } catch (err) {
      toast.error('保存失败：' + (err instanceof Error ? err.message : '未知错误'))
    } finally {
      setSaving(false)
    }
  }

  // ---- 辅助：数字输入 ----
  const numVal = (setter: (v: number) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value)
    setter(isNaN(v) ? 0 : v)
  }

  // 空模板保护：如果模板没有配置档位，显示提示
  if (!hasTiers) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
        <p className="text-sm">该员工的阶梯模板尚未配置档位</p>
        <p className="text-xs">请先在员工管理页点击"薪资模板"进行配置</p>
      </div>
    )
  }

  // 经过上方 early return 保护，以下 result / matchedTier 必定非 null
  const r = result!
  const mt = matchedTier!

  // ---- 渲染 ----
  return (
    <div className="space-y-5">
      {/* 1. 业绩输入区 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-muted-foreground">
            实际业绩
          </Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={actualPerformance || ''}
            onChange={numVal(setActualPerformance)}
            placeholder="输入实际业绩"
            className="h-12 text-xl font-bold font-mono"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-muted-foreground">
            目标业绩
          </Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={targetPerformance || ''}
            onChange={numVal(setTargetPerformance)}
            placeholder="输入目标业绩"
            className="h-12 text-lg font-mono"
          />
        </div>
      </div>

      <Separator />

      {/* 2. 计算结果展示区 */}
      <div className="glass-card p-5">
        <h3 className="section-title">计算结果</h3>

        {/* 当前档位 */}
        <div className="mb-3 flex items-center gap-2">
          <span className="rounded-full bg-primary/20 px-3 py-1 text-xs font-medium text-primary">
            第{tierIndex + 1}档：{mt.min.toLocaleString()}-{mt.max.toLocaleString()}
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <PercentIcon className="size-3" />
            达成率 {(r.performanceRatio * 100).toFixed(1)}%
          </span>
        </div>

        {/* 薪资细项 */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-0.5">
            <span className="text-xs text-muted-foreground">基本工资（{template.base_salary_ratio}%）</span>
            <p className="font-mono text-lg font-semibold text-foreground">
              {formatCurrency(r.baseSalary)}
            </p>
          </div>
          <div className="space-y-0.5">
            <span className="text-xs text-muted-foreground">绩效工资（{template.performance_salary_ratio}% × 达成率）</span>
            <p className="font-mono text-lg font-semibold text-foreground">
              {formatCurrency(r.performanceSalary)}
            </p>
          </div>
        </div>

        <Separator className="my-3" />

        {/* 提成计算明细 */}
        <div>
          <span className="text-xs font-medium text-muted-foreground">提成计算明细</span>
          <div className="mt-2 space-y-1">
            {r.commissionBreakdown.map((seg, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg bg-muted px-3 py-1.5 text-sm"
              >
                <span className="text-muted-foreground">{seg.label}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {seg.amount.toLocaleString()} × {seg.rate}%
                </span>
                <span className="font-mono font-medium">
                  {formatCurrency(seg.commission)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between px-3">
            <span className="text-sm font-medium text-muted-foreground">提成合计</span>
            <span className="font-mono text-lg font-bold text-primary">
              {formatCurrency(r.commission)}
            </span>
          </div>
        </div>
      </div>

      <Separator />

      {/* 3. 可编辑附加项 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {template.extras.bonus.enabled && (
          <div className="space-y-1.5">
            <Label className="text-sm text-muted-foreground">奖金</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={bonus || ''}
              onChange={numVal(setBonus)}
              placeholder="0.00"
              className="font-mono"
            />
          </div>
        )}
        {template.extras.tutoring.enabled && (
          <div className="space-y-1.5">
            <Label className="text-sm text-muted-foreground">个人辅导</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={tutoring || ''}
              onChange={numVal(setTutoring)}
              placeholder="0.00"
              className="font-mono"
            />
          </div>
        )}
        {deductions.social_insurance.enabled && (
          <div className="space-y-1.5">
            <Label className="text-sm text-muted-foreground">社保金额</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={socialInsurance || ''}
              onChange={numVal(setSocialInsurance)}
              placeholder="0.00"
              className="font-mono"
            />
          </div>
        )}
        {deductions.housing_fund.enabled && (
          <div className="space-y-1.5">
            <Label className="text-sm text-muted-foreground">公积金金额</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={housingFund || ''}
              onChange={numVal(setHousingFund)}
              placeholder="0.00"
              className="font-mono"
            />
          </div>
        )}
        {deductions.tax.enabled && (
          <div className="space-y-1.5">
            <Label className="text-sm text-muted-foreground">个税金额</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={tax || ''}
              onChange={numVal(setTax)}
              placeholder="0.00"
              className="font-mono"
            />
          </div>
        )}
      </div>

      {/* 4. 备注输入 */}
      {template.extras.notes.enabled && (
        <div className="space-y-1.5">
          <Label className="text-sm text-muted-foreground">备注</Label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="输入备注信息..."
            rows={3}
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
      )}

      <Separator />

      {/* 5. 汇总区 */}
      <div className="editorial-summary grid grid-cols-3">
          <div>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <TrendingUpIcon className="size-3.5" />
              应发合计
            </div>
            <p className="mt-1 text-2xl font-display font-bold text-[var(--income)]">
              {formatCurrency(r.grossTotal)}
            </p>
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <TrendingDownIcon className="size-3.5" />
              扣除合计
            </div>
            <p className="mt-1 text-2xl font-display font-bold text-[var(--deduction)]">
              {formatCurrency(r.deductionTotal)}
            </p>
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <CircleDollarSignIcon className="size-3.5" />
              实发金额
            </div>
            <p className="mt-1 text-2xl font-display font-bold text-[var(--ink)]">
              {formatCurrency(r.netTotal)}
            </p>
          </div>
      </div>

      {/* 6. 保存按钮 */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          <SaveIcon />
          {saving ? '保存中...' : '保存记录'}
        </Button>
      </div>
    </div>
  )
}
