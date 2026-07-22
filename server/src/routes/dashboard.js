const express = require('express')
const { getDb } = require('../db')
const { requireAuth, requireAdmin } = require('../middleware/auth')

const router = express.Router()

// 获取格式化的年月字符串 YYYY-MM
function formatYearMonth(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

// GET /api/dashboard/stats — 看板统计
router.get('/stats', requireAuth, requireAdmin, (req, res) => {
  try {
    const db = getDb()

    const now = new Date()
    const currentMonth = formatYearMonth(now)
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonth = formatYearMonth(lastMonthDate)
    const sixMonthsAgoDate = new Date(now.getFullYear(), now.getMonth() - 5, 1)
    const sixMonthsAgo = formatYearMonth(sixMonthsAgoDate)

    // 当月实发总额
    const currentMonthTotal = db.prepare(`
      SELECT COALESCE(SUM(net_salary), 0) as total
      FROM salary_records
      WHERE year_month = ?
    `).get(currentMonth).total

    // 上月实发总额
    const lastMonthTotal = db.prepare(`
      SELECT COALESCE(SUM(net_salary), 0) as total
      FROM salary_records
      WHERE year_month = ?
    `).get(lastMonth).total

    // 在职员工数
    const employeeCount = db.prepare(
      `SELECT COUNT(*) as count FROM employees WHERE status = 'active'`
    ).get().count

    // 各校区员工数
    const campusBreakdown = db.prepare(`
      SELECT c.name, COUNT(e.id) as count
      FROM campuses c
      LEFT JOIN employees e ON c.id = e.campus_id AND e.status = 'active'
      GROUP BY c.id, c.name
      ORDER BY count DESC
    `).all()

    // 各部门员工数
    const departmentBreakdown = db.prepare(`
      SELECT d.name, COUNT(e.id) as count
      FROM departments d
      LEFT JOIN employees e ON d.id = e.department_id AND e.status = 'active'
      GROUP BY d.id, d.name
      ORDER BY count DESC
    `).all()

    // 最近6个月实发趋势
    const trend = db.prepare(`
      SELECT year_month, COALESCE(SUM(net_salary), 0) as total
      FROM salary_records
      WHERE year_month >= ?
      GROUP BY year_month
      ORDER BY year_month ASC
    `).all(sixMonthsAgo)

    // 最近5条薪资记录
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
        recentRecords
      }
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
