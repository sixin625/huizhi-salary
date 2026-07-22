#!/usr/bin/env bash
# 一键启动：后端(3001, 必须用 Node 24) + 前端(5173)
# 用法（在项目根目录，用 Git Bash 运行）：  sh start-dev.sh
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
NODE24="/c/Program Files/nodejs/node.exe"

[ -x "$NODE24" ] || { echo "未找到 Node 24: $NODE24"; exit 1; }

start_backend() {
  if curl -s -m 2 -o /dev/null http://localhost:3001/api/auth/login -X POST -H "Content-Type: application/json" -d '{"username":"admin","password":"admin123"}'; then
    echo "后端已在运行，跳过。"
  else
    echo ">>> 启动后端 (Node 24) ..."
    ( "$NODE24" "$ROOT/server/src/app.js" > /tmp/salary-server.log 2>&1 & )
    sleep 3
  fi
}

start_frontend() {
  if curl -s -m 2 -o /dev/null http://localhost:5173/; then
    echo "前端已在运行，跳过。"
  else
    echo ">>> 启动前端 (Vite) ..."
    ( cd "$ROOT" && pnpm dev > /tmp/salary-vite.log 2>&1 & )
    sleep 4
  fi
}

start_backend
start_frontend

echo ">>> 最终状态"
curl -s -m 3 -o /dev/null -w "后端 3001: HTTP %{http_code}\n" http://localhost:3001/api/auth/login -X POST -H "Content-Type: application/json" -d '{"username":"admin","password":"admin123"}' || true
curl -s -m 3 -o /dev/null -w "前端 5173: HTTP %{http_code}\n" http://localhost:5173/ || true
echo "完成。前端预览: http://localhost:5173/"
