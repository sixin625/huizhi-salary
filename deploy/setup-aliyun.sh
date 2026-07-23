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

# 0. 预检：若有“半残”的包（典型如 mysql-server）会卡住 apt，先给提示
if sudo dpkg -l 2>/dev/null | grep -E '^.[iUFH].*mysql-server' | grep -q mysql-server; then
  echo ">> 注意: 检测到未配置完成的 mysql-server 包，apt 可能被卡住。"
  echo "   请先修复（配置而非卸载）: sudo systemctl stop mysql 2>/dev/null; sudo pkill -9 mysqld 2>/dev/null; sleep 3; sudo dpkg --configure -a"
fi

# 1. 系统依赖（better-sqlite3 需要 gcc/g++/make 编译）
sudo apt-get update
sudo apt-get install -y build-essential python3 nginx git curl

# 2. Node.js 22（NodeSource）—— 与本地 engines 一致，避免 better-sqlite3 ABI 不匹配
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pnpm pm2

# 3. 拉取代码（仅 Git 模式）—— 失败自动重试，规避 ECS 偶发 TLS 中断
if [ "$LOCAL_MODE" -eq 0 ]; then
  sudo mkdir -p "$APP_DIR"
  sudo chown -R "$USER":"$USER" "$APP_DIR"
  OK=0
  for i in 1 2 3 4 5; do
    TMP_CLONE="$(mktemp -d)"
    if git clone --depth 1 "$REPO_URL" "$TMP_CLONE" 2>/dev/null; then
      sudo cp -a "$TMP_CLONE/." "$APP_DIR"/
      sudo chown -R "$USER":"$USER" "$APP_DIR"
      rm -rf "$TMP_CLONE"
      OK=1
      echo ">> 代码克隆成功"
      break
    fi
    echo ">> GitHub 克隆失败（第 $i 次），$((6-i)) 次机会，5 秒后重试..."
    rm -rf "$TMP_CLONE"
    sleep 5
  done
  if [ "$OK" -ne 1 ]; then
    echo ">> 错误：多次重试仍无法从 GitHub 克隆代码（多为 ECS 网络 TLS 中断）。"
    echo "   两种解决办法："
    echo "   A) 在 ECS 上直接再跑一次本脚本（网络恢复即可成功）"
    echo "   B) 改用本地上传：在你本机 bash deploy/package-local.sh 生成压缩包，scp 到服务器后解压运行"
    exit 1
  fi
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

# 5. PM2 启动并设为开机自启（幂等：已存在则重启，避免重跑时报“名字已存在”）
if pm2 describe huizhi-salary >/dev/null 2>&1; then
  pm2 restart huizhi-salary --env production
else
  pm2 start ecosystem.config.cjs --env production
fi
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
