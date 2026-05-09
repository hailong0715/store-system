# Vercel 部署指南

## 项目概述

StoreSystem - 库存管理系统，基于 Next.js 14，已完成 SQLite → Vercel Postgres 数据库迁移。

---

## 部署步骤（Git 自动部署）

### 步骤 1：初始化 Git 仓库（如果尚未初始化）

```bash
# 初始化 Git 仓库
git init

# 添加所有文件
git add .

# 创建初始提交
git commit -m "Initial commit - 准备部署到 Vercel"
```

### 步骤 2：推送到 GitHub

1. 在 GitHub 创建新仓库：https://github.com/new
2. 复制仓库 URL
3. 执行以下命令：

```bash
# 添加远程仓库（替换为你的仓库 URL）
git remote add origin https://github.com/你的用户名/store-system.git

# 推送代码到 GitHub
git branch -M main
git push -u origin main
```

### 步骤 3：在 Vercel 创建项目

1. 登录 [Vercel Dashboard](https://vercel.com/dashboard)
2. 点击 **Add New** → **Project**
3. 在 **Import Git Repository** 中找到你的仓库
4. 点击 **Import**

### 步骤 4：配置环境变量

在 Vercel 项目配置页面，找到 **Environment Variables** 部分，添加以下变量：

| 变量名 | 值 |
|--------|-----|
| `POSTGRES_URL` | （创建数据库后获取，见下方） |
| `NEXTAUTH_URL` | `https://你的项目名.vercel.app` |
| `NEXTAUTH_SECRET` | 运行 `openssl rand -base64 32` 生成 |

### 步骤 5：创建 Vercel Postgres 数据库

1. 在 Vercel 项目页面，点击 **Storage** → **Create Database** → **Postgres**
2. 选择区域（建议选择亚洲或离你最近的）
3. 设置数据库名称，例如：`store-system-db`
4. 创建完成后，复制 **Connection String**（或 URL）
5. 将连接字符串填入 Vercel 项目的 `POSTGRES_URL` 环境变量

**或者**分别填写以下变量：
- `POSTGRES_URL`: `postgres://default:密码@主机.区域.vercel-storage.com/数据库名`
- `POSTGRES_USER`: `default`
- `POSTGRES_HOST`: `xxxxx.us-east-1.postgres.vercel-storage.com`
- `POSTGRES_PASSWORD`: 你的密码
- `POSTGRES_DATABASE`: `verceldb`

### 步骤 6：部署

1. 在 Vercel 配置页面底部，点击 **Deploy**
2. 等待构建完成（约 2-3 分钟）

### 步骤 7：验证部署

1. 部署完成后，点击生成的 URL 访问
2. 使用默认管理员账号登录：
   - 用户名: `admin`
   - 密码: `admin123`

---

## 部署检查清单

- [ ] 代码已推送到 GitHub
- [ ] Vercel 项目已创建
- [ ] Postgres 数据库已创建
- [ ] 环境变量已配置（POSTGRES_URL, NEXTAUTH_URL, NEXTAUTH_SECRET）
- [ ] 部署成功
- [ ] 管理员登录正常

---

## 常见问题

### Q: 部署失败怎么办？
A: 查看 Vercel 部署日志，通常是环境变量配置错误或代码问题

### Q: 如何更新已部署的应用？
A: 只需推送代码到 GitHub，Vercel 会自动重新部署

### Q: 本地开发怎么连接数据库？
A: 在 `.env.local` 中添加 `POSTGRES_URL`，使用 Vercel 提供的连接字符串

---

## 关键文件

| 文件 | 说明 |
|------|------|
| `src/lib/db.ts` | 数据库连接（已修改为 Postgres） |
| `.env.local.example` | 环境变量示例 |
| `package.json` | 项目依赖 |
