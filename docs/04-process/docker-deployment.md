# Docker 部署

更新：2026-10-28 · 对应应用版本 0.2.0

## 1. 形态

镜像包含：

- Hono 应用服务（`server.mjs`）
- 构建后的 Web 静态资源（`/app/web`）
- 内置 SQLite 引擎（Node `node:sqlite`）
- 账户库与每账户工作区数据库（运行时创建在 `/data`）

SQLite 随应用运行，不需要单独启动数据库容器。`/data` 使用 Docker volume 持久化；删除容器不会删除数据。

> 当前架构是单实例写模型。不要对同一个 `/data` 启动多个副本；需要横向扩展时应先迁移到支持并发的数据库与服务拆分。

## 2. 启动

```bash
cp .env.example .env
docker compose up -d --build
docker compose ps
curl http://127.0.0.1:47821/api/health
```

打开 `http://127.0.0.1:47821`，首次访问会进入注册页。默认只允许创建第一个账户；之后公开注册关闭。

查看日志：

```bash
docker compose logs -f dailywork
```

停止：

```bash
docker compose down
```

数据在 `dailywork-data` volume 中，`down` 不会删除。只有 `docker compose down -v` 才会删除数据。

## 3. 环境变量

| 变量 | 默认 | 说明 |
|---|---|---|
| `DAILYWORK_SERVER_MODE` | `1`（镜像内） | 服务器部署模式；允许远程登录，跳过局域网配对开关 |
| `DAILYWORK_DATA_DIR` | `/data` | 账户库、工作区库、备份、日志与密钥目录 |
| `DAILYWORK_HOST` | `0.0.0.0` | 监听地址 |
| `DAILYWORK_PORT` | `47821` | HTTP 端口 |
| `DAILYWORK_WEB_DIST` | `/app/web` | Web 构建产物目录 |
| `DAILYWORK_OPEN_REGISTRATION` | `0` | `0` 只允许创建第一个账户；`1` 允许继续公开注册 |
| `DAILYWORK_SECURE_COOKIES` | `0` | 反向代理终止 TLS 时设为 `1`，会话 cookie 带 `Secure` |
| `DAILYWORK_TRUST_PROXY` | `0` | 信任 `X-Forwarded-Proto`；仅在代理可控时开启 |

## 4. 反向代理与 HTTPS

生产环境建议在容器前放 Caddy / Nginx / 云负载均衡，由代理终止 TLS。Caddy 示例：

```caddyfile
dailywork.example.com {
  reverse_proxy 127.0.0.1:47821
}
```

同时设置：

```bash
DAILYWORK_SECURE_COOKIES=1
DAILYWORK_TRUST_PROXY=1
```

只对可信代理开启 `DAILYWORK_TRUST_PROXY`，否则客户端可以伪造协议头。

首次公开部署前，建议先通过防火墙/VPN 限制访问完成第一个账户注册；确认后再开放。默认配置下，第一个账户创建后远程注册会被拒绝。

## 5. 数据、备份与恢复

数据目录：

```text
/data/
  accounts.sqlite
  users/<userId>/data.sqlite
  backups/
  certs/            # 可选，由设置页生成
  logs/
  runtime.json
  server-token
  secrets.key
```

备份方式：

1. **应用内**：设置 → 数据与备份 → 立即备份 / 导出 `.dailywork`。账户备份不包含 AI 密钥解密根，恢复后需重填 API Key。
2. **Volume 级**：停止容器后备份整个 `dailywork-data` volume，适合整机迁移。

恢复时保持应用版本不降级；导入后重启容器：

```bash
docker compose restart dailywork
```

## 6. 健康检查与升级

```bash
docker compose exec dailywork node -e "fetch('http://127.0.0.1:47821/api/health').then(r=>r.json()).then(console.log)"
```

升级：

```bash
git pull
docker compose build --pull
docker compose up -d
```

升级前先导出 `.dailywork` 或备份 volume。应用启动时会自动执行数据库迁移并生成当日快照。

## 7. 构建与推送镜像

```bash
docker build -t dailywork:0.2.0 .
docker tag dailywork:0.2.0 registry.example.com/dailywork:0.2.0
docker push registry.example.com/dailywork:0.2.0
```

当前 `docker-compose.yml` 使用本地构建；接入镜像仓库后把 `build` 改为 `image` 即可。

## 8. 已知边界

- 单实例 SQLite；不支持多副本共享同一数据目录。
- 账户删除、密码找回尚未提供。
- AI 仍由用户配置 OpenAI 兼容供应商；镜像不包含模型，也不运行模型。
- 通知、移动端离线增强等能力仍按 0.2.0 的范围执行。
