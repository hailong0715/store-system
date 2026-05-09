# 认证模块测试用例

## 测试1: 管理员登录
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"login":"admin","password":"admin123"}'
```
预期: 登录成功，返回用户信息

## 测试2: 用户名不存在登录
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"login":"notexist","password":"123456"}'
```
预期: 返回 "User not found"

## 测试3: 密码错误
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"login":"admin","password":"wrongpassword"}'
```
预期: 返回 "Invalid password"

## 测试4: 用户注册 - 用户名方式
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"login":"testuser","password":"123456","name":"Test User"}'
```
预期: 注册成功，返回 "Registration successful, please wait for admin approval"

## 测试5: 用户注册 - 手机号方式
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"login":"13800138001","password":"123456","name":"手机用户"}'
```
预期: 注册成功，返回 "Registration successful, please wait for admin approval"

## 测试6: 用户名重复注册
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"login":"testuser","password":"123456","name":"Test User2"}'
```
预期: 返回 "Username already exists"

## 测试7: 待审核用户登录
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"login":"testuser","password":"123456"}'
```
预期: 返回 "Account is pending approval"

## 测试8: 获取当前会话
```bash
curl http://localhost:3000/api/auth/session
```
预期: 返回当前用户信息（需要先登录）

## 测试9: 微信扫码登录 - 未绑定
```bash
curl -X POST http://localhost:3000/api/auth/wechat-login \
  -H "Content-Type: application/json" \
  -d '{"code":"test_wechat_code_123"}'
```
预期: 返回 "Please login with username and bind WeChat in profile"
