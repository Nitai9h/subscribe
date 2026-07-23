# Subscribe - 订阅管理系统

一个基于 Cloudflare Workers 的轻量级订阅管理应用，支持邮件提醒、到期追踪、分类管理。

## 功能特性

- **仪表盘**：总订阅数 / 即将到期数概览卡片、按剩余天数排序的订阅列表、日历视图（大屏）
- **订阅管理**：搜索、分类筛选、添加 / 编辑 / 删除订阅
- **邮件提醒**：到期提醒、续费提醒，每日自动检查并发送
- **认证**：Cloudflare Access Email OTP 验证
- **深色模式**：支持浅色 / 深色主题切换
- **响应式**：适配桌面端与移动端

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Hono (Cloudflare Workers) |
| 数据库 | Cloudflare D1 (SQLite) |
| 认证 | Cloudflare Access (Email OTP) |
| 邮件 | MailChannels API |
| 前端 | Vanilla JS SPA (hash 路由) |
| 定时任务 | Worker Cron Triggers |
| 部署 | Wrangler CLI |

## 项目结构

```
subscribe/
├── .gitignore
├── package.json
├── tsconfig.json
├── wrangler.jsonc              # Worker 配置
├── README.md
├── migrations/
│   └── 0001_init.sql           # D1 建表迁移
├── src/
│   ├── index.ts                # Worker 入口 (Hono 路由 + Cron)
│   ├── db.ts                   # D1 数据库操作
│   ├── email.ts                # 邮件发送
│   └── types.ts                # 类型定义
└── public/
    ├── index.html              # SPA 入口
    ├── style.css               # 样式 (iOS 风格 + 深色模式)
    └── app.js                  # 前端逻辑 (路由 / API / 页面)
```

## 部署教程

### 前置条件

- 已注册 [Cloudflare](https://cloudflare.com) 账号
- 域名已托管在 Cloudflare DNS（需开启代理，橙色云朵）
- 本地已安装 [Node.js](https://nodejs.org) ≥ 18
- 本地已安装 [pnpm](https://pnpm.io)

### 1. 克隆项目

```bash
git clone <你的仓库地址>
cd subscribe
pnpm install
```

### 2. 登录 Wrangler

```bash
npx wrangler login
```

### 3. 创建 D1 数据库

```bash
npx wrangler d1 create subscribe-db
```

执行后会输出类似以下内容：

```
✅ Created database 'subscribe-db' with database_id: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
```

将输出的 `database_id` 复制到 `wrangler.jsonc` 中，替换 `"your-database-id"`：

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "subscribe-db",
    "database_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"  // 替换这里
  }
]
```

### 4. 执行数据库迁移

```bash
npx wrangler d1 execute subscribe-db --remote --file=./migrations/0001_init.sql
```

### 5. 配置 MailChannels 域名验证（邮件发送）

邮件通过 MailChannels API 发送，需要添加域名 SPF 记录以通过验证。

在 Cloudflare DNS 中添加一条 TXT 记录：

| 类型 | 名称 | 内容 |
|------|------|------|
| TXT | `_mailchannels` | `v=mc1 cfid=<你的域名>` |

> 将 `<你的域名>` 替换为你的实际域名，例如 `v=mc1 cfid=subscribe.nitai.cc`

### 6. 配置 Cloudflare Access（Email 验证）

在 Cloudflare Zero Trust 面板中设置：

1. 打开 [Cloudflare Zero Trust](https://one.dash.cloudflare.com/)
2. 进入 **Access > Applications**
3. 点击 **Add an application**，选择 **Self-hosted**
4. 配置应用：
   - **Application name**：`Subscribe`
   - **Application domain**：你的 Worker 域名（例如 `subscribe.yourdomain.com`）
   - **Identity providers**：勾选 **One-time PIN**（Email OTP）
5. 点击 **Next**，创建策略：
   - **Policy name**：`Allow Email`
   - **Action**：`Allow`
   - **Configure rules**：添加 `Emails` 规则，填入允许访问的邮箱地址
6. 点击 **Next**，确认并保存

### 7. 部署 Worker

```bash
npx wrangler deploy
```

部署成功后，访问 Worker 域名即可看到 Cloudflare Access 的邮箱验证页面。

### 8. 本地开发（可选）

```bash
# 先执行本地数据库迁移
npx wrangler d1 execute subscribe-db --local --file=./migrations/0001_init.sql

# 启动开发服务器
npx wrangler dev
```

> **Windows 用户注意**：如果遇到 `EPERM: operation not permitted` 错误，请先手动设置 `XDG_CONFIG_HOME` 环境变量：
> ```powershell
> $env:XDG_CONFIG_HOME = "$pwd\.config"
> New-Item -ItemType Directory -Force -Path "$env:XDG_CONFIG_HOME\.wrangler\registry" | Out-Null
> npx wrangler dev
> ```

本地开发时，Cloudflare Access 不会介入。可以在浏览器 DevTools 中手动设置请求头来模拟用户：

```
X-Dev-User-Email: your@email.com
```

## 数据库表结构

### subscriptions（订阅表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| user_email | TEXT | 用户邮箱 |
| name | TEXT | 订阅名称 |
| price | REAL | 价格 |
| category | TEXT | 分类 |
| expiry_date | TEXT | 到期日期 (ISO) |
| renewable_date | TEXT | 可续费日期 (ISO) |
| email_reminder_expiry | INTEGER | 到期提醒开关 (0/1) |
| email_reminder_renewal | INTEGER | 续费提醒开关 (0/1) |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 更新时间 |

### user_settings（用户设置表）

| 字段 | 类型 | 说明 |
|------|------|------|
| user_email | TEXT | 用户邮箱（主键） |
| notification_email | TEXT | 通知接收邮箱 |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 更新时间 |

### email_logs（邮件记录表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| subscription_id | INTEGER | 关联订阅 ID |
| user_email | TEXT | 用户邮箱 |
| type | TEXT | 类型 (expiry / renewal) |
| sent_at | TEXT | 发送时间 |

## 邮件提醒逻辑

- Cron 表达式：`0 0 * * *`（每天 UTC 午夜触发）
- 到期提醒：检查开启提醒 + 到期日在 7 天内的订阅
- 续费提醒：检查开启提醒 + 可续费日在 7 天内的订阅
- 不跳过重复提醒：即今天符合条件就发送，不管昨天是否已发过

## 环境变量

本项目不需要额外的环境变量。所有配置通过 `wrangler.jsonc` 管理。

## 许可证

MIT