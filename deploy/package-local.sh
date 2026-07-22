#!/usr/bin/env bash
# 本地打包脚本（无需 GitHub）
# 在你的电脑（Windows 用 Git Bash / macOS / Linux 终端）运行：
#   bash deploy/package-local.sh
# 会基于 git 仓库生成一个干净的压缩包 salary-deploy.tar.gz
# 自动排除 node_modules / dist / .workbuddy / .pnpm-store / .env / 截图等
set -euo pipefail

cd "$(dirname "$0")/.."

OUT="salary-deploy.tar.gz"
git archive --format=tar.gz -o "$OUT" HEAD

echo ">> 已生成 $OUT"
echo ">> 下一步："
echo "   1) scp $OUT root@你的ECS公网IP:/tmp/"
echo "   2) ssh root@你的ECS公网IP"
echo "   3) mkdir -p /var/www/salary && tar -xzf /tmp/$OUT -C /var/www/salary"
echo "   4) cd /var/www/salary && bash deploy/setup-aliyun.sh salary.你的域名.com"
