# 库存管理系统需求规格文档

## 1. 项目概述

### 1.1 项目背景
- **项目名称**: StoreSystem - 库存管理系统
- **项目类型**: Web应用 + 微信小程序
- **部署平台**: Vercel (内网外网均可访问)
- **数据库**: Vercel Postgres
- **预置管理员账号**: 用户名 `admin`，密码 `admin123`

### 1.2 核心功能需求
1. 用户系统：管理员/普通用户注册、登录
2. 库存管理：入库、出库、查询、删除
3. 移动端支持：微信小程序端实现入库、出库、查询

---

## 2. 用户角色

| 角色 | 权限 |
|------|------|
| 管理员 (admin) | 全部权限：canCreate、canEdit、canDelete、canIn、canOut（由系统固定设置） |
| 普通用户 (user) | 权限由管理员设置（canCreate=创建商品、canEdit=编辑商品、canDelete=删除商品、canIn=入库、canOut=出库） |

---

## 3. 功能模块

### 3.1 用户认证模块

#### 注册功能
- 普通用户可通过手机号或用户名注册（二选一）
- 填写信息：手机号/用户名、密码、确认密码、昵称
- 用户名和手机号需要唯一性校验
- 注册后状态为"待审核"，需管理员审核通过后才可登录
- 审核通过后由管理员设置权限
- 审核拒绝后用户记录被删除，用户可以重新注册

#### 登录功能
- 用户名或手机号 + 密码登录
- 支持"记住我"功能（延长Session时间）
- Session有效期1天
- 登录失败根据状态返回相应信息（用户不存在、密码错误、待审核、已禁用）
- 注册成功后显示"注册成功，请等待管理员审核"
- 登录成功后返回用户信息（包含角色、权限状态）
- 修改密码后需要重新登录
- 微信小程序支持微信扫码登录（需先在Web端绑定微信openid）

#### 用户管理（管理员）
- 管理员可以手动创建用户账号（用户名/手机号二选一必填，密码必填，其他可选）
- 管理员可以审核新注册用户（通过时设置权限，拒绝时删除用户记录）
- 管理员可以设置用户的访问操作权限（入库、出库、查询、修改等）
- 管理员可以启用/禁用用户账号
- 管理员可以删除用户账号（硬删除）

#### 用户信息管理
- 用户可以查看自己的基本信息（用户名、手机号、昵称、权限状态）
- 用户可以修改昵称和密码（修改密码不需要校验旧密码）
- 用户可以查看自己的操作记录
- 用户登录后可在个人中心绑定微信账号
- 绑定微信账号时必须绑定手机号
- 一个微信号只能绑定一个用户
- 绑定后可在微信小程序通过扫码登录
- 绑定后不可解绑

#### 微信扫码登录
- 微信扫码登录时，未绑定则提示"请用用户名登录并到后台绑定微信号"

### 3.2 库存管理模块

### 库存管理需要用户登录后才能有权限操作
#### 新建分类

#### 新建商品

#### 数据导入/导出
- 支持Excel导入商品（SKU、商品名称、分类、单位、数量、位置）
- 支持导出库存报表（Excel格式）

#### 入库功能
- 选择商品，输入入库数量
- 选择商品，输入入库数量
- 填写备注（可选）
- 记录操作日志

#### 出库功能
- 选择商品，输入出库数量
- 出库数量不能超过当前库存
- 填写备注（可选）
- 记录操作日志

#### 库存查询
- 列表展示所有商品
- 支持按SKU、商品名称搜索
- 支持按分类筛选
- 显示：SKU、名称、分类、库存量、单位、位置

#### 删除功能
- 有 canDelete 权限的用户可删除商品
- 执行软删除（标记为已删除）

#### 操作日志
- 用户可以查看自己的操作记录

### 3.3 微信小程序端

| 功能 | 说明 |
|------|------|
| 登录 | 微信扫码登录 |
| 库存列表 | 查看商品列表，支持搜索 |
| 入库 | 选择商品，输入数量入库 |
| 出库 | 选择商品，输入数量出库 |

---

## 4. 页面结构

### 4.1 Web端页面

```
/login          - 登录/注册页（Tab切换）
/dashboard      - 仪表盘（库存总数量、按库存数降序排列的商品列表）
/users          - 用户管理页（审核、权限设置）
/stock          - 库存列表页
/stock/new      - 新增商品页
/stock/[id]     - 商品详情/编辑页
/stock/logs     - 操作日志页
/stock/import   - 导入商品页
/stock/export   - 导出报表页
/profile        - 个人中心（包含绑定微信入口）
```

### 4.2 微信小程序页面

```
pages/auth/login     - 微信扫码登录页
pages/index/index     - 首页（快捷入口）
pages/stock/list      - 库存列表
pages/stock/detail    - 商品详情
pages/stock/in        - 入库页面
pages/stock/out       - 出库页面
pages/profile/profile - 个人中心
```

---

## 5. 数据库设计

### 5.1 用户表 (users)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | SERIAL | 主键 |
| username | VARCHAR(50) | 用户名（唯一，可与phone二选一） |
| phone | VARCHAR(20) | 手机号（唯一，可选） |
| password_hash | VARCHAR(255) | 密码哈希 |
| name | VARCHAR(100) | 昵称 |
| role | VARCHAR(20) | 角色：admin/user |
| status | VARCHAR(20) | 状态：pending/approved/disabled |
| permissions | JSONB | 权限配置：{canCreate, canEdit, canDelete, canIn, canOut}，管理员默认全为true，新用户默认为NULL |
| wechat_openid | VARCHAR(100) | 微信openid（可选） |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

### 5.2 库存商品表 (stock_items)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | SERIAL | 主键 |
| sku | VARCHAR(50) | SKU编码（唯一） |
| name | VARCHAR(200) | 商品名称 |
| category | VARCHAR(100) | 分类 |
| quantity | INTEGER | 当前库存 |
| unit | VARCHAR(20) | 单位（个/箱/件等） |
| location | VARCHAR(100) | 存放位置 |
| description | TEXT | 描述 |
| is_deleted | BOOLEAN | 是否删除（软删除） |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

### 5.3 操作日志表 (stock_logs)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | SERIAL | 主键 |
| item_id | INTEGER | 商品ID |
| operation_type | VARCHAR(20) | 操作类型：in/out/create/update/delete |
| quantity_change | INTEGER | 库存变化量 |
| quantity_before | INTEGER | 操作前库存 |
| quantity_after | INTEGER | 操作后库存 |
| operator_id | INTEGER | 操作人ID |
| operator_name | VARCHAR(100) | 操作人姓名 |
| remark | TEXT | 备注 |
| created_at | TIMESTAMP | 操作时间 |

---

## 6. API接口设计

### 6.1 认证接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/auth/register | 用户注册（手机号/用户名+密码） |
| POST | /api/auth/login | 用户登录（手机号/用户名+密码） |
| POST | /api/auth/wechat-login | 微信扫码登录 |
| GET | /api/auth/session | 获取当前会话 |

### 6.2 用户管理接口（管理员）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/users | 获取用户列表（支持状态筛选） |
| GET | /api/users/pending | 获取待审核用户列表 |
| POST | /api/users | 手动创建用户 |
| POST | /api/users/[id]/approve | 审核通过用户（必须设置权限） |
| POST | /api/users/[id]/reject | 拒绝用户（删除用户记录） |
| POST | /api/users/[id]/disable | 禁用/启用用户 |
| PUT | /api/users/[id]/permissions | 设置用户权限 |
| PUT | /api/users/[id] | 更新用户信息 |
| DELETE | /api/users/[id] | 删除用户（硬删除） |

### 6.3 用户个人信息接口

| 方法 | 路径 | 说明 |
|------|------|------|
| PUT | /api/user/profile | 修改个人信息（昵称、密码） |
| GET | /api/user/logs | 获取当前用户的操作日志 |
| POST | /api/user/bind-wechat | 绑定微信账号（需绑定手机号） |

### 6.4 库存接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/stock | 获取库存列表（支持search、category筛选） |
| POST | /api/stock | 创建商品（需canCreate权限） |
| GET | /api/stock/[id] | 获取商品详情 |
| PUT | /api/stock/[id] | 更新商品（需canEdit权限） |
| DELETE | /api/stock/[id] | 删除商品（需canDelete权限） |
| POST | /api/stock/[id]/in | 入库（需canIn权限） |
| POST | /api/stock/[id]/out | 出库（需canOut权限） |
| GET | /api/stock/logs | 获取操作日志 |
| POST | /api/stock/import | 导入商品（Excel） |
| GET | /api/stock/export | 导出库存报表 |

---

## 7. 技术选型

| 层级 | 技术 |
|------|------|
| 前端框架 | Next.js 14 (App Router) |
| UI组件 | Tailwind CSS + shadcn/ui |
| 数据库 | Vercel Postgres |
| 认证 | NextAuth.js |
| 密码加密 | bcrypt |
| 状态管理 | React Context + SWR |
| 微信小程序 | Taro |
| 微信绑定/登录 | 微信OAuth2.0（snsapi_userinfo） |
| 部署 | Vercel |

---

## 8. 验收标准

- [ ] 管理员（用户名 admin，密码 admin123）可以登录后台
- [ ] 普通用户可以通过手机号或用户名注册，注册后需审核
- [ ] 管理员可以审核新注册用户（通过/拒绝）
- [ ] 管理员可以设置用户的访问操作权限
- [ ] 管理员可以禁用/启用用户账号
- [ ] 入库/出库根据用户权限控制
- [ ] 库存列表支持搜索和筛选
- [ ] 操作日志完整记录所有操作
- [ ] 支持Excel导入商品和导出库存报表
- [ ] Dashboard显示库存总数量，商品按库存数降序排列
- [ ] Web端响应式布局正常显示
- [ ] Vercel部署成功，外网可访问
- [ ] 微信小程序支持微信扫码登录，可以对接API操作库存
