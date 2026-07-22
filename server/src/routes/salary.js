const express = require('express')
const crypto = require('crypto')
const { getDb } = require('../db')
const { requireAuth, requireAdmin } = require('../middleware/auth')

const router = express.Router()

// 薪资记录查询 SQL 片段（JOIN 员工名/校区/部门）
const RECORD_SELECT_SQL = `
  SELECT sr.*, e.name as employee_name, e.username as employee_username,
         c.name as campus_name, d.name as department_name
  FROM salary_records sr
  JOIN employees e ON sr.employee_id = e.id
  LEFT JOIN campuses c ON sr.campus_id = c.id
  LEFT JOIN departments d ON sr.department_id = d.id
`

/**
 * 为单条记录填充明细项
 */
function fillItems(db, record) {
  if (!record) return record
  record.items = db.prepare('SELECT * FROM salary_record_items WHERE record_id = ?').all(record.id)
  return record
}

// ─── 管理员路由 ───

// GET /api/salary/records?year_month=2025-07 — 列表（含明细项）
router.get('/records', requireAuth, requireAdmin, (req, res) => {
  try {
    const db = getDb()
    const { year_month } = req.query

    let sql = RECORD_SELECT_SQL
    const params = []
    if (year_month) {
      sql += ` WHERE sr.year_month = ?`
      params.push(year_month)
    }
    sql += ` ORDER BY sr.created_at DESC`

    const records = db.prepare(sql).all(...params)
    records.forEach(r => fillItems(db, r))

    res.json({ data: records })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/salary/records/:id — 详情（含明细项）
router.get('/records/:id', requireAuth, requireAdmin, (req, res) => {
  try {
    const db = getDb()
    const { id } = req.params

    const record = db.prepare(RECORD_SELECT_SQL + ' WHERE sr.id = ?').get(id)
    if (!record) {
      return res.status(404).json({ error: '记录不存在' })
    }

    fillItems(db, record)
    res.json({ data: record })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/salary/records — 新增/更新（upsert）
router.post('/records', requireAuth, requireAdmin, (req, res) => {
  try {
    const db = getDb()
    const { employee_id, year_month, campus_id, department_id, gross_salary, total_deduction, net_salary, items } = req.body

    if (!employee_id || !year_month) {
      return res.status(400).json({ error: '员工ID和年月不能为空' })
    }

    const now = new Date().toISOString()
    const itemArray = items || []

    // 检查是否已有记录（employee_id + year_month 唯一约束）
    const existing = db.prepare('SELECT id FROM salary_records WHERE employee_id = ? AND year_month = ?').get(employee_id, year_month)

    const insertItemStmt = db.prepare(
      'INSERT INTO salary_record_items (id, record_id, item_name, item_type, amount, remark) VALUES (?, ?, ?, ?, ?, ?)'
    )

    const insertItems = db.transaction((recordId) => {
      // 删除旧明细项（如果有）
      db.prepare('DELETE FROM salary_record_items WHERE record_id = ?').run(recordId)
      // 插入新明细项
      for (const item of itemArray) {
        insertItemStmt.run(
          crypto.randomUUID(), recordId,
          item.item_name, item.item_type, item.amount,
          item.remark || null
        )
      }
    })

    if (existing) {
      // 更新已有记录
      db.prepare(`
        UPDATE salary_records SET campus_id = ?, department_id = ?, gross_salary = ?,
          total_deduction = ?, net_salary = ?, updated_at = ?
        WHERE id = ?
      `).run(
        campus_id || null, department_id || null,
        gross_salary || 0, total_deduction || 0, net_salary || 0,
        now, existing.id
      )
      insertItems(existing.id)

      const record = db.prepare(RECORD_SELECT_SQL + ' WHERE sr.id = ?').get(existing.id)
      fillItems(db, record)
      res.json({ data: record })
    } else {
      // 插入新记录
      const id = crypto.randomUUID()
      db.prepare(`
        INSERT INTO salary_records (id, employee_id, year_month, campus_id, department_id,
          gross_salary, total_deduction, net_salary, status, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)
      `).run(
        id, employee_id, year_month,
        campus_id || null, department_id || null,
        gross_salary || 0, total_deduction || 0, net_salary || 0,
        req.user.id, now, now
      )
      insertItems(id)

      const record = db.prepare(RECORD_SELECT_SQL + ' WHERE sr.id = ?').get(id)
      fillItems(db, record)
      res.status(201).json({ data: record })
    }
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/salary/records/:id — 删除记录（先删明细项，再删主记录）
router.delete('/records/:id', requireAuth, requireAdmin, (req, res) => {
  try {
    const db = getDb()
    const { id } = req.params

    const existing = db.prepare('SELECT id FROM salary_records WHERE id = ?').get(id)
    if (!existing) {
      return res.status(404).json({ error: '记录不存在' })
    }

    // 先删除明细项，再删除主记录
    db.prepare('DELETE FROM salary_record_items WHERE record_id = ?').run(id)
    db.prepare('DELETE FROM salary_records WHERE id = ?').run(id)

    res.json({ data: { id, deleted: true } })
  } catch (err) {
    console.error('Delete salary record error:', err)
    res.status(500).json({ error: err.message })
  }
})

// PATCH /api/salary/records/:id/status — 发布/撤回
router.patch('/records/:id/status', requireAuth, requireAdmin, (req, res) => {
  try {
    const db = getDb()
    const { id } = req.params
    const { status } = req.body

    if (!['published', 'draft'].includes(status)) {
      return res.status(400).json({ error: '无效的状态' })
    }

    const existing = db.prepare('SELECT id FROM salary_records WHERE id = ?').get(id)
    if (!existing) {
      return res.status(404).json({ error: '记录不存在' })
    }

    db.prepare('UPDATE salary_records SET status = ?, updated_at = ? WHERE id = ?')
      .run(status, new Date().toISOString(), id)

    res.json({ data: { id, status } })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── 员工路由（需认证，非admin） ───

// GET /api/salary/my-records — 当前用户的已发布工资条列表
router.get('/my-records', requireAuth, (req, res) => {
  try {
    const db = getDb()
    const records = db.prepare(`
      SELECT sr.id, sr.employee_id, sr.year_month, sr.gross_salary, sr.total_deduction,
             sr.net_salary, sr.status, sr.campus_id, sr.department_id,
             e.name as employee_name, c.name as campus_name, d.name as department_name
      FROM salary_records sr
      JOIN employees e ON sr.employee_id = e.id
      LEFT JOIN campuses c ON sr.campus_id = c.id
      LEFT JOIN departments d ON sr.department_id = d.id
      WHERE sr.employee_id = ? AND sr.status = 'published'
      ORDER BY sr.year_month DESC
    `).all(req.user.id)

    res.json({ data: records })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/salary/my-records/:month — 当前用户指定月份工资条详情
router.get('/my-records/:month', requireAuth, (req, res) => {
  try {
    const db = getDb()
    const { month } = req.params

    const record = db.prepare(RECORD_SELECT_SQL + `
      WHERE sr.employee_id = ? AND sr.year_month = ? AND sr.status = 'published'
    `).get(req.user.id, month)

    if (!record) {
      return res.status(404).json({ error: '工资条不存在或未发布' })
    }

    fillItems(db, record)
    res.json({ data: record })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
