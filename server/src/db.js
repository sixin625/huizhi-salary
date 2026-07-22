const Database = require('better-sqlite3')
const bcrypt = require('bcryptjs')
const crypto = require('crypto')
const path = require('path')
const fs = require('fs')

let db = null

/**
 * 初始化 SQLite 数据库，创建表结构和种子数据
 * @returns {Database} better-sqlite3 数据库实例
 */
function initDb() {
  if (db) return db

  // 确保数据目录存在
  // DB_PATH 可指向持久化卷（如 Render/Railway 挂载盘），未设置则用默认本地目录
  const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'salary.db')
  const dataDir = path.dirname(dbPath)
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }

  // 创建/打开数据库
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  // 创建表结构
  db.exec(`
    CREATE TABLE IF NOT EXISTS campuses (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      code TEXT UNIQUE,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS departments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      code TEXT UNIQUE,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      campus_id TEXT,
      department_id TEXT,
      hire_date TEXT,
      base_salary REAL,
      status TEXT DEFAULT 'active',
      is_admin INTEGER DEFAULT 0,
      created_at TEXT,
      FOREIGN KEY (campus_id) REFERENCES campuses(id),
      FOREIGN KEY (department_id) REFERENCES departments(id)
    );

    CREATE TABLE IF NOT EXISTS salary_records (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL,
      year_month TEXT NOT NULL,
      campus_id TEXT,
      department_id TEXT,
      gross_salary REAL,
      total_deduction REAL DEFAULT 0,
      net_salary REAL,
      status TEXT DEFAULT 'draft',
      created_by TEXT,
      created_at TEXT,
      updated_at TEXT,
      UNIQUE(employee_id, year_month),
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS salary_record_items (
      id TEXT PRIMARY KEY,
      record_id TEXT NOT NULL,
      item_name TEXT NOT NULL,
      item_type TEXT NOT NULL,
      amount REAL NOT NULL,
      remark TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (record_id) REFERENCES salary_records(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS salary_templates (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL UNIQUE,
      config TEXT NOT NULL DEFAULT '{}',
      created_at TEXT,
      updated_at TEXT,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    );
  `)

  // 插入种子数据
  seedData(db)

  return db
}

/**
 * 获取数据库实例（如果尚未初始化则自动初始化）
 * @returns {Database}
 */
function getDb() {
  if (!db) initDb()
  return db
}

/**
 * 插入种子数据：校区、部门、管理员和示例员工
 */
function seedData(database) {
  // 检查是否已初始化
  const count = database.prepare('SELECT COUNT(*) as count FROM campuses').get()
  if (count.count > 0) return

  const now = new Date().toISOString()

  // 校区
  const insertCampus = database.prepare(
    'INSERT INTO campuses (id, name, code, created_at) VALUES (?, ?, ?, ?)'
  )
  insertCampus.run('campus-1', '黄岛', 'huangdao', now)
  insertCampus.run('campus-2', '市南', 'shinan', now)

  // 部门
  const insertDept = database.prepare(
    'INSERT INTO departments (id, name, code, created_at) VALUES (?, ?, ?, ?)'
  )
  insertDept.run('dept-1', '校长', 'principal', now)
  insertDept.run('dept-2', '老师', 'teacher', now)
  insertDept.run('dept-3', '销售', 'sales', now)
  insertDept.run('dept-4', '班主任', 'headteacher', now)
  insertDept.run('dept-5', '市场部', 'market', now)

  // 管理员和示例员工
  const insertEmployee = database.prepare(`
    INSERT INTO employees (id, username, password, name, phone, email, campus_id, department_id, hire_date, base_salary, status, is_admin, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  // 管理员
  insertEmployee.run(
    crypto.randomUUID(), 'admin', bcrypt.hashSync('admin123', 10),
    '管理员', null, null, 'campus-1', 'dept-1', now, 0, 'active', 1, now
  )

  // 示例员工 tom（老师）
  insertEmployee.run(
    crypto.randomUUID(), 'tom', bcrypt.hashSync('123456', 10),
    '汤姆', null, null, 'campus-1', 'dept-2', now, 5000, 'active', 0, now
  )

  // 示例员工 jerry（销售）
  insertEmployee.run(
    crypto.randomUUID(), 'jerry', bcrypt.hashSync('123456', 10),
    '杰瑞', null, null, 'campus-2', 'dept-3', now, 4000, 'active', 0, now
  )

  // ---- 销售/校长员工 + 阶梯提成模板 ----

  // 插入4位销售员工
  const salesData = [
    { username: 'wangxiaojuan', name: '王晓娟' },
    { username: 'zhaohongxing', name: '赵红星' },
    { username: 'huahua', name: '花花老师' },
    { username: 'fengluxin', name: '冯璐新' },
  ]

  const salesIds = {}
  for (const emp of salesData) {
    const id = crypto.randomUUID()
    salesIds[emp.username] = id
    insertEmployee.run(
      id, emp.username, bcrypt.hashSync('123456', 10),
      emp.name, null, null, 'campus-1', 'dept-3', now, 0, 'active', 0, now
    )
  }

  // 插入阶梯模板
  const insertTemplate = database.prepare(
    'INSERT INTO salary_templates (id, employee_id, config, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
  )

  // 王晓娟 — 6档 0-300000，无社保公积金
  insertTemplate.run(crypto.randomUUID(), salesIds.wangxiaojuan, JSON.stringify({
    version: 1,
    template_type: 'tiered',
    base_salary_ratio: 60,
    performance_salary_ratio: 40,
    tiers: [
      { min: 0, max: 50000, salary: 6000, commission_rate: 3 },
      { min: 50000, max: 100000, salary: 6000, commission_rate: 4 },
      { min: 100000, max: 150000, salary: 6500, commission_rate: 6 },
      { min: 150000, max: 200000, salary: 7000, commission_rate: 7 },
      { min: 200000, max: 250000, salary: 8000, commission_rate: 8 },
      { min: 250000, max: 300000, salary: 8000, commission_rate: 9 }
    ],
    deductions: {
      social_insurance: { enabled: false, amount: 0 },
      housing_fund: { enabled: false, amount: 0 },
      tax: { enabled: false }
    },
    extras: { bonus: { enabled: true }, tutoring: { enabled: true }, notes: { enabled: true } }
  }), now, now)

  // 赵红星 — 8档 0-400000，社保463.91+公积金175
  insertTemplate.run(crypto.randomUUID(), salesIds.zhaohongxing, JSON.stringify({
    version: 1,
    template_type: 'tiered',
    base_salary_ratio: 60,
    performance_salary_ratio: 40,
    tiers: [
      { min: 0, max: 50000, salary: 10000, commission_rate: 4 },
      { min: 50000, max: 100000, salary: 10000, commission_rate: 5 },
      { min: 100000, max: 150000, salary: 10500, commission_rate: 6 },
      { min: 150000, max: 200000, salary: 11000, commission_rate: 7 },
      { min: 200000, max: 250000, salary: 11500, commission_rate: 8 },
      { min: 250000, max: 300000, salary: 12000, commission_rate: 9 },
      { min: 300000, max: 350000, salary: 12500, commission_rate: 10 },
      { min: 350000, max: 400000, salary: 13000, commission_rate: 11 }
    ],
    deductions: {
      social_insurance: { enabled: true, amount: 463.91 },
      housing_fund: { enabled: true, amount: 175 },
      tax: { enabled: false }
    },
    extras: { bonus: { enabled: true }, tutoring: { enabled: true }, notes: { enabled: true } }
  }), now, now)

  // 花花老师 — 4档 0-200000，无社保公积金
  insertTemplate.run(crypto.randomUUID(), salesIds.huahua, JSON.stringify({
    version: 1,
    template_type: 'tiered',
    base_salary_ratio: 60,
    performance_salary_ratio: 40,
    tiers: [
      { min: 0, max: 50000, salary: 6000, commission_rate: 2 },
      { min: 50000, max: 100000, salary: 6000, commission_rate: 4 },
      { min: 100000, max: 150000, salary: 6500, commission_rate: 6 },
      { min: 150000, max: 200000, salary: 7000, commission_rate: 7 }
    ],
    deductions: {
      social_insurance: { enabled: false, amount: 0 },
      housing_fund: { enabled: false, amount: 0 },
      tax: { enabled: false }
    },
    extras: { bonus: { enabled: true }, tutoring: { enabled: true }, notes: { enabled: true } }
  }), now, now)

  // 冯璐新 — 5档 0-250000，社保463.91+公积金175
  insertTemplate.run(crypto.randomUUID(), salesIds.fengluxin, JSON.stringify({
    version: 1,
    template_type: 'tiered',
    base_salary_ratio: 60,
    performance_salary_ratio: 40,
    tiers: [
      { min: 0, max: 50000, salary: 6000, commission_rate: 2 },
      { min: 50000, max: 100000, salary: 6000, commission_rate: 4 },
      { min: 100000, max: 150000, salary: 6500, commission_rate: 6 },
      { min: 150000, max: 200000, salary: 7000, commission_rate: 7 },
      { min: 200000, max: 250000, salary: 8000, commission_rate: 8 }
    ],
    deductions: {
      social_insurance: { enabled: true, amount: 463.91 },
      housing_fund: { enabled: true, amount: 175 },
      tax: { enabled: false }
    },
    extras: { bonus: { enabled: true }, tutoring: { enabled: true }, notes: { enabled: true } }
  }), now, now)

  console.log('✓ 种子数据已插入')
}

module.exports = { initDb, getDb }
