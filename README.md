# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

---

## 部署（阿里云 ECS · Ubuntu 22.04 · 子域名 + PM2）

本项目为**前后端单服务架构**：生产环境下 Node 后端（`server/src/app.js`）直接托管前端 `dist/` 并监听 `/api/health`，无需单独的前端托管平台。

### 准备工作
1. 在域名 DNS 处为子域名（如 `salary.你的域名.com`）添加 **A 记录指向 ECS 公网 IP**。
2. 阿里云**安全组**放开 `80`、`443` 端口（应用端口 3001 仅本地监听，无需对外开放）。
3. 把代码推到 GitHub。

### 一键初始化（首次）
SSH 进服务器后执行：
```bash
bash <(curl -fsSL https://raw.githubusercontent.com/你的仓库/deploy/setup-aliyun.sh) \
  https://github.com/你的仓库/salary-web.git salary.你的域名.com
```
脚本会自动：装 Node 22 + 编译工具 → 克隆代码 → `pnpm install && pnpm build` → PM2 开机自启 → 配置 nginx 反代 → 申请 HTTPS 证书。

> 也可手动：先 `git clone` 到 `/var/www/salary`，再 `bash deploy/setup-aliyun.sh <仓库> <域名>`（脚本会跳过克隆）。

### 后续更新
```bash
cd /var/www/salary && bash deploy/deploy.sh
```

### 关键文件
| 文件 | 作用 |
|------|------|
| `ecosystem.config.cjs` | PM2 进程配置（含 `JWT_SECRET` 等生产环境变量） |
| `deploy/nginx-salary.conf` | 子域名反代模板（certbot 自动加 HTTPS） |
| `deploy/setup-aliyun.sh` | 首装一键脚本 |
| `deploy/deploy.sh` | 更新部署脚本 |

### 上线后必做
- 修改 `ecosystem.config.cjs` 里的 `JWT_SECRET` 为随机长串（`openssl rand -hex 32`），改完 `pm2 reload huizhi-salary`。
- 默认管理员账号 `admin / admin123`，务必登录后改密码。
- 数据库为 SQLite 文件，落在 `server/data/salary.db`（ECS 磁盘持久，重启不丢）。如需备份：`cp server/data/salary.db backup-$(date +%F).db`。

### 本地开发
```bash
pnpm install        # 安装前端 + 触发 server 依赖
pnpm dev            # 前端 5173
pnpm dev:server     # 后端 3001（Node 24 本地运行）
# 或一键：pnpm dev:all
```

