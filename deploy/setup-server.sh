#!/usr/bin/env bash
# 通用 Linux 服务器一键部署（京东云 / 阿里云 / 腾讯云 等 Ubuntu、CentOS 通用）
#
# 用法：
#   本地上传模式（代码已在本目录）：
#     bash setup-server.sh <域名或公网IP>
#       - 传域名   → 自动用 certbot 签发 HTTPS 证书
#       - 传公网IP → 仅 HTTP 访问（不签证书，最简单，适合先用 IP 试跑）
#   Git 模式（从 GitHub 拉代码）：
#     bash setup-server.sh <git仓库地址> <域名或公网IP>
#
# 说明：
#   - 反向代理配置独立写入 /etc/nginx/conf.d/salary.conf，不会改动服务器上
#     其他站点（如既有 sky.conf），reload 平滑生效。
#   - 后端由 PM2 以 huizhi-salary 名义运行在 3001 端口。
set -euo pipefail

# ---------- 参数解析 ----------
ARG1="${1:-}"
if [[ "$ARG1" == http* || "$ARG1" == *.git ]]; then
  REPO_URL="$ARG1"
  ADDR="${2:?请提供域名或公网IP, 例如 salary.example.com 或 1.2.3.4}"
  LOCAL_MODE=0
else
  ADDR="${1:?请提供域名或公网IP, 例如 salary.example.com 或 1.2.3.4}"
  LOCAL_MODE=1
fi

# 判断是否是纯 IP（IP 模式 → 只走 HTTP，不签证书）
if [[ "$ADDR" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  HTTP_ONLY=1
  DOMAIN="$ADDR"
  echo ">> IP 模式：将以 http://$DOMAIN 提供访问（不签 HTTPS 证书）"
else
  HTTP_ONLY=0
  DOMAIN="$ADDR"
  echo ">> 域名模式：将签发 HTTPS 证书，以 https://$DOMAIN 提供访问"
fi

if [ "$LOCAL_MODE" -eq 1 ]; then
  APP_DIR="$(pwd)"
  echo ">> 本地上传模式，使用当前目录: $APP_DIR"
else
  APP_DIR=/var/www/salary
fi

# ---------- 系统家族检测（决定包管理器） ----------
OS_FAMILY="unknown"
if [ -f /etc/os-release ]; then
  # shellcheck disable=SC1091
  . /etc/os-release
  OS_FAMILY="${ID:-unknown}"
fi
case "$OS_FAMILY" in
  ubuntu|debian)
    PKG_UPDATE="sudo apt-get update"
    PKG_INSTALL="sudo apt-get install -y"
    NODE_SETUP="curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -"
    BASE_DEPS="build-essential python3 nginx git curl"
    CERTBOT_PKG="certbot"
    ;;
  centos|rhel|fedora|opencloudos|tencentos|anolis|kylin)
    PKG_UPDATE="sudo dnf makecache"
    PKG_INSTALL="sudo dnf install -y"
    NODE_SETUP="curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -"
    BASE_DEPS="gcc gcc-c++ make python3 nginx git curl"
    CERTBOT_PKG="certbot"
    ;;
  *)
    echo ">> 未识别系统($OS_FAMILY)，按 Ubuntu 处理（若失败请手动适配包名）"
    PKG_UPDATE="sudo apt-get update"
    PKG_INSTALL="sudo apt-get install -y"
    NODE_SETUP="curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -"
    BASE_DEPS="build-essential python3 nginx git curl"
    CERTBOT_PKG="certbot"
    ;;
esac

# Debian 系：预检半残包（典型 mysql-server）会卡住 apt
if [[ "$OS_FAMILY" == ubuntu || "$OS_FAMILY" == debian ]]; then
  if sudo dpkg -l 2>/dev/null | grep -E '^.[iUFH].*mysql-server' | grep -q mysql-server; then
    echo ">> 注意: 检测到未配置完成的 mysql-server 包，apt 可能被卡住。"
    echo "   请先修复（配置而非卸载）: sudo systemctl stop mysql 2>/dev/null; sudo pkill -9 mysqld 2>/dev/null; sleep 3; sudo dpkg --configure -a"
  fi
fi

# 1. 系统依赖（better-sqlite3 需要 gcc/g++/make 编译）
eval "$PKG_UPDATE"
eval "$PKG_INSTALL $BASE_DEPS"

# 2. Node.js 22（NodeSource）—— 与本地 engines 一致，避免 better-sqlite3 ABI 不匹配
eval "$NODE_SETUP"
eval "$PKG_INSTALL nodejs"
sudo npm install -g pnpm pm2

# 3. 拉取代码（仅 Git 模式）—— 失败自动重试，规避云主机偶发 TLS 中断
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
    echo ">> 错误：多次重试仍无法从 GitHub 克隆代码（多为网络 TLS 中断）。"
    echo "   改用本地上传：在本机 bash deploy/package-local.sh 生成压缩包，scp 到服务器后解压运行"
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

# 4. 安装 + 构建（better-sqlite3 原生模块需现场编译；新 pnpm 默认拦截构建脚本，故显式重建）
pnpm install || echo ">> 提示: pnpm install 返回非零，将继续尝试重建原生模块"
( cd server && pnpm rebuild better-sqlite3 ) || echo ">> 提示: better-sqlite3 重建被跳过（可能已编译）"
pnpm build

# 5. PM2 启动并设为开机自启（幂等：已存在则重启，避免重跑时报“名字已存在”）
if pm2 describe huizhi-salary >/dev/null 2>&1; then
  pm2 restart huizhi-salary --env production
else
  pm2 start ecosystem.config.cjs --env production
fi
pm2 save
sudo env PATH="$PATH:/usr/bin" pm2 startup systemd -u "$USER" --hp "$HOME"

# 6. 反向代理（系统 nginx，配置独立置于 conf.d，不影响其他站点）
sudo systemctl enable --now nginx 2>/dev/null || true
SALARY_CONF=/etc/nginx/conf.d/salary.conf

if [ "$HTTP_ONLY" -eq 1 ]; then
  # ---------- IP 模式：仅 HTTP 反代，不签证书 ----------
  sudo tee "$SALARY_CONF" >/dev/null <<EOF
# 喙语薪资系统 反向代理（由 setup-server.sh 自动生成，请勿手动修改）
# IP 模式：仅 HTTP 访问
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;

    # 工资条导入/导出可能上传文件，放大 body 上限
    client_max_body_size 10m;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF
  sudo nginx -t && ( sudo systemctl reload nginx 2>/dev/null || sudo systemctl restart nginx )
  echo ""
  echo "🎉 部署完成！访问 http://$DOMAIN"
else
  # ---------- 域名模式：先 80 供 ACME 验证，再签证书，再升级 443 ----------
  # 6a. 先写「仅 80」配置，供 Let's Encrypt 的 http-01 验证（ACME 路径走静态 root）
  sudo tee "$SALARY_CONF" >/dev/null <<EOF
# 喙语薪资系统 反向代理（由 setup-server.sh 自动生成，请勿手动修改）
# HTTP: ACME 验证 + 反向代理到后端 3001
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;

    # 工资条导入/导出可能上传文件，放大 body 上限
    client_max_body_size 10m;

    # Let's Encrypt 验证路径（证书签发/续期需要，必须走静态文件）
    location /.well-known/acme-challenge/ {
        root /usr/share/nginx/html;
    }

    # 其余请求反代到本地 Node 后端（3001）
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF
  sudo nginx -t && ( sudo systemctl reload nginx 2>/dev/null || sudo systemctl restart nginx )

  # 7. 申请 HTTPS 证书（webroot 模式：只签本域名，不改动其他站点配置）
  eval "$PKG_INSTALL $CERTBOT_PKG"
  if [ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    sudo certbot certonly --webroot -w /usr/share/nginx/html \
      -d "$DOMAIN" --non-interactive --agree-tos \
      -m admin@huiyuzg.cn \
      --deploy-hook "systemctl reload nginx"
  else
    echo ">> 证书已存在，跳过签发"
  fi

  # 7b. 证书就绪后，升级为「80 跳转 + 443」完整配置
  sudo tee "$SALARY_CONF" >/dev/null <<EOF
# 喙语薪资系统 反向代理（由 setup-server.sh 自动生成，请勿手动修改）
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;

    # 工资条导入/导出可能上传文件，放大 body 上限
    client_max_body_size 10m;

    location /.well-known/acme-challenge/ {
        root /usr/share/nginx/html;
    }

    # HTTP 全部 301 跳转到 HTTPS
    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name $DOMAIN;

    # 工资条导入/导出可能上传文件，放大 body 上限
    client_max_body_size 10m;

    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF
  sudo nginx -t && ( sudo systemctl reload nginx 2>/dev/null || sudo systemctl restart nginx )
  echo ""
  echo "🎉 部署完成！访问 https://$DOMAIN"
fi
