const jwt = require('jsonwebtoken')

/**
 * 验证 JWT token，将 user 信息挂到 req.user
 * 如果没有 token 或 token 无效，返回 401
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未登录，请先登录' })
  }

  const token = authHeader.split(' ')[1]
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = decoded
    next()
  } catch (err) {
    return res.status(401).json({ error: 'token无效或已过期，请重新登录' })
  }
}

/**
 * 检查 req.user.is_admin === 1，需要先经过 requireAuth
 * 如果不是管理员，返回 403
 */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.is_admin !== 1) {
    return res.status(403).json({ error: '需要管理员权限' })
  }
  next()
}

module.exports = { requireAuth, requireAdmin }
