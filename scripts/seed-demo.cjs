#!/usr/bin/env node
/**
 * 演示数据种子脚本（幂等）
 * 为现有员工生成最近 12 个月（含当前月）的薪资记录，
 * 用于让「数据看板」的按月筛选 / 趋势 / 对比有数据可看。
 *
 * 用法：
 *   DB_PATH=/path/to/salary.db node scripts/seed-demo.js
 * 不传 DB_PATH 时默认 ./server/data/salary.db
 */
const path = require('path')
const crypto = require('crypto')
// better-sqlite3 安装在 server/node_modules 下，从脚本目录向上定位
const Database = require(path.join(__dirname, '..', 'server', 'node_modules', 'better-sqlite3'))

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'server', 'data', 'salary.db')
const db = new Database(dbPath)
db.pragma('journal_mode = WAL')

// ---- 简易可复现伪随机 ----
function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function hashStr(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
const r2 = (x) => Math.round(x * 100) / 100

// 每位员工的应发区间与是否含社保公积金
const EMP_CONFIG = {
  tom:           { min: 5000,  max: 6800,  social: false },
  jerry:         { min: 5200,  max: 9200,  social: false },
  wangxiaojuan:  { min: 9000,  max: 21000, social: false },
  zhaohongxing:  { min: 11000, max: 26000, social: true  },
  huahua:        { min: 6000,  max: 14000, social: false },
  fengluxin:     { min: 6200,  max: 16000, social: true  },
  admin:         { min: 8000,  max: 12000, social: false },
}
const DEFAULT_CFG = { min: 6000, max: 12000, social: false }

const now = new Date()
const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

// 最近 12 个月（含当前月）
const months = []
for (let i = 11; i >= 0; i--) {
  const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
  months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
}

const employees = db
  .prepare('SELECT id, username, name, campus_id, department_id FROM employees')
  .all()

const insert = db.prepare(`
  INSERT OR IGNORE INTO salary_records
    (id, employee_id, year_month, campus_id, department_id, gross_salary, total_deduction, net_salary, status, created_by, created_at, updated_at)
  VALUES (@id, @employee_id, @year_month, @campus_id, @department_id, @gross_salary, @total_deduction, @net_salary, @status, NULL, @created_at, @updated_at)
`)

let inserted = 0
const tx = db.transaction(() => {
  for (const month of months) {
    const [y, m] = month.split('-').map(Number)
    for (const emp of employees) {
      const cfg = EMP_CONFIG[emp.username] || DEFAULT_CFG
      const rng = mulberry32(hashStr(emp.username + '|' + month))
      // 轻微的月度增长趋势，让趋势图更自然
      const monthIndex = months.indexOf(month)
      const trend = 1 + monthIndex * 0.012
      const base = cfg.min + Math.floor(rng() * (cfg.max - cfg.min))
      const gross = r2(base * trend)
      let deduction = 0
      if (cfg.social) deduction += 638.91 // 社保 463.91 + 公积金 175
      deduction += r2(gross * (0.03 + rng() * 0.05))
      const net = r2(gross - deduction)
      const status = month === currentMonth ? 'draft' : 'published'
      const createdAt = `${month}-15T10:00:00.000Z`
      const info = insert.run({
        id: crypto.randomUUID(),
        employee_id: emp.id,
        year_month: month,
        campus_id: emp.campus_id,
        department_id: emp.department_id,
        gross_salary: gross,
        total_deduction: deduction,
        net_salary: net,
        status,
        created_at: createdAt,
        updated_at: createdAt,
      })
      inserted += info.changes
    }
  }
})
tx()

console.log(`✓ 演示数据写入完成：本次新增 ${inserted} 条薪资记录（覆盖 ${months.length} 个月 / ${employees.length} 名员工）。`)
console.log('  月份范围：', months[0], '→', months[months.length - 1])
db.close()
