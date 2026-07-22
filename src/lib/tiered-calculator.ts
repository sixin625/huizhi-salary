import type { TierBracket, TieredConfig } from './tiered-types'

/** 精确到分 */
function round2(x: number): number {
  return Math.round(x * 100) / 100
}

/**
 * 匹配业绩档位：根据 performance 找到命中档位。
 * 若 performance 超过所有档位上限，返回最后一个档位。
 * 若 performance 低于所有档位下限，返回第一个档位。
 */
export function findTier(tiers: TierBracket[], performance: number): TierBracket {
  for (const tier of tiers) {
    if (performance >= tier.min && performance <= tier.max) {
      return tier
    }
  }
  // 超过最高档 → 返回最高档
  if (performance > tiers[tiers.length - 1].max) {
    return tiers[tiers.length - 1]
  }
  // 低于最低档 → 返回最低档
  return tiers[0]
}

/**
 * 计算分段累进提成。
 *
 * 算法：遍历每个档位，计算段内 applicable × rate / 100，累加。
 */
export function calcMarginalCommission(tiers: TierBracket[], performance: number): number {
  let commission = 0
  let remaining = performance

  for (const tier of tiers) {
    const rangeSize = tier.max - tier.min
    const applicable = Math.min(remaining, rangeSize)
    if (applicable <= 0) break
    commission += applicable * tier.commission_rate / 100
    remaining -= applicable
  }

  return round2(commission)
}

/**
 * 提成明细（分段）
 */
export interface CommissionSegment {
  label: string        // 如 "0-5万"
  amount: number       // 该段业绩金额
  rate: number         // 该段比例
  commission: number   // 该段提成
}

/** 格式化档位标签，如 "0-5万" */
function tierLabel(tier: TierBracket): string {
  const fmtWan = (n: number) => {
    if (n >= 10000) return `${n / 10000}万`
    return String(n)
  }
  return `${fmtWan(tier.min)}-${fmtWan(tier.max)}`
}

/**
 * 完整薪资计算
 */
export function calcTieredSalary(params: {
  config: TieredConfig
  actualPerformance: number
  targetPerformance: number
  bonus: number
  tutoring: number
  socialInsurance: number
  housingFund: number
  tax: number
}): {
  baseSalary: number
  performanceSalary: number
  performanceRatio: number
  commission: number
  commissionBreakdown: CommissionSegment[]
  grossTotal: number
  deductionTotal: number
  netTotal: number
} {
  const {
    config,
    actualPerformance,
    targetPerformance,
    bonus,
    tutoring,
    socialInsurance,
    housingFund,
    tax,
  } = params

  // 1. 匹配档位
  const matchedTier = findTier(config.tiers, actualPerformance)

  // 2. 基本工资
  const baseSalary = round2(matchedTier.salary * config.base_salary_ratio / 100)

  // 3. 绩效工资
  const performanceRatio = targetPerformance > 0
    ? actualPerformance / targetPerformance
    : 0
  const performanceSalary = round2(
    matchedTier.salary * config.performance_salary_ratio / 100 * performanceRatio,
  )

  // 4. 分段累进提成 + 明细
  const commissionBreakdown: CommissionSegment[] = []
  let commission = 0
  let remaining = actualPerformance

  for (const tier of config.tiers) {
    const rangeSize = tier.max - tier.min
    const applicable = Math.min(remaining, rangeSize)
    if (applicable <= 0) break
    const segCommission = round2(applicable * tier.commission_rate / 100)
    commissionBreakdown.push({
      label: tierLabel(tier),
      amount: applicable,
      rate: tier.commission_rate,
      commission: segCommission,
    })
    commission += segCommission
    remaining -= applicable
  }
  commission = round2(commission)

  // 5. 汇总
  const grossTotal = round2(baseSalary + performanceSalary + commission + bonus + tutoring)
  const deductionTotal = round2(socialInsurance + housingFund + tax)
  const netTotal = round2(grossTotal - deductionTotal)

  return {
    baseSalary,
    performanceSalary,
    performanceRatio,
    commission,
    commissionBreakdown,
    grossTotal,
    deductionTotal,
    netTotal,
  }
}
