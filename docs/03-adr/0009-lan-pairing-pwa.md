# ADR-0009：局域网访问采用配对码 + Cookie，PWA 先做壳

状态：已接受 · 2026-10-27

## 背景

手机/平板通过局域网访问是 v1.0 范围；需要在不引入账号体系的前提下防止局域网内随意读取数据，并尽量接近可安装的 PWA。

## 决策

- 打包版服务监听 `0.0.0.0`；非 loopback 请求只有在设置开启「局域网访问」后放行。
- 首次访问 `/pair` 输入 6 位配对码（10 分钟 10 次限流）；校验通过写入 HttpOnly `daily_token` cookie（SameSite=Lax）；Bearer token 亦可用于 CLI。服务 token 持久化在 `server-token`，配对设备跨重启有效，配对码每次启动轮换。
- 静态资源与配对页无需鉴权；所有 `/api/*` 数据请求需要 cookie/Bearer。
- `manifest.webmanifest` + 192/512 图标 + Service Worker；SW 仅在 HTTPS/localhost 注册（浏览器限制）。
- 提供可选 HTTPS：`lan.setupHttps` / `pnpm lan:https` 生成含当前 LAN IP 的自签名证书，固定端口 47822；手机安装并完全信任证书后，PWA 可离线缓存。证书不是 Developer ID，不改变 macOS 应用公证状态。
- 不做 mkcert 一键安装；自签名证书 + 设置页图文说明是 v0.1 的折中。

## 结果

- 无需账号即可安全地在同一 Wi-Fi 使用手机/平板。
- 局域网 HTTP 无离线缓存；HTTPS 模式需要用户手动信任自签名证书。真实 iPhone 验收需用户设备与证书信任操作。
