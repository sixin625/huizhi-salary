const express = require('express')
const { getDb } = require('../db')
const { requireAuth } = require('../middleware/auth')

const router = express.Router()

// GET /api/campuses — 校区列表
router.get('/', requireAuth, (req, res) => {
  try {
    const db = getDb()
    const campuses = db.prepare('SELECT * FROM campuses ORDER BY name').all()
    res.json({ data: campuses })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
