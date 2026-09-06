---
title: 设计 OAuth2.0 授权服务
order: 17
id: 686f77a4efaf42c1ba8d6f78411afc28
---

**初始模型：**

OAuth 2.0 授权服务的核心流程是：**客户端发起授权 → 跳转授权服务 → 用户登录并确认权限 → 返回 Authorization Code → 客户端后端拿 Code 换 Token → 用 Token 访问资源服务。**

- **Authorization Code**：不能直接把 Token 暴露在浏览器跳转里 → **先发一个短期、一次性的 Code，用完即失效**
- **Access Token**：客户端需要一个真正访问资源的凭证 → **短有效期，只用于调用资源服务**
- **Refresh Token**：Access Token 过期后不希望用户重新登录 → **用 Refresh Token 换新的 Access Token**
- **Scope**：Token 不能默认拥有所有权限 → **授权时明确能访问哪些资源、哪些操作**
- **Token 校验**：资源服务需要判断 Token 是否有效 → **JWT 可以本地验签；随机 Token 可以去 Redis / 授权中心查询**
- **Token 过期**：Token 不能永久有效 → **设置明确的有效期，Access Token 通常更短**
- **Token 撤销**：退出登录、账号异常、权限变化时要能提前失效 → **维护撤销状态、黑名单，或者直接删除服务端 Token 状态**
- **安全校验**：Code 可能被劫持或滥用 → **绑定 `client_id`、`redirect_uri`，Code 短期一次性使用；前端/移动端可配 PKCE**
- **授权服务自身管理**：需要知道谁在申请什么权限 → **管理 client_id、client_secret、redirect_uri、scope、Code、Token 生命周期**

最后主线可以记成：

**授权跳转 → Code → Code 换 Access Token → Refresh Token 续期 → Scope 控权限 → 过期和撤销管生命周期 → JWT/服务端状态完成 Token 校验。**
