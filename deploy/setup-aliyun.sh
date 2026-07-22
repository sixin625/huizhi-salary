#!/usr/bin/env bash
# 阿里云 Ubuntu 22.04 一键初始化部署
# 用法: bash setup-aliyun.sh <git仓库地址> <子域名>
# 例:  bash setup-aliyun.sh https://github.com/you/salary-web.git salary.example.com
set -euo pipefail

REPO_URL="${1:?用法: bash setup-aliyun.sh <git仓库地址> <子域名>}"
DOMAIN="${2:?请提供子域名, 例如 salary.example.com}"
APP_DIR=/var/www/salary

# 1. 系统依赖（better-sqlite3 需要 gcc/g++/make 编译）
sudo apt-get update
sudo apt-get install -y build-essential python3 nginx git curl

# 2. Node.js 22（NodeSource）—— 与本地 engines 一致，避免 better-sqlite3 ABI 不匹配
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pnpm pm2

# 3. 拉取代码
sudo mkdir -p "$APP_DIR"
sudo chown -R "$USER":"$USER" "$APP_DIR"
git clone "$REPO_URL" "$APP_DIR"
cd "$APP_DIR"

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
