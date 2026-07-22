import type { TierBracket, TieredConfig } from './tiered-types'

// ============================================================
// 共用前4档（花花老师 & 冯璐新）
// ============================================================
const PRESET_A_TIERS: TierBracket[] = [
  { min: 0, max: 50000, salary: 6000, commission_rate: 2 },
  { min: 50000, max: 100000, salary: 6000, commission_rate: 4 },
  { min: 100000, max: 150000, salary: 6500, commission_rate: 6 },
  { min: 150000, max: 200000, salary: 7000, commission_rate: 7 },
]

// ============================================================
// 王晓娟（6档 0-300000）
// ============================================================
export const PRESET_WANG_XIAO_JUAN: TieredConfig = {
  version: 1,
  template_type: 'tiered',
  base_salary_ratio: 60,
  performance_salary_ratio: 40,
  tiers: [
    { min: 0, max: 50000, salary: 6000, commission_rate: 3 },
    { min: 50000, max: 100000, salary: 6000, commission_rate: 4 },
    { min: 100000, max: 150000, salary: 6500, commission_rate: 6 },
    { min: 150000, max: 200000, salary: 7000, commission_rate: 7 },
    { min: 200000, max: 250000, salary: 8000, commission_rate: 8 },
    { min: 250000, max: 300000, salary: 8000, commission_rate: 9 },
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

// ============================================================
// 赵红星（8档 0-400000，社保463.91+公积金175）
// ============================================================
export const PRESET_ZHAO_HONG_XING: TieredConfig = {
  version: 1,
  template_type: 'tiered',
  base_salary_ratio: 60,
  performance_salary_ratio: 40,
  tiers: [
    { min: 0, max: 50000, salary: 10000, commission_rate: 4 },
    { min: 50000, max: 100000, salary: 10000, commission_rate: 5 },
    { min: 100000, max: 150000, salary: 10500, commission_rate: 6 },
    { min: 150000, max: 200000, salary: 11000, commission_rate: 7 },
    { min: 200000, max: 250000, salary: 11500, commission_rate: 8 },
    { min: 250000, max: 300000, salary: 12000, commission_rate: 9 },
    { min: 300000, max: 350000, salary: 12500, commission_rate: 10 },
    { min: 350000, max: 400000, salary: 13000, commission_rate: 11 },
  ],
  deductions: {
    social_insurance: { enabled: true, amount: 463.91 },
    housing_fund: { enabled: true, amount: 175 },
    tax: { enabled: false },
  },
  extras: {
    bonus: { enabled: false },
    tutoring: { enabled: false },
    notes: { enabled: false },
  },
}

// ============================================================
// 花花老师（4档 0-200000）
// ============================================================
export const PRESET_HUA_HUA: TieredConfig = {
  version: 1,
  template_type: 'tiered',
  base_salary_ratio: 60,
  performance_salary_ratio: 40,
  tiers: PRESET_A_TIERS.map(t => ({ ...t })),
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

// ============================================================
// 冯璐新（6档 0-250000，社保463.91+公积金175）
// ============================================================
export const PRESET_FENG_LU_XIN: TieredConfig = {
  version: 1,
  template_type: 'tiered',
  base_salary_ratio: 60,
  performance_salary_ratio: 40,
  tiers: [
    ...PRESET_A_TIERS.map(t => ({ ...t })),
    { min: 200000, max: 250000, salary: 8000, commission_rate: 8 },
  ],
  deductions: {
    social_insurance: { enabled: true, amount: 463.91 },
    housing_fund: { enabled: true, amount: 175 },
    tax: { enabled: false },
  },
  extras: {
    bonus: { enabled: false },
    tutoring: { enabled: false },
    notes: { enabled: false },
  },
}

// ============================================================
// 预设列表 — 供 UI "从预设加载" 下拉使用
// ============================================================
export const TIER_PRESETS: Array<{ id: string; name: string; config: TieredConfig }> = [
  { id: 'wang_xiao_juan', name: '王晓娟', config: PRESET_WANG_XIAO_JUAN },
  { id: 'zhao_hong_xing', name: '赵红星', config: PRESET_ZHAO_HONG_XING },
  { id: 'hua_hua', name: '花花老师', config: PRESET_HUA_HUA },
  { id: 'feng_lu_xin', name: '冯璐新', config: PRESET_FENG_LU_XIN },
]
