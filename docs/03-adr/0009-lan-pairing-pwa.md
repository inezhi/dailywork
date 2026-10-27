# ADR-0009：局域网访问采用配对码 + Cookie，PWA 先做壳

状态：已接受 · 2026-10-27

## 背景

手机/平板通过局域网访问是 v1.0 范围；需要在不引入账号体系的前提下防止局域网内随意读取数据，并尽量接近可安装的 PWA。

## 决策

- 打包版服务监听 `0.0.0.0`；非 loopback 请求只有在设置开启「局域网访问」后放行。
- 首次访问 `/pair` 输入 6 位配对码（10 分钟 10 次限流）；校验通过写入 HttpOnly `daily_token` cookie（SameSite=Lax）；Bearer token 亦可用于 CLI。
- 静态资源与配对页无需鉴权；所有 `/api/*` 数据请求需要 cookie/Bearer。
- `manifest.webmanifest` + 192/512 图标 + Service Worker；SW 仅在 HTTPS/localhost 注册（浏览器限制），局域网 HTTP 下仍可通过 Safari「添加到主屏幕」获得接近全屏的体验。
- 不做 mkcert 自动证书；HTTPS 引导与证书信任列入 v1.1。

## 结果

- 无需账号即可安全地在同一 Wi-Fi 使用手机/平板。
- 局域网 HTTP 无离线缓存；如需完整 PWA 能力，需要 HTTPS 证书方案。
