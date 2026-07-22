#!/usr/bin/env bash
# 后续更新部署脚本（代码已 clone 到 /var/www/salary 后使用）
# 用法: cd /var/www/salary && bash deploy/deploy.sh
set -euo pipefail

APP_DIR=/var/www/salary
cd "$APP_DIR"

echo ">> 拉取最新代码"
git pull

echo ">> 安装依赖（postinstall 会重新编译 better-sqlite3）"
pnpm install

echo ">> 构建前端"
pnpm build

echo ">> 平滑重启 PM2"
pm2 reload huizhi-salary

echo ">> 完成"
