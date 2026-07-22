/**
 * PM2 进程守护配置 —— 阿里云 ECS 生产环境
 * 用法: pm2 start ecosystem.config.cjs --env production
 *
 * 生产模式下后端会同时托管前端 dist/ 并监听 /api/health。
 * 所有环境变量在此统一设置，无需在服务器上单独维护 .env 文件。
 */
module.exports = {
  apps: [
    {
      name: 'huizhi-salary',
      // cwd 指向 server 目录，与本地 `cd server && node src/app.js` 行为一致，
      // dotenv 自然加载 server/.env（本地开发用），线上用下方 env 覆盖。
      cwd: '/var/www/salary/server',
      script: 'src/app.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001,
        // ⚠️ 上线前务必改成一段随机长字符串（可用: openssl rand -hex 32）
        JWT_SECRET: 'CHANGE_ME_TO_A_LONG_RANDOM_STRING',
      },
    },
  ],
}
