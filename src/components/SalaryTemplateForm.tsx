import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { toast } from 'sonner'
import { salaryTemplateApi } from '@/lib/api'
import {
  SALARY_CATALOG,
  createDefaultTemplate,
  isTieredConfig,
  type SalaryComponentDef,
  type TemplateConfig,
  type TemplateItem,
} from '@/lib/salary-catalog'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
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
import { Input } from '@/components/ui/input'
import { TieredTemplateForm } from '@/components/TieredTemplateForm'

interface SalaryTemplateFormProps {
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

/* ─── 编辑风开关（复用 CSS .editorial-switch）─── */
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

export function SalaryTemplateForm({
  employee,
  open,
  onOpenChange,
}: SalaryTemplateFormProps) {
  const [config, setConfig] = useState<TemplateConfig>(createDefaultTemplate())
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [isTiered, setIsTiered] = useState(false)

  const optionItemsMap = useMemo(() => {
    const map: Record<string, Record<string, ReactNode>> = {}
    for (const def of SALARY_CATALOG) {
      if (def.options) {
        const inner: Record<string, ReactNode> = {}
        for (const opt of def.options) {
          inner[String(opt.value)] = opt.label
        }
        map[def.key] = inner
      }
    }
    return map
  }, [])

  useEffect(() => {
    if (!open || !employee) return
    let cancelled = false
    setLoading(true)
    salaryTemplateApi
      .get(employee.id)
      .then((result) => {
        if (cancelled) return
        if (result?.config) {
          if (isTieredConfig(result.config)) {
            setIsTiered(true)
          } else {
            setIsTiered(false)
            setConfig(result.config)
          }
        } else {
          setIsTiered(false)
          setConfig(createDefaultTemplate())
        }
      })
      .catch((err) => {
        if (cancelled) return
        console.error('Failed to load template:', err)
        setIsTiered(false)
        setConfig(createDefaultTemplate())
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, employee])

  // 弹窗关闭时重置阶梯状态
  useEffect(() => {
    if (!open) {
      setIsTiered(false)
    }
  }, [open])

  const toggleItem = (def: SalaryComponentDef, enabled: boolean) => {
    setConfig((prev) => {
      const existing = prev.items[def.key] || { enabled: false }
      const updated: TemplateItem = { ...existing, enabled }
      if (
        enabled &&
        def.options &&
        def.options.length > 0 &&
        updated.selected_option == null
      ) {
        updated.selected_option = def.options[0].value
      }
      return {
        ...prev,
        items: { ...prev.items, [def.key]: updated },
      }
    })
  }

  const updateOption = (key: string, selected_option: number) => {
    setConfig((prev) => ({
      ...prev,
      items: {
        ...prev.items,
        [key]: { ...prev.items[key], selected_option },
      },
    }))
  }

  const updateCustomAmount = (key: string, value: string) => {
    const num = parseFloat(value)
    setConfig((prev) => ({
      ...prev,
      items: {
        ...prev.items,
        [key]: { ...prev.items[key], custom_amount: isNaN(num) ? undefined : num },
      },
    }))
  }

  const handleSave = async () => {
    if (!employee) return
    setSaving(true)
    try {
      await salaryTemplateApi.save(employee.id, config)
      toast.success('模板保存成功')
      onOpenChange(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : '未知错误'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const getHintText = (def: SalaryComponentDef): string | null => {
    if (def.calc_mode === 'source') return '取自员工底薪'
    if (def.calc_mode === 'manual_input') return '金额在录入页填写'
    return null
  }

  /* 收入/扣除的小标签 */
  function TypeTag({ type }: { type: string }) {
    const isIncome = type === 'income'
    return (
      <span
        className={cn(
          'inline-block text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5',
          isIncome
            ? 'text-[var(--income)] bg-[var(--income-soft)]'
            : 'text-[var(--deduction)] bg-[var(--deduction-soft)]'
        )}
      >
        {isIncome ? '收入' : '扣除'}
      </span>
    )
  }

  // 阶梯模板：直接渲染 TieredTemplateForm（自带 Dialog）
  if (isTiered) {
    return (
      <TieredTemplateForm
        employee={employee}
        open={open}
        onOpenChange={onOpenChange}
      />
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="editorial-dialog" showCloseButton>
        {/* ── 头部 ── */}
        <DialogHeader className="editorial-dialog-header">
          <DialogTitle className="editorial-dialog-title">
            薪资模板编辑
          </DialogTitle>
          <DialogDescription className="editorial-dialog-subtitle">
            {employee
              ? `为 ${employee.name} 配置薪资项目`
              : '请选择员工'}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <span className="text-sm tracking-wide">加载中…</span>
          </div>
        ) : (
          <div className="editorial-form overflow-y-auto max-h-[60vh]">
            {SALARY_CATALOG.map((def, idx) => {
              const itemConfig = config.items[def.key] || { enabled: false }
              const isEnabled = itemConfig.enabled
              const hasOptions = !!(def.options && def.options.length > 0)
              const hintText = getHintText(def)

              return (
                <div
                  key={def.key}
                  className={cn(
                    'flex items-start gap-5 py-4',
                    idx !== 0 && 'border-t border-[var(--ink-rule)]',
                    isEnabled && 'bg-[rgba(244,132,95,0.03)]'
                  )}
                >
                  {/* 开关 */}
                  <div className="pt-0.5">
                    <EditSwitch
                      checked={isEnabled}
                      onChange={(v) => toggleItem(def, v)}
                    />
                  </div>

                  {/* 信息区 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'text-[15px] font-medium',
                          isEnabled ? 'text-[var(--ink)]' : 'text-muted-foreground'
                        )}
                      >
                        {def.label}
                      </span>
                      <TypeTag type={def.item_type} />
                      {def.optional && (
                        <span className="text-[10px] text-muted-foreground tracking-wider uppercase px-1.5 py-0.5 border border-[var(--ink-rule)]">
                          可选
                        </span>
                      )}
                    </div>

                    {hintText && (
                      <p className="mt-1 text-xs text-muted-foreground">{hintText}</p>
                    )}

                    {/* 底薪拆分说明 */}
                    {def.key === 'base_salary' && isEnabled && (
                      <div className="mt-3 border border-[var(--ink-rule)] bg-[var(--muted)]/30 px-4 py-3 space-y-1.5">
                        <div className="text-xs font-semibold text-[var(--ink)] tracking-wide">
                          录入时自动拆分：基本工资(60%) + 绩效工资(40%)
                        </div>
                        {(() => {
                          const base = itemConfig.custom_amount ?? employee?.base_salary ?? 0
                          return base > 0 ? (
                            <div className="text-xs text-muted-foreground tabular-nums">
                              底薪 ¥{base.toLocaleString()} &rarr; 基本工资 ¥{(base * 0.6).toLocaleString()} + 绩效工资 ¥{(base * 0.4).toLocaleString()}
                            </div>
                          ) : null
                        })()}
                        <div className="text-[11px] text-muted-foreground/70">
                          绩效工资按实际业绩 &divide; 目标业绩比例计算，不封顶
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 右侧控件 */}
                  <div className="shrink-0 pt-1">
                    {def.key === 'base_salary' && isEnabled && (
                      <Input
                        type="number"
                        className="input-underline w-28 text-right"
                        value={itemConfig.custom_amount ?? employee?.base_salary ?? ''}
                        onChange={(e) => updateCustomAmount(def.key, e.target.value)}
                        placeholder="底薪金额"
                      />
                    )}

                    {hasOptions && (
                      <Select
                        value={
                          itemConfig.selected_option != null
                            ? String(itemConfig.selected_option)
                            : null
                        }
                        onValueChange={(val) => {
                          if (val != null) updateOption(def.key, Number(val))
                        }}
                        items={optionItemsMap[def.key]}
                        disabled={!isEnabled}
                      >
                        <SelectTrigger className="select-underline w-28">
                          <SelectValue placeholder="选择" />
                        </SelectTrigger>
                        <SelectContent>
                          {def.options!.map((opt) => (
                            <SelectItem
                              key={opt.value}
                              value={String(opt.value)}
                            >
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              )
            })}
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
