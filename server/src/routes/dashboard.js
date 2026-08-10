const express = require('express')
const { getDb } = require('../db')
const { requireAuth, requireAdmin } = require('../middleware/auth')

const router = express.Router()

// 格式化 Date 为 YYYY-MM
function formatYearMonth(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

// 解析 YYYY-MM → { y, m }
function parseYM(ym) {
  const [y, m] = String(ym).split('-').map(Number)
  return { y, m }
}

// 由年、月(1-12) 拼回 YYYY-MM
function toYM(y, m) {
  return `${y}-${String(m).padStart(2, '0')}`
}

// 生成 [startYM, endYM] 区间内的所有月份（降序，最新在前）
function listMonthsDesc(startYM, endYM) {
  const s = parseYM(startYM)
  const e = parseYM(endYM)
  let cur = new Date(e.y, e.m - 1, 1)
  const stop = new Date(s.y, s.m - 1, 1)
  const out = []
  // 防止异常循环
  let guard = 0
  while (cur >= stop && guard < 600) {
    out.push(toYM(cur.getFullYear(), cur.getMonth() + 1))
    cur = new Date(cur.getFullYear(), cur.getMonth() - 1, 1)
    guard++
  }
  return out
}

// 四舍五入到 2 位小数
function r2(x) {
  return Math.round((Number(x) || 0) * 100) / 100
}

// 同比增长率，分母为 0 时返回 null
function pctChange(curr, prev) {
  if (!prev || prev === 0) return null
  return r2(((curr - prev) / prev) * 100)
}

// ============================================================
// GET /api/dashboard/monthly?month=YYYY-MM — 按月数据看板
// 返回选定月份的核心指标、环比对比、12 个月趋势、校区/部门对比、员工明细
// 以及可供选择的月份列表。
// ============================================================
router.get('/monthly', requireAuth, requireAdmin, (req, res) => {
  try {
    const db = getDb()
    const now = new Date()
    const currentMonth = formatYearMonth(now)

    // 选定月份（校验格式，缺省取当前月）
    const monthParam = req.query.month
    const month =
      typeof monthParam === 'string' && /^\d{4}-\d{2}$/.test(monthParam)
        ? monthParam
        : currentMonth

    const { y, m } = parseYM(month)

    // 上一月（用于环比）
    const prevDate = new Date(y, m - 2, 1)
    const prevMonth = formatYearMonth(prevDate)

    // ---- 选定月汇总 ----
    const summary = db
      .prepare(
        `SELECT
           COALESCE(SUM(net_salary), 0)      AS netTotal,
           COALESCE(SUM(gross_salary), 0)    AS grossTotal,
           COALESCE(SUM(total_deduction), 0) AS deductionTotal,
           COUNT(*)                          AS recordCount,
           COUNT(DISTINCT employee_id)       AS paidCount,
           SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) AS publishedCount,
           SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END)     AS draftCount,
           COALESCE(AVG(net_salary), 0)      AS avgNet
         FROM salary_records
         WHERE year_month = ?`
      )
      .get(month)

    // ---- 上一月汇总（用于环比） ----
    const prev = db
      .prepare(
        `SELECT
           COALESCE(SUM(net_salary), 0)      AS netTotal,
           COALESCE(SUM(gross_salary), 0)    AS grossTotal,
           COUNT(DISTINCT employee_id)       AS paidCount
         FROM salary_records
         WHERE year_month = ?`
      )
      .get(prevMonth)

    // ---- 趋势：选定月往前 12 个月（含选定月），连续补齐缺失月为 0 ----
    const trendStartYM = toYM(y, m - 11)
    const rawTrend = db
      .prepare(
        `SELECT year_month, COALESCE(SUM(net_salary), 0) AS total
           FROM salary_records
          WHERE year_month >= ? AND year_month <= ?
          GROUP BY year_month
          ORDER BY year_month ASC`
      )
      .all(trendStartYM, month)
    const totalMap = new Map(rawTrend.map((t) => [t.year_month, r2(t.total)]))
    const trend = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(y, m - 1 - i, 1)
      const ym = toYM(d.getFullYear(), d.getMonth() + 1)
      const [, mm] = ym.split('-')
      trend.push({
        year_month: ym,
        month: `${parseInt(mm, 10)}月`,
        total: totalMap.get(ym) || 0,
      })
    }

    // ---- 校区对比（选定月） ----
    const campusBreakdown = db
      .prepare(
        `SELECT c.name,
                COALESCE(SUM(sr.net_salary), 0) AS net,
                COUNT(sr.id)                    AS count
           FROM campuses c
           LEFT JOIN salary_records sr ON c.id = sr.campus_id AND sr.year_month = ?
          GROUP BY c.id, c.name
          ORDER BY net DESC`
      )
      .all(month)

    // ---- 部门对比（选定月） ----
    const departmentBreakdown = db
      .prepare(
        `SELECT d.name,
                COALESCE(SUM(sr.net_salary), 0) AS net,
                COUNT(sr.id)                    AS count
           FROM departments d
           LEFT JOIN salary_records sr ON d.id = sr.department_id AND sr.year_month = ?
          GROUP BY d.id, d.name
          ORDER BY net DESC`
      )
      .all(month)

    // ---- 员工明细（选定月，按实发降序） ----
    const detail = db
      .prepare(
        `SELECT sr.id, sr.employee_id,
                e.name        AS employee_name,
                c.name        AS campus_name,
                d.name        AS department_name,
                sr.gross_salary, sr.total_deduction, sr.net_salary, sr.status
           FROM salary_records sr
           JOIN employees e ON sr.employee_id = e.id
           LEFT JOIN campuses c ON sr.campus_id = c.id
           LEFT JOIN departments d ON sr.department_id = d.id
          WHERE sr.year_month = ?
          ORDER BY sr.net_salary DESC`
      )
      .all(month)

    // ---- 可选月份列表：从最早有数据月份（至多回溯 24 个月）到当前月 ----
    const minRow = db.prepare(`SELECT MIN(year_month) AS minYM FROM salary_records`).get()
    let startMonthForSelect = minRow && minRow.minYM ? minRow.minYM : trendStartYM
    const earliestAllowed = formatYearMonth(new Date(now.getFullYear(), now.getMonth() - 23, 1))
    if (startMonthForSelect < earliestAllowed) startMonthForSelect = earliestAllowed
    const availableMonths = listMonthsDesc(startMonthForSelect, currentMonth)

    // ---- 默认选中月份：有数据则取最新有数据的月份，否则取当前月 ----
    const latestWithData = db
      .prepare(`SELECT MAX(year_month) AS ym FROM salary_records`)
      .get()
    const defaultMonth =
      latestWithData && latestWithData.ym ? latestWithData.ym : currentMonth

    res.json({
      data: {
        month,
        prevMonth,
        defaultMonth,
        currentMonth,
        availableMonths,
        summary: {
          netTotal: r2(summary.netTotal),
          grossTotal: r2(summary.grossTotal),
          deductionTotal: r2(summary.deductionTotal),
          recordCount: summary.recordCount || 0,
          paidCount: summary.paidCount || 0,
          publishedCount: summary.publishedCount || 0,
          draftCount: summary.draftCount || 0,
          avgNet: r2(summary.avgNet),
        },
        comparison: {
          prevMonth,
          netTotalPrev: r2(prev.netTotal),
          grossTotalPrev: r2(prev.grossTotal),
          paidCountPrev: prev.paidCount || 0,
          netChange: r2(summary.netTotal - prev.netTotal),
          netChangePct: pctChange(summary.netTotal, prev.netTotal),
          grossChangePct: pctChange(summary.grossTotal, prev.grossTotal),
          paidChange: (summary.paidCount || 0) - (prev.paidCount || 0),
        },
        trend,
        campusBreakdown: campusBreakdown.map((c) => ({
          name: c.name,
          net: r2(c.net),
          count: c.count || 0,
        })),
        departmentBreakdown: departmentBreakdown.map((d) => ({
          name: d.name,
          net: r2(d.net),
          count: d.count || 0,
        })),
        detail: detail.map((r) => ({
          id: r.id,
          employee_id: r.employee_id,
          employee_name: r.employee_name,
          campus_name: r.campus_name,
          department_name: r.department_name,
          gross_salary: r2(r.gross_salary),
          total_deduction: r2(r.total_deduction),
          net_salary: r2(r.net_salary),
          status: r.status,
        })),
      },
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ============================================================
// GET /api/dashboard/stats — 旧版总览（保留兼容）
// ============================================================
router.get('/stats', requireAuth, requireAdmin, (req, res) => {
  try {
    const db = getDb()

    const now = new Date()
    const currentMonth = formatYearMonth(now)
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonth = formatYearMonth(lastMonthDate)
    const sixMonthsAgoDate = new Date(now.getFullYear(), now.getMonth() - 5, 1)
    const sixMonthsAgo = formatYearMonth(sixMonthsAgoDate)

    const currentMonthTotal = db.prepare(`
      SELECT COALESCE(SUM(net_salary), 0) as total
      FROM salary_records
      WHERE year_month = ?
    `).get(currentMonth).total

    const lastMonthTotal = db.prepare(`
      SELECT COALESCE(SUM(net_salary), 0) as total
      FROM salary_records
      WHERE year_month = ?
    `).get(lastMonth).total

    const employeeCount = db.prepare(
      `SELECT COUNT(*) as count FROM employees WHERE status = 'active'`
    ).get().count

    const campusBreakdown = db.prepare(`
      SELECT c.name, COUNT(e.id) as count
      FROM campuses c
      LEFT JOIN employees e ON c.id = e.campus_id AND e.status = 'active'
      GROUP BY c.id, c.name
      ORDER BY count DESC
    `).all()

    const departmentBreakdown = db.prepare(`
      SELECT d.name, COUNT(e.id) as count
      FROM departments d
      LEFT JOIN employees e ON d.id = e.department_id AND e.status = 'active'
      GROUP BY d.id, d.name
      ORDER BY count DESC
    `).all()

    const trend = db.prepare(`
      SELECT year_month, COALESCE(SUM(net_salary), 0) as total
      FROM salary_records
      WHERE year_month >= ?
      GROUP BY year_month
      ORDER BY year_month ASC
    `).all(sixMonthsAgo)

    const recentRecords = db.prepare(`
      SELECT sr.id, sr.employee_id, sr.year_month, sr.gross_salary, sr.total_deduction,
             sr.net_salary, sr.status, sr.created_at,
             e.name as employee_name, c.name as campus_name, d.name as department_name
      FROM salary_records sr
      JOIN employees e ON sr.employee_id = e.id
      LEFT JOIN campuses c ON sr.campus_id = c.id
      LEFT JOIN departments d ON sr.department_id = d.id
      ORDER BY sr.created_at DESC
      LIMIT 5
    `).all()

    res.json({
      data: {
        currentMonthTotal,
        lastMonthTotal,
        employeeCount,
        campusBreakdown,
        departmentBreakdown,
        trend,
        recentRecords,
      },
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
