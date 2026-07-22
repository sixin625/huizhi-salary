const express = require('express')
const { getDb } = require('../db')
const { requireAuth } = require('../middleware/auth')

const router = express.Router()

// GET /api/departments — 部门列表
router.get('/', requireAuth, (req, res) => {
  try {
    const db = getDb()
    const departments = db.prepare('SELECT * FROM departments ORDER BY name').all()
    res.json({ data: departments })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
