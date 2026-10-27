# 安全设计

更新：2026-10-27

## 边界

1. **当前设备**：HTTP 服务默认 loopback；CLI 通过 `runtime.json`（0600）发现端口与令牌。
2. **局域网**：打包版监听 `0.0.0.0`，但除非设置开启「局域网访问」，非 loopback 请求一律 403；开启后要求配对 cookie 或 Bearer token。存在证书时另监听固定 47822 的 HTTPS，供 PWA 离线使用。
3. **外部**：仅 AI 请求会离开设备，且只发往用户配置的 Base URL；外链由系统浏览器打开。

## 账户与会话

- 注册/登录仅在当前设备（loopback）开放；用户名 2–32 字符，密码至少 8 位。
- 密码用 Node `scrypt` + 随机 salt 哈希；比较使用 `timingSafeEqual`。
- 会话 token 32 字节随机，存于 `sessions` 表；cookie 为 HttpOnly + SameSite=Lax，HTTPS 下附加 Secure，30 天有效。
- 每个账户独立的 SQLite 文件（`users/<id>/data.sqlite`），中间件按会话切换数据库；未登录的 `/api/*` 请求返回 401（首个账户创建前除外）。
- 修改密码校验当前密码，并使该账户其他会话失效。
- 头像只接收 PNG/JPEG/WebP/GIF，≤5MB，通过鉴权后的图片端点读取。
- 局域网配对创建首个账户的会话；未配对浏览器访问 HTML 首页会转到 `/pair`。

## 认证

- 服务首次启动生成 24 字节随机 token 并写入 `server-token`（0600），后续启动复用；CLI/MCP 使用它映射到首个账户；配对不再直接复用服务 token，而是创建账户会话。
- 配对码 6 位数字，10 分钟内同一 IP 最多 10 次尝试；成功后写 HttpOnly、SameSite=Lax cookie（有效期一年）。
- 2026-10-27 前无账号体系；v1.0 不计划公网部署。

## Electron

- `contextIsolation: true`、`sandbox: true`、`nodeIntegration: false`、`webSecurity: true`。
- preload 仅暴露 `dailywork` 白名单：打开数据目录、重启、版本、数据目录路径。
- 阻止 window.open 与站外导航，外链交给 `shell.openExternal`。
- 生产 HTML 带 CSP：`default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'`。
- 关闭窗口隐藏到托盘；全局快捷键 `⌘⇧Space`。

## 数据

- SQLite WAL；文件权限继承用户目录；runtime/secrets 0600。
- 图片：白名单 mime、20MB 上限、禁止 SVG（脚本执行风险）、sha256 去重。
- HTTPS：自签名证书写入 `<dataDir>/certs`（key 0600，含当前 LAN IP 的 SAN）；手机需手动安装并完全信任证书。证书不等同于 Developer ID，不会让 macOS 应用通过 Gatekeeper 公证。
- 备份：导入前 `integrity_check`、schema 版本检查、当前库自动备份；导入暂存、重启原子替换。备份包含加密 AI 密钥与密钥文件，必须按敏感文件保管（0600）。
- 日志：pino 结构化；不记录任务正文、密钥、AI 对话。

## 威胁与缓解

| 威胁 | 缓解 |
|---|---|
| 局域网他人读取 | 默认关闭 LAN；配对码 + cookie；限流 |
| 恶意网页 CSRF | 无 CORS 允许；JSON + SameSite cookie；LAN 需配对 |
| XSS 通过文档内容 | TipTap 渲染 JSON 节点，不执行 HTML；链接由系统浏览器打开 |
| 恶意附件 | mime/大小白名单、无 SVG、服务端不解析图片 |
| 密钥泄漏 | AES-GCM 加密、0600、不回传、不入日志/备份之外的导出（备份包含加密值） |
| AI 误删 | 破坏性操作恒需人工；变更开关；op_log 审计 |
