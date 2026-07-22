// ============================================================
// 薪资目录常量 — 定义所有可选薪资项及其计算模式
// ============================================================

import type { TieredConfig } from './tiered-types'
export type { AnyTemplateConfig } from './tiered-types'

// 薪资计算模式
export type SalaryCalcMode = 'source' | 'per_unit' | 'percentage' | 'manual_input'

// 薪资项选项（档位/比率）
export interface SalaryOption {
  value: number
  label: string
}

// 薪资项定义（目录中的每一项）
export interface SalaryComponentDef {
  key: string
  label: string
  item_type: 'income' | 'deduction'
  calc_mode: SalaryCalcMode
  options?: SalaryOption[]
  unit?: string
  optional?: boolean
}

// 模板单项配置
export interface TemplateItem {
  enabled: boolean
  selected_option?: number // 选中的选项值
  custom_amount?: number // 底薪自定义金额
}

// 模板配置
export interface TemplateConfig {
  version: number
  items: Record<string, TemplateItem>
}

// 录入行（展开后的表单项）
export interface TemplateFormItem {
  key: string // 唯一 React key
  item_name: string // 项目名称
  item_type: 'income' | 'deduction'
  amount: string // 金额（source/manual_input 用，其他模式计算得出）
  remark: string
  calc_mode?: SalaryCalcMode
  catalog_key?: string // 对应 catalog 中的 key
  selected_option?: number // 选中的档位/比率
  quantity?: string // 数量（per_unit 用）
  base_amount?: string // 基数（percentage 用）
  base_salary_full?: string // 原始底薪全额，供录入页计算达成率用
}

// ---- 薪资目录（11 项）----

export const SALARY_CATALOG: SalaryComponentDef[] = [
  {
    key: 'base_salary',
    label: '底薪',
    item_type: 'income',
    calc_mode: 'source',
  },
  {
    key: 'dazhong',
    label: '当众讲话',
    item_type: 'income',
    calc_mode: 'per_unit',
    options: [
      { value: 350, label: '350/节' },
      { value: 400, label: '400/节' },
      { value: 200, label: '200/节' },
    ],
    unit: '节',
  },
  {
    key: 'x_ke',
    label: 'X课',
    item_type: 'income',
    calc_mode: 'per_unit',
    options: [
      { value: 2500, label: '2500/期' },
      { value: 1500, label: '1500/期' },
      { value: 3000, label: '3000/期' },
    ],
    unit: '期',
  },
  {
    key: 'salon',
    label: '沙龙课',
    item_type: 'income',
    calc_mode: 'per_unit',
    options: [
      { value: 800, label: '800/期' },
      { value: 300, label: '300/期' },
      { value: 600, label: '600/期' },
    ],
    unit: '期',
  },
  {
    key: 'mentor',
    label: '导师研修班',
    item_type: 'income',
    calc_mode: 'per_unit',
    options: [{ value: 10500, label: '10500' }],
    unit: '期',
  },
  {
    key: 'commission',
    label: '提成',
    item_type: 'income',
    calc_mode: 'percentage',
    options: [
      { value: 4, label: '4%' },
      { value: 6, label: '6%' },
    ],
  },
  {
    key: 'tutoring',
    label: '个人辅导',
    item_type: 'income',
    calc_mode: 'percentage',
    options: [
      { value: 40, label: '40%' },
      { value: 50, label: '50%' },
      { value: 60, label: '60%' },
    ],
  },
  {
    key: 'total_commission',
    label: '总业绩提成',
    item_type: 'income',
    calc_mode: 'percentage',
    options: [
      { value: 4, label: '4%' },
      { value: 6, label: '6%' },
      { value: 8, label: '8%' },
    ],
    optional: true,
  },
  {
    key: 'subsidy',
    label: '补助',
    item_type: 'income',
    calc_mode: 'manual_input',
  },
  {
    key: 'corporate_training',
    label: '企业内训',
    item_type: 'income',
    calc_mode: 'manual_input',
  },
  {
    key: 'social_insurance',
    label: '社保公积金',
    item_type: 'deduction',
    calc_mode: 'manual_input',
  },
]

// ---- 工具函数 ----

/**
 * 生成全 disabled 的默认模板。
 * version: 1, 每项 enabled: false。
 */
export function createDefaultTemplate(): TemplateConfig {
  const items: Record<string, TemplateItem> = {}
  for (const def of SALARY_CATALOG) {
    items[def.key] = { enabled: false }
  }
  return { version: 1, items }
}

/**
 * 将模板 enabled 项展开为录入行数组。
 * base_salary 项若有 baseSalary 参数则预填到 amount，否则为空字符串。
 */
export function templateToFormItems(
  config: TemplateConfig,
  baseSalary?: number,
): TemplateFormItem[] {
  const result: TemplateFormItem[] = []

  for (const def of SALARY_CATALOG) {
    const itemConfig = config.items[def.key]
    // 跳过未启用的项
    if (!itemConfig || !itemConfig.enabled) continue

    const formItem: TemplateFormItem = {
      key: def.key,
      item_name: def.label,
      item_type: def.item_type,
      amount: '',
      remark: '',
      calc_mode: def.calc_mode,
      catalog_key: def.key,
      selected_option: itemConfig.selected_option,
      quantity: '',
      base_amount: '',
    }

    // base_salary 预填底薪：优先使用 custom_amount，否则用 baseSalary
    const effectiveBase = itemConfig.custom_amount ?? baseSalary
    if (def.key === 'base_salary' && effectiveBase && effectiveBase > 0) {
      const base60 = Math.round(effectiveBase * 0.6 * 100) / 100
      const perf40 = Math.round(effectiveBase * 0.4 * 100) / 100
      result.push({
        key: `${def.key}-base`,
        item_name: '基本工资(60%)',
        item_type: 'income',
        amount: String(base60),
        remark: '',
        calc_mode: 'source',
        catalog_key: def.key,
        selected_option: itemConfig.selected_option,
      })
      result.push({
        key: `${def.key}-perf`,
        item_name: '绩效工资(40%)',
        item_type: 'income',
        amount: String(perf40),
        remark: '',
        calc_mode: 'source',
        catalog_key: 'base_salary',
        base_salary_full: String(effectiveBase),
        selected_option: itemConfig.selected_option,
      })
      continue
    }

    result.push(formItem)
  }

  return result
}

/**
 * 根据计算模式计算单项金额。
 */
export function calcItemAmount(item: TemplateFormItem): number {
  if (!item.calc_mode) {
    return parseFloat(item.amount) || 0
  }

  switch (item.calc_mode) {
    case 'source':
      return parseFloat(item.amount) || 0

    case 'per_unit':
      return (item.selected_option || 0) * (parseFloat(item.quantity || '') || 0)

    case 'percentage':
      return (
        ((parseFloat(item.base_amount || '') || 0) * (item.selected_option || 0)) / 100
      )

    case 'manual_input':
      return parseFloat(item.amount) || 0

    default:
      return parseFloat(item.amount) || 0
  }
}

// ---- 阶梯模板支持 ----

/**
 * 类型守卫：判断 config 是否为阶梯模板
 */
export function isTieredConfig(config: any): config is TieredConfig {
  return config && (config.template_type === 'tiered' || 'tiers' in config)
}
