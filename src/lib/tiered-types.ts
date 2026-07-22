import type { TemplateConfig } from './salary-catalog'

// 阶梯档位
export interface TierBracket {
  min: number            // 业绩下限（含），如 0
  max: number            // 业绩上限（含），如 50000
  salary: number         // 该档位工资总额，如 6000
  commission_rate: number // 提成比例（百分比整数），如 3 表示 3%
}

// 阶梯模板配置
export interface TieredConfig {
  version: number                    // 1
  template_type: 'tiered'
  base_salary_ratio: number          // 60（基本工资占比%）
  performance_salary_ratio: number   // 40（绩效工资占比%）
  tiers: TierBracket[]               // 阶梯档位数组
  deductions: {
    social_insurance: { enabled: boolean; amount: number }
    housing_fund: { enabled: boolean; amount: number }
    tax: { enabled: boolean }
  }
  extras: {
    bonus: { enabled: boolean }
    tutoring: { enabled: boolean }
    notes: { enabled: boolean }
  }
}

// 联合类型
export type AnyTemplateConfig = TemplateConfig | TieredConfig
