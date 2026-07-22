const express = require('express')
const crypto = require('crypto')
const { getDb } = require('../db')
const { requireAuth, requireAdmin } = require('../middleware/auth')

const router = express.Router()

// GET /api/salary-templates/:employeeId — 获取员工模板
router.get('/:employeeId', requireAuth, requireAdmin, (req, res) => {
  try {
    const db = getDb()
    const { employeeId } = req.params

    const template = db.prepare(
      'SELECT id, employee_id, config, created_at, updated_at FROM salary_templates WHERE employee_id = ?'
    ).get(employeeId)

    if (!template) {
      return res.json({ data: null })
    }

    // 解析 config JSON
    let config
    try {
      config = JSON.parse(template.config)
    } catch {
      config = { version: 1, items: {} }
    }

    res.json({ data: { ...template, config } })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/salary-templates/:employeeId — 创建或更新模板
router.put('/:employeeId', requireAuth, requireAdmin, (req, res) => {
  try {
    const db = getDb()
    const { employeeId } = req.params
    const { config } = req.body

    if (!config) {
      return res.status(400).json({ error: '缺少 config 字段' })
    }

    // 验证员工存在
    const employee = db.prepare('SELECT id FROM employees WHERE id = ?').get(employeeId)
    if (!employee) {
      return res.status(404).json({ error: '员工不存在' })
    }

    // 序列化 config
    const configStr = typeof config === 'string' ? config : JSON.stringify(config)

    const now = new Date().toISOString()

    // upsert: INSERT OR REPLACE
    const existing = db.prepare('SELECT id FROM salary_templates WHERE employee_id = ?').get(employeeId)

    if (existing) {
      db.prepare(
        'UPDATE salary_templates SET config = ?, updated_at = ? WHERE employee_id = ?'
      ).run(configStr, now, employeeId)
    } else {
      db.prepare(`
        INSERT INTO salary_templates (id, employee_id, config, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(crypto.randomUUID(), employeeId, configStr, now, now)
    }

    const template = db.prepare(
      'SELECT id, employee_id, config, created_at, updated_at FROM salary_templates WHERE employee_id = ?'
    ).get(employeeId)

    let parsedConfig
    try {
      parsedConfig = JSON.parse(template.config)
    } catch {
      parsedConfig = { version: 1, items: {} }
    }

    res.json({ data: { ...template, config: parsedConfig } })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
