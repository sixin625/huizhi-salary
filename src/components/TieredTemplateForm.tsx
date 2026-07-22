import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { PlusIcon, Trash2Icon } from 'lucide-react'
import { salaryTemplateApi } from '@/lib/api'
import { isTieredConfig } from '@/lib/salary-catalog'
import type { TieredConfig, TierBracket } from '@/lib/tiered-types'
import { TIER_PRESETS } from '@/lib/tiered-presets'
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

interface TieredTemplateFormProps {
  employee: {
    id: string
    name: string
    username: string
    campus_name?: string | null
    department_name?: string | null
    base_salary?: number | null
  } | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function createDefaultTieredConfig(): TieredConfig {
  return {
    version: 1,
    template_type: 'tiered',
    base_salary_ratio: 60,
    performance_salary_ratio: 40,
    tiers: [
      { min: 0, max: 50000, salary: 6000, commission_rate: 3 },
    ],
    deductions: {
      social_insurance: { enabled: false, amount: 0 },
      housing_fund: { enabled: false, amount: 0 },
      tax: { enabled: false },
    },
    extras: {
      bonus: { enabled: false },
      tutoring: { enabled: false },
      notes: { enabled: false },
    },
  }
}

/* ─── 编辑风开关 ─── */
function EditSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="editorial-switch"
    >
      <span
        className={cn(
          'editorial-switch-track',
          checked && '[aria-checked=true]'
        )}
        aria-checked={checked}
      >
        <span className="editorial-switch-thumb" />
      </span>
    </button>
  )
}

export function TieredTemplateForm({
  employee,
  open,
  onOpenChange,
}: TieredTemplateFormProps) {
  const [config, setConfig] = useState<TieredConfig>(createDefaultTieredConfig())
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || !employee) return
    let cancelled = false
    setLoading(true)
    salaryTemplateApi
      .get(employee.id)
      .then((result) => {
        if (cancelled) return
        if (result?.config && isTieredConfig(result.config)) {
          setConfig(JSON.parse(JSON.stringify(result.config)))
        } else {
          setConfig(createDefaultTieredConfig())
        }
      })
      .catch((err) => {
        if (cancelled) return
        console.error('Failed to load tiered template:', err)
        setConfig(createDefaultTieredConfig())
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [open, employee])

  const updateRatio = (field: 'base_salary_ratio' | 'performance_salary_ratio', value: string) => {
    const num = Math.max(0, Math.min(100, parseInt(value) || 0))
    setConfig((prev) => {
      const other = field === 'base_salary_ratio' ? 'performance_salary_ratio' : 'base_salary_ratio'
      const otherVal = 100 - num
      return { ...prev, [field]: num, [other]: otherVal }
    })
  }

  const updateTier = (index: number, field: keyof TierBracket, value: string) => {
    const num = parseFloat(value) || 0
    setConfig((prev) => {
      const tiers = prev.tiers.map((t, i) => (i === index ? { ...t, [field]: num } : t))
      return { ...prev, tiers }
    })
  }

  const addTier = () => {
    setConfig((prev) => {
      const last = prev.tiers[prev.tiers.length - 1]
      const newMin = last ? last.max : 0
      const newMax = newMin + 50000
      const newSalary = last ? last.salary : 6000
      const newRate = last ? last.commission_rate + 1 : 3
      return {
        ...prev,
        tiers: [...prev.tiers, { min: newMin, max: newMax, salary: newSalary, commission_rate: newRate }],
      }
    })
  }

  const removeTier = (index: number) => {
    setConfig((prev) => ({
      ...prev,
      tiers: prev.tiers.filter((_, i) => i !== index),
    }))
  }

  const loadPreset = (presetId: string | null) => {
    if (!presetId) return
    const preset = TIER_PRESETS.find((p) => p.id === presetId)
    if (!preset) return
    const copy: TieredConfig = JSON.parse(JSON.stringify(preset.config))
    setConfig(copy)
    toast.success(`已加载预设：${preset.name}`)
  }

  const updateDeduction = <K extends keyof TieredConfig['deductions']>(
    key: K,
    field: string,
    value: boolean | number,
  ) => {
    setConfig((prev) => ({
      ...prev,
      deductions: {
        ...prev.deductions,
        [key]: { ...prev.deductions[key], [field]: value },
      },
    }))
  }

  const updateExtra = (key: keyof TieredConfig['extras'], enabled: boolean) => {
    setConfig((prev) => ({
      ...prev,
      extras: { ...prev.extras, [key]: { ...prev.extras[key], enabled } },
    }))
  }

  const handleSave = async () => {
    if (!employee) return
    if (config.tiers.length === 0) {
      toast.error('请至少添加一个阶梯档位')
      return
    }
    setSaving(true)
    try {
      await salaryTemplateApi.save(employee.id, config as any)
      toast.success('阶梯模板保存成功')
      onOpenChange(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : '未知错误'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const ratioSum = config.base_salary_ratio + config.performance_salary_ratio

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="editorial-dialog" showCloseButton>
        {/* ── 头部 ── */}
        <DialogHeader className="editorial-dialog-header">
          <DialogTitle className="editorial-dialog-title">
            阶梯提成模板编辑
          </DialogTitle>
          <DialogDescription className="editorial-dialog-subtitle">
            {employee
              ? `为 ${employee.name} 配置阶梯提成方案`
              : '请选择员工'}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <span className="text-sm tracking-wide">加载中…</span>
          </div>
        ) : (
          <div className="editorial-form overflow-y-auto max-h-[65vh]">
            {/* ═══ 预设加载 ═══ */}
            <div className="py-4 border-b border-[var(--ink-rule)]">
              <span className="form-label mb-2 block">快速开始</span>
              <Select onValueChange={loadPreset}>
                <SelectTrigger className="select-underline w-48">
                  <SelectValue placeholder="从预设模板加载" />
                </SelectTrigger>
                <SelectContent>
                  {TIER_PRESETS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ═══ 基本比例 ═══ */}
            <div className="editorial-form-section">
              <span className="editorial-section-label">工资拆分比例</span>
              <div className="flex items-center gap-8">
                <label className="flex items-center gap-3">
                  <span className="text-sm text-[var(--ink)]">基本工资</span>
                  <Input
                    type="number"
                    className="input-underline w-20 text-right font-mono text-sm"
                    value={config.base_salary_ratio}
                    onChange={(e) => updateRatio('base_salary_ratio', e.target.value)}
                    min={0}
                    max={100}
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                </label>
                <label className="flex items-center gap-3">
                  <span className="text-sm text-[var(--ink)]">绩效工资</span>
                  <Input
                    type="number"
                    className="input-underline w-20 text-right font-mono text-sm"
                    value={config.performance_salary_ratio}
                    onChange={(e) => updateRatio('performance_salary_ratio', e.target.value)}
                    min={0}
                    max={100}
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                </label>
                <span className={cn(
                  'text-xs tabular-nums ml-auto',
                  ratioSum !== 100 ? 'text-[var(--destructive)] font-bold' : 'text-muted-foreground'
                )}>
                  合计 {ratioSum}%
                </span>
              </div>
            </div>

            {/* ═══ 阶梯档位 ═══ */}
            <div className="editorial-form-section">
              <div className="flex items-center justify-between mb-4">
                <span className="editorial-section-label mb-0">阶梯档位</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={addTier}
                  className="text-link h-auto p-0"
                >
                  <PlusIcon />
                  添加档位
                </Button>
              </div>

              {/* 表头 */}
              <div className="grid grid-cols-[1fr_1fr_1fr_90px_40px] gap-3 pb-2 border-b border-[var(--ink-rule)] item-head px-1">
                <span>业绩下限</span>
                <span>业绩上限</span>
                <span>工资总额</span>
                <span className="text-right">提成 %</span>
                <span></span>
              </div>

              {/* 档位行 */}
              {config.tiers.length === 0 && (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  暂无档位，点击上方「添加档位」开始
                </div>
              )}

              {config.tiers.map((tier, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_1fr_1fr_90px_40px] gap-3 items-center py-3 border-b border-[var(--ink-rule)]/60 hover:bg-[rgba(244,132,95,0.03)] transition-colors"
                >
                  <Input
                    type="number"
                    value={tier.min}
                    onChange={(e) => updateTier(i, 'min', e.target.value)}
                    className="input-underline font-mono text-sm"
                    placeholder="0"
                  />
                  <Input
                    type="number"
                    value={tier.max}
                    onChange={(e) => updateTier(i, 'max', e.target.value)}
                    className="input-underline font-mono text-sm"
                    placeholder="50000"
                  />
                  <Input
                    type="number"
                    value={tier.salary}
                    onChange={(e) => updateTier(i, 'salary', e.target.value)}
                    className="input-underline font-mono text-sm"
                    placeholder="6000"
                  />
                  <Input
                    type="number"
                    value={tier.commission_rate}
                    onChange={(e) => updateTier(i, 'commission_rate', e.target.value)}
                    className="input-underline font-mono text-sm text-right"
                    placeholder="%"
                  />
                  <button
                    type="button"
                    onClick={() => removeTier(i)}
                    className="flex items-center justify-center size-7 text-muted-foreground hover:text-[var(--destructive)] transition-colors"
                    title="删除此档位"
                  >
                    <Trash2Icon className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* ═══ 扣减项 ═══ */}
            <div className="editorial-form-section">
              <span className="editorial-section-label">扣减项</span>
              <div className="space-y-0">
                {/* 社保 */}
                <div className="flex items-center justify-between py-3 border-b border-[var(--ink-rule)]/60">
                  <div className="flex items-center gap-4">
                    <EditSwitch
                      checked={config.deductions.social_insurance.enabled}
                      onChange={(v) => updateDeduction('social_insurance', 'enabled', v)}
                    />
                    <span className="text-sm text-[var(--ink)]">社保</span>
                  </div>
                  <Input
                    type="number"
                    className="input-underline w-28 text-right font-mono text-sm"
                    placeholder="金额"
                    value={config.deductions.social_insurance.amount || ''}
                    onChange={(e) => updateDeduction('social_insurance', 'amount', parseFloat(e.target.value) || 0)}
                    disabled={!config.deductions.social_insurance.enabled}
                  />
                </div>
                {/* 公积金 */}
                <div className="flex items-center justify-between py-3 border-b border-[var(--ink-rule)]/60">
                  <div className="flex items-center gap-4">
                    <EditSwitch
                      checked={config.deductions.housing_fund.enabled}
                      onChange={(v) => updateDeduction('housing_fund', 'enabled', v)}
                    />
                    <span className="text-sm text-[var(--ink)]">公积金</span>
                  </div>
                  <Input
                    type="number"
                    className="input-underline w-28 text-right font-mono text-sm"
                    placeholder="金额"
                    value={config.deductions.housing_fund.amount || ''}
                    onChange={(e) => updateDeduction('housing_fund', 'amount', parseFloat(e.target.value) || 0)}
                    disabled={!config.deductions.housing_fund.enabled}
                  />
                </div>
                {/* 个税 */}
                <div className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-4">
                    <EditSwitch
                      checked={config.deductions.tax.enabled}
                      onChange={(v) => updateDeduction('tax', 'enabled', v)}
                    />
                    <span className="text-sm text-[var(--ink)]">个税</span>
                  </div>
                  <span className="text-xs text-muted-foreground/70 italic">（预留）</span>
                </div>
              </div>
            </div>

            {/* ═══ 附加项 ═══ */}
            <div className="editorial-form-section">
              <span className="editorial-section-label">附加项目</span>
              <div className="grid grid-cols-3 gap-6 py-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <EditSwitch
                    checked={config.extras.bonus.enabled}
                    onChange={(v) => updateExtra('bonus', v)}
                  />
                  <span className="text-sm text-[var(--ink)]">奖金</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <EditSwitch
                    checked={config.extras.tutoring.enabled}
                    onChange={(v) => updateExtra('tutoring', v)}
                  />
                  <span className="text-sm text-[var(--ink)]">个人辅导</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <EditSwitch
                    checked={config.extras.notes.enabled}
                    onChange={(v) => updateExtra('notes', v)}
                  />
                  <span className="text-sm text-[var(--ink)]">备注</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* ── 底部操作栏 ── */}
        <div className="editorial-dialog-footer">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="text-muted-foreground hover:text-foreground"
          >
            取消
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={saving || loading || !employee}
          >
            {saving ? '保存中…' : '保存模板'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
