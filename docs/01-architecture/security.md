# 安全设计

更新：2026-10-27

## 边界

1. **服务端**：Docker 容器监听 `0.0.0.0`，服务器部署模式允许远程登录；默认只允许创建首个账户，`DAILYWORK_OPEN_REGISTRATION=1` 才继续公开注册。
2. **客户端**：桌面 Electron、浏览器与后续 Android 客户端连接同一服务端；桌面端只保存连接地址与窗口状态，不保存业务数据库。
3. **外部**：仅 AI 请求会离开服务端，且只发往用户配置的 Base URL；外链由系统浏览器打开。

## 账户与会话

- 用户名 2–32 字符，密码至少 8 位。服务器模式下允许远程注册首个账户和登录；注册关闭后新账户需管理员处理。
- 密码用 Node `scrypt` + 随机 salt 哈希；比较使用 `timingSafeEqual`。
- 会话 token 32 字节随机，存于 `sessions` 表；cookie 为 HttpOnly + SameSite=Lax，HTTPS 下附加 Secure，30 天有效。
- 每个账户独立的 SQLite 文件（`users/<id>/data.sqlite`），中间件按会话切换数据库；未登录的 `/api/*` 请求返回 401（首个账户创建前除外）。
- 修改密码校验当前密码，并使该账户其他会话失效。
- 头像只接收 PNG/JPEG/WebP/GIF，≤5MB，通过鉴权后的图片端点读取。
- 局域网配对仍保留给桌面开发模式；生产 Docker 部署通过服务器模式登录，不依赖配对页。

## 认证

- 服务首次启动生成 24 字节随机 token 并写入 `server-token`（0600），后续启动复用；CLI/MCP 使用它映射到首个账户。
- 配对码 6 位数字，10 分钟内同一 IP 最多 10 次尝试；成功后写 HttpOnly、SameSite=Lax cookie（有效期一年）。
- 2026-10-27 前无账户体系；0.2.0 支持账户；公网部署不在当前版本范围。

## Electron

- `contextIsolation: true`、`sandbox: true`、`nodeIntegration: false`、`webSecurity: true`。
- preload 仅暴露 `dailywork` 白名单：连接服务器、重启、版本、连接地址；远程模式下 UI 隐藏客户端目录操作。
- 只允许加载已配置的服务端源或客户端 `connection.html`；其他 http(s) 外链交给 `shell.openExternal`。
- 生产 HTML 带 CSP：`default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'`。
- 关闭窗口隐藏到托盘；全局快捷键 `⌘⇧Space`。

## 数据

- 服务端 SQLite WAL，数据在 Docker `/data` volume；runtime/secrets 0600。
- 图片：白名单 mime、20MB 上限、禁止 SVG（脚本执行风险）、sha256 去重。
- HTTPS：自签名证书写入 `<dataDir>/certs`（key 0600，含当前 LAN IP 的 SAN）；手机需手动安装并完全信任证书。证书不等同于 Developer ID，不会让 macOS 应用通过 Gatekeeper 公证。
- 备份：导入前 `integrity_check`、schema 版本检查、当前库自动备份；导入暂存、服务端重启原子替换。账户备份不含 AI 密钥解密根；服务端 volume 与备份文件必须按敏感文件保管。
- 日志：pino 结构化；不记录任务正文、密钥、AI 对话。

## 威胁与缓解

| 威胁 | 缓解 |
|---|---|
| 未授权远程读取 | 服务器模式首账户注册；`DAILYWORK_OPEN_REGISTRATION=0`；账户会话鉴权；反向代理 TLS |
| 客户端连接到伪造服务端 | 桌面端只加载用户显式配置的地址；连接前测试 `/api/health`；不自动回退到另一份数据库 |
| 恶意网页 CSRF | 无 CORS 允许；JSON + SameSite cookie；LAN 需配对 |
| XSS 通过文档内容 | TipTap 渲染 JSON 节点，不执行 HTML；链接由系统浏览器打开 |
| 恶意附件 | mime/大小白名单、无 SVG、服务端不解析图片 |
| 密钥泄漏 | AES-GCM 加密、0600、不回传、不入日志/备份之外的导出（备份包含加密值） |
| AI 误删 | 破坏性操作恒需人工；变更开关；op_log 审计 |
