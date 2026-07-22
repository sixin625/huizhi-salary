#!/usr/bin/env bash
# 后续更新部署脚本
# 用法:
#   cd /var/www/salary && bash deploy/deploy.sh
# 说明:
#   - 若是 git 仓库会自动 git pull；否则跳过（请手动把最新文件上传覆盖）
#   - 重新安装依赖（postinstall 会重新编译 better-sqlite3）、构建、平滑重启 PM2
set -euo pipefail

APP_DIR=/var/www/salary
cd "$APP_DIR"

if [ -d .git ]; then
  echo ">> 拉取最新代码 (git)"
  git pull
else
  echo ">> 未检测到 git 仓库，跳过 pull（请确保已手动上传最新文件到本目录）"
fi

echo ">> 安装依赖（postinstall 会重新编译 better-sqlite3）"
pnpm install

echo ">> 构建前端"
pnpm build

echo ">> 平滑重启 PM2"
pm2 reload huizhi-salary

echo ">> 完成"
