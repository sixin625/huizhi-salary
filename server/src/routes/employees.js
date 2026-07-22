const express = require('express')
const bcrypt = require('bcryptjs')
const crypto = require('crypto')
const { getDb } = require('../db')
const { requireAuth, requireAdmin } = require('../middleware/auth')

const router = express.Router()

// 员工查询 SQL 片段（JOIN 校区部门名，不含密码）
const EMPLOYEE_SELECT_SQL = `
  SELECT e.id, e.username, e.name, e.phone, e.email, e.campus_id, e.department_id,
         e.hire_date, e.base_salary, e.status, e.is_admin, e.created_at,
         c.name as campus_name, d.name as department_name
  FROM employees e
  LEFT JOIN campuses c ON e.campus_id = c.id
  LEFT JOIN departments d ON e.department_id = d.id
`

// GET /api/employees — 列表（支持 search/campus_id/department_id 筛选）
router.get('/', requireAuth, requireAdmin, (req, res) => {
  try {
    const db = getDb()
    const { search, campus_id, department_id } = req.query

    let sql = EMPLOYEE_SELECT_SQL + ' WHERE 1=1'
    const params = []

    if (search) {
      sql += ` AND (e.name LIKE ? OR e.username LIKE ? OR e.phone LIKE ?)`
      const pattern = `%${search}%`
      params.push(pattern, pattern, pattern)
    }
    if (campus_id) {
      sql += ` AND e.campus_id = ?`
      params.push(campus_id)
    }
    if (department_id) {
      sql += ` AND e.department_id = ?`
      params.push(department_id)
    }

    sql += ` ORDER BY e.created_at DESC`
    const employees = db.prepare(sql).all(...params)

    res.json({ data: employees })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/employees — 新增（密码 bcrypt 加密）
router.post('/', requireAuth, requireAdmin, (req, res) => {
  try {
    const db = getDb()
    const { username, password, name, phone, email, campus_id, department_id, hire_date, base_salary, is_admin } = req.body

    if (!username || !password || !name) {
      return res.status(400).json({ error: '用户名、密码、姓名不能为空' })
    }

    // 检查用户名唯一
    const existing = db.prepare('SELECT id FROM employees WHERE username = ?').get(username)
    if (existing) {
      return res.status(400).json({ error: '用户名已存在' })
    }

    const id = crypto.randomUUID()
    const hashedPassword = bcrypt.hashSync(password, 10)
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO employees (id, username, password, name, phone, email, campus_id, department_id, hire_date, base_salary, status, is_admin, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
    `).run(id, username, hashedPassword, name, phone || null, email || null,
          campus_id || null, department_id || null, hire_date || null,
          base_salary || 0, is_admin ? 1 : 0, now)

    // 根据部门自动初始化阶梯提成模板
    try {
      const dept = department_id
        ? db.prepare('SELECT code FROM departments WHERE id = ?').get(department_id)
        : null

      if (dept && (dept.code === 'sales' || dept.code === 'principal')) {
        const defaultTieredConfig = {
          version: 1,
          template_type: 'tiered',
          base_salary_ratio: 60,
          performance_salary_ratio: 40,
          tiers: [],
          deductions: {
            social_insurance: { enabled: false, amount: 0 },
            housing_fund: { enabled: false, amount: 0 },
            tax: { enabled: false }
          },
          extras: {
            bonus: { enabled: true },
            tutoring: { enabled: true },
            notes: { enabled: true }
          }
        }
        db.prepare(
          'INSERT OR IGNORE INTO salary_templates (id, employee_id, config, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
        ).run(
          crypto.randomUUID(),
          id,
          JSON.stringify(defaultTieredConfig),
          now,
          now
        )
      }
    } catch (err) {
      console.error('Auto-create tiered template failed:', err)
      // 不阻塞员工创建
    }

    const employee = db.prepare(EMPLOYEE_SELECT_SQL + ' WHERE e.id = ?').get(id)
    res.status(201).json({ data: employee })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/employees/:id — 编辑
router.put('/:id', requireAuth, requireAdmin, (req, res) => {
  try {
    const db = getDb()
    const { id } = req.params
    const { username, password, name, phone, email, campus_id, department_id, hire_date, base_salary, is_admin } = req.body

    const existing = db.prepare('SELECT * FROM employees WHERE id = ?').get(id)
    if (!existing) {
      return res.status(404).json({ error: '员工不存在' })
    }

    // 检查用户名唯一（如果修改了）
    if (username && username !== existing.username) {
      const conflict = db.prepare('SELECT id FROM employees WHERE username = ? AND id != ?').get(username, id)
      if (conflict) {
        return res.status(400).json({ error: '用户名已存在' })
      }
    }

    // 如果提供了新密码则加密，否则保留原密码
    const hashedPassword = password ? bcrypt.hashSync(password, 10) : existing.password

    db.prepare(`
      UPDATE employees SET username = ?, password = ?, name = ?, phone = ?, email = ?,
        campus_id = ?, department_id = ?, hire_date = ?, base_salary = ?, is_admin = ?
      WHERE id = ?
    `).run(
      username || existing.username,
      hashedPassword,
      name || existing.name,
      phone !== undefined ? (phone || null) : existing.phone,
      email !== undefined ? (email || null) : existing.email,
      campus_id !== undefined ? (campus_id || null) : existing.campus_id,
      department_id !== undefined ? (department_id || null) : existing.department_id,
      hire_date !== undefined ? (hire_date || null) : existing.hire_date,
      base_salary !== undefined ? (base_salary || 0) : existing.base_salary,
      is_admin !== undefined ? (is_admin ? 1 : 0) : existing.is_admin,
      id
    )

    const employee = db.prepare(EMPLOYEE_SELECT_SQL + ' WHERE e.id = ?').get(id)
    res.json({ data: employee })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PATCH /api/employees/:id/status — 启用/停用
router.patch('/:id/status', requireAuth, requireAdmin, (req, res) => {
  try {
    const db = getDb()
    const { id } = req.params
    const { status } = req.body

    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ error: '无效的状态' })
    }

    const existing = db.prepare('SELECT id FROM employees WHERE id = ?').get(id)
    if (!existing) {
      return res.status(404).json({ error: '员工不存在' })
    }

    db.prepare('UPDATE employees SET status = ? WHERE id = ?').run(status, id)
    res.json({ data: { id, status } })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
