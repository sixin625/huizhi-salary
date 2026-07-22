#!/usr/bin/env bash
# 阿里云 Ubuntu 22.04 一键部署
#
# 两种用法：
#   1) 本地上传模式（无需 GitHub）：
#      bash setup-aliyun.sh <子域名>
#      —— 代码已经上传到当前目录（例如 /var/www/salary），直接部署
#
#   2) Git 模式（可选）：
#      bash setup-aliyun.sh <git仓库地址> <子域名>
#      —— 脚本会 git clone 到 /var/www/salary 再部署
set -euo pipefail

LOCAL_MODE=0
if [[ "${1:-}" == http* || "${1:-}" == *.git ]]; then
  REPO_URL="$1"
  DOMAIN="${2:?请提供子域名, 例如 salary.example.com}"
else
  DOMAIN="${1:?请提供子域名, 例如 salary.example.com}"
  LOCAL_MODE=1
fi

if [ "$LOCAL_MODE" -eq 1 ]; then
  APP_DIR="$(pwd)"
  echo ">> 本地上传模式，使用当前目录: $APP_DIR"
else
  APP_DIR=/var/www/salary
fi

# 1. 系统依赖（better-sqlite3 需要 gcc/g++/make 编译）
sudo apt-get update
sudo apt-get install -y build-essential python3 nginx git curl

# 2. Node.js 22（NodeSource）—— 与本地 engines 一致，避免 better-sqlite3 ABI 不匹配
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pnpm pm2

# 3. 拉取代码（仅 Git 模式）
if [ "$LOCAL_MODE" -eq 0 ]; then
  sudo mkdir -p "$APP_DIR"
  sudo chown -R "$USER":"$USER" "$APP_DIR"
  git clone "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR"

# 3.5 确保 server/.env 存在（含随机 JWT_SECRET，上线安全）
if [ ! -f server/.env ]; then
  if [ -f server/.env.example ]; then
    cp server/.env.example server/.env
    sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$(openssl rand -hex 32)|" server/.env
    echo ">> 已生成 server/.env（随机 JWT_SECRET，请妥善保管）"
  else
    echo ">> 警告: 未找到 server/.env.example，请手动创建 server/.env"
  fi
fi

# 4. 安装 + 构建（postinstall 会自动编译 better-sqlite3 原生模块）
pnpm install
pnpm build

# 5. PM2 启动并设为开机自启
pm2 start ecosystem.config.cjs --env production
pm2 save
sudo env PATH="$PATH:/usr/bin" pm2 startup systemd -u "$USER" --hp "$HOME"

# 6. nginx 反代
sudo cp deploy/nginx-salary.conf /etc/nginx/sites-available/salary
sudo sed -i "s/salary.YOURDOMAIN.com/$DOMAIN/" /etc/nginx/sites-available/salary
sudo ln -sf /etc/nginx/sites-available/salary /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# 7. 申请 HTTPS 证书（需先把子域名 DNS A 记录指向本机公网 IP）
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d "$DOMAIN"

echo ""
echo "🎉 部署完成！访问 https://$DOMAIN"
