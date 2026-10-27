# 数据模型与存储

更新：2026-10-27 · 对应 schema v2 · 飞书归档：[07 数据存储、备份与导出](https://my.feishu.cn/wiki/LcvjwjRJ9iVboYkNvucclMnWnEd)

## 1. 原则

1. **一个本地数据库**：`~/Library/Application Support/Dailywork/data.sqlite`，WAL 模式。
2. **业务日期是本地日期字符串** `YYYY-MM-DD`；时间戳是 UTC ISO-8601。禁止用 UTC 日期推导「今天」。
3. **写路径只经 ops**；同一事务内写业务表与 `op_log`。
4. **图片入库**：不依赖文件路径；blob 不可变、按内容寻址、引用计数。
5. **迁移单向**：`schema_migrations` 记录版本；启动自动执行未应用的迁移。

## 2. 表结构

### 核心

- `spaces(id, name, color, icon, sort_order, archived_at, created_at, updated_at)`
- `projects(id, space_id→spaces, name, description, color, icon, status, start_date, due_date, acceptance_criteria, sort_order, archived_at, created_at, updated_at)`
- `tasks(id, space_id→spaces, project_id→projects, parent_id→tasks, title, notes, status, priority, scheduled_date, scheduled_time, due_date, estimate_minutes, actual_minutes, sort_order, completed_at, archived_at, created_at, updated_at, version)`
  - status ∈ `inbox|next|doing|waiting|blocked|done`；priority ∈ `none|low|medium|high|urgent`。
  - `parent_id` 只允许一层；删除父任务级联删除子任务。
  - `version` 每写 +1，用于 `expectedVersion` 乐观并发。
- `tags(id, name UNIQUE COLLATE NOCASE, color, created_at)`、`task_tags(task_id, tag_id)` 多对多。

### 捕获

- `memos(id, content, tags_json, pinned, color, converted_task_id→tasks, created_at, updated_at, archived_at)`
  - 标签同时来自显式标签与正文 `#hashtag`；转换任务后不可重复转换。

### 计划与专注

- `capacity_days(date PRIMARY KEY, capacity_minutes, note, updated_at)`；缺省用设置里的默认容量。
- `routines(id, name, time, weekdays_json, enabled, created_at)`（API 已有，UI 待补）。
- `focus_sessions(id, task_id→tasks SET NULL, mode, planned_minutes, started_at, ended_at, actual_seconds, status, note)`
  - 部分唯一索引 `WHERE status='running'` 保证同时仅一个进行中会话。
  - 完成时按实际秒数累计到 `tasks.actual_minutes`。

### 文档

- `documents(id, parent_id, space_id, project_id, task_id, title, icon, excerpt, sort_order, archived_at, created_at, updated_at)`
- `document_bodies(document_id PK→documents, content_json, text, updated_at)`：正文只存 TipTap JSON，`text` 为纯文本投影用于搜索。
- `document_links(document_id, target_type, target_id)`：从正文中的 `task://` / `project://` / `document://` 提取，用于反向链接。

### 项目扩展

- `deliverables(id, project_id→projects, title, status, due_date, note, sort_order, created_at, updated_at)`
- `templates(id, name, description, space_id, project_id, items_json, created_at, updated_at)`

### 附件与图片

- `blobs(id, sha256 UNIQUE, mime, bytes, width, height, data BLOB, thumb_data BLOB, ref_count, created_at)`
- `attachments(id, owner_type∈task|document|memo, owner_id, blob_id→blobs, filename, sort_order, created_at)`
- 允许：PNG / JPEG / WebP / GIF / PDF；≤20MB；不允许 SVG。缩略图由浏览器 canvas 生成 320px WebP 后一起上传。

### 设置、审计、AI

- `settings(key PRIMARY KEY, value_json, updated_at)`：`theme`、`general`。
- `op_log(id AUTOINCREMENT, op_id UNIQUE, ts, actor, source, command, aggregate_type, aggregate_id, summary, payload_json, after_json, schema_version)`
  - 索引：ts、aggregate、command。`after_json` 保存操作后快照，用于幂等重放与删除留痕。
- `ai_providers(id, name, base_url, model, api_key_encrypted, is_default, created_at, updated_at)`
- `ai_conversations(id, title, context_kind, context_id, created_at, updated_at)`
- `ai_messages(id, conversation_id→ai_conversations, role, content, tool_name, created_at)`

### 迁移与元数据

- `schema_migrations(version PK, applied_at)`
- `meta(key PK, value)`：`schema_version`、`seeded`、`created_at`。

## 3. 不变量

1. 任务必须在存在的空间内；项目必须属于空间；移动项目时任务空间随项目更新。
2. 子任务继承父任务的空间与项目；不允许三层。
3. 完成状态与 `completed_at` 同步：进入 done 写时间，离开 done 清空。
4. 删除标签自动清理 `task_tags`；删除附件零引用回收 blob。
5. 计划日期 / 截止日期是本地日期，不存时区；跨时区设备（未来）需迁移策略。
6. 所有命令必须携带（或由服务端生成）全局唯一 `opId`；重复 `opId` 不重复执行。

## 4. 备份格式 `.dailywork`

zip 文件，包含：

- `manifest.json`：`{format:"dailywork", formatVersion:1, schemaVersion, appVersion, createdAt, counts:{tasks,projects,documents,memos,attachments,blobs}}`
- `data.sqlite`：`VACUUM INTO` 生成的单文件快照（含图片 BLOB）。
- `README.txt`：人类可读说明。
- `secrets.key`（如存在）：AI key 的本地加密根，保证备份在新机器可恢复（备份文件含全部数据，请等同敏感文件保管）。

导出路径默认 `<dataDir>/backups/dailywork-YYYYMMDD-HHmmss.dailywork`。

导入流程：

1. 读取 zip，校验 manifest 与 `data.sqlite` 存在。
2. 写入临时文件，用 `node:sqlite` 打开，`PRAGMA integrity_check`，检查 schema 版本不高于当前。
3. 写入 `data.sqlite.import-pending` 与 `import-pending.json`。
4. 应用下次启动：`applyPendingImport` 备份当前 `data.sqlite` 到 `backups/before-import-*.sqlite`，清理 WAL/SHM，原子 rename；`secrets.key.import-pending` 同步恢复。

## 5. 数据目录

```
~/Library/Application Support/Dailywork/
  data.sqlite            # 权威数据（WAL）
  data.sqlite-wal / -shm
  runtime.json           # 端口 / token / 配对码 / pid（0600）
  server-token           # 持久化服务 token，配对 cookie 重启后仍有效（0600）
  secrets.key            # AI 密钥加密根（0600）
  backups/               # 导出与导入前备份
  logs/dailywork.log     # 结构化日志，无正文/密钥
  window-state.json      # 桌面窗口位置
```

可用 `DAILYWORK_DATA_DIR` 覆盖（测试与开发使用临时目录或仓库 `.data`）。
