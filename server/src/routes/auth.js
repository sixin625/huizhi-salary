const express = require('express')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const { getDb } = require('../db')
const { requireAuth, requireAdmin } = require('../middleware/auth')

const router = express.Router()

// POST /api/auth/login — 验证用户名密码，返回 JWT token + 用户信息
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' })
    }

    const db = getDb()
    const user = db.prepare(`
      SELECT e.*, c.name as campus_name, d.name as department_name
      FROM employees e
      LEFT JOIN campuses c ON e.campus_id = c.id
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE e.username = ?
    `).get(username)

    if (!user) {
      return res.status(401).json({ error: '用户名或密码错误' })
    }

    if (user.status !== 'active') {
      return res.status(403).json({ error: '账号已停用，请联系管理员' })
    }

    if (!bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: '用户名或密码错误' })
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, is_admin: user.is_admin },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        is_admin: user.is_admin,
        campus_id: user.campus_id,
        campus_name: user.campus_name,
        department_id: user.department_id,
        department_name: user.department_name
      }
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/auth/me — 返回当前用户信息（含校区/部门名）
router.get('/me', requireAuth, (req, res) => {
  try {
    const db = getDb()
    const user = db.prepare(`
      SELECT e.id, e.username, e.name, e.phone, e.email, e.campus_id, e.department_id,
             e.hire_date, e.base_salary, e.status, e.is_admin, e.created_at,
             c.name as campus_name, d.name as department_name
      FROM employees e
      LEFT JOIN campuses c ON e.campus_id = c.id
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE e.id = ?
    `).get(req.user.id)

    if (!user) {
      return res.status(404).json({ error: '用户不存在' })
    }

    res.json({ user })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/auth/logout — 简单返回成功（JWT 无服务端状态）
router.post('/logout', (req, res) => {
  res.json({ success: true })
})

// POST /api/auth/change-password — 修改当前登录用户密码（需登录）
router.post('/change-password', requireAuth, (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: '原密码和新密码不能为空' })
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: '新密码长度至少 6 位' })
    }
    if (oldPassword === newPassword) {
      return res.status(400).json({ error: '新密码不能与原密码相同' })
    }

    const db = getDb()
    const user = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.user.id)
    if (!user) {
      return res.status(404).json({ error: '用户不存在' })
    }

    if (!bcrypt.compareSync(oldPassword, user.password)) {
      return res.status(401).json({ error: '原密码错误' })
    }

    const hash = bcrypt.hashSync(newPassword, 10)
    db.prepare('UPDATE employees SET password = ? WHERE id = ?').run(hash, user.id)

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/auth/update-profile — 修改账号资料（仅管理员，可改用户名/姓名/手机/邮箱）
router.post('/update-profile', requireAuth, requireAdmin, (req, res) => {
  try {
    const { username, name, phone, email } = req.body || {}
    const db = getDb()
    const current = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.user.id)
    if (!current) {
      return res.status(404).json({ error: '用户不存在' })
    }

    const updates = {}
    if (username !== undefined && username !== current.username) {
      const u = String(username).trim()
      if (u.length < 3) {
        return res.status(400).json({ error: '用户名至少 3 个字符' })
      }
      const clash = db
        .prepare('SELECT id FROM employees WHERE username = ? AND id != ?')
        .get(u, current.id)
      if (clash) {
        return res.status(400).json({ error: '该用户名已被占用' })
      }
      updates.username = u
    }
    if (name !== undefined) {
      const n = String(name).trim()
      if (!n) {
        return res.status(400).json({ error: '姓名不能为空' })
      }
      updates.name = n
    }
    if (phone !== undefined) updates.phone = phone === '' ? null : String(phone)
    if (email !== undefined) updates.email = email === '' ? null : String(email)

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: '没有可更新的内容' })
    }

    const setClause = Object.keys(updates)
      .map((k) => `${k} = ?`)
      .join(', ')
    db.prepare(`UPDATE employees SET ${setClause} WHERE id = ?`).run(
      ...Object.values(updates),
      current.id
    )

    const user = db.prepare(`
      SELECT e.id, e.username, e.name, e.phone, e.email, e.campus_id, e.department_id,
             e.hire_date, e.base_salary, e.status, e.is_admin, e.created_at,
             c.name as campus_name, d.name as department_name
      FROM employees e
      LEFT JOIN campuses c ON e.campus_id = c.id
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE e.id = ?
    `).get(current.id)

    res.json({ success: true, user })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
