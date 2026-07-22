require('dotenv').config()

const path = require('path')
const express = require('express')
const cors = require('cors')
const { initDb } = require('./db')

const app = express()

// 中间件
app.use(cors())
app.use(express.json())

// 初始化数据库
initDb()

// 路由
app.use('/api/auth', require('./routes/auth'))
app.use('/api/employees', require('./routes/employees'))
app.use('/api/salary', require('./routes/salary'))
app.use('/api/dashboard', require('./routes/dashboard'))
app.use('/api/campuses', require('./routes/campuses'))
app.use('/api/departments', require('./routes/departments'))
app.use('/api/salary-templates', require('./routes/salary-templates'))

// 健康检查（供部署平台探活 / 部署验证）
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() })
})

// 生产环境：托管前端静态文件（单服务架构，前后端同源）
const isProd = process.env.NODE_ENV === 'production'
if (isProd) {
  const distDir = path.join(__dirname, '../../dist')
  app.use(express.static(distDir))
  // SPA 回退：非 /api 路径一律返回 index.html
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(distDir, 'index.html'))
  })
}

// 统一错误处理 — 404（仅命中未知 /api 路由）
app.use((req, res) => {
  res.status(404).json({ error: '接口不存在' })
})

// 统一错误处理 — 500
app.use((err, req, res, next) => {
  console.error('服务器错误:', err)
  res.status(500).json({ error: '服务器内部错误' })
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT} (${isProd ? 'production' : 'development'})`)
})
