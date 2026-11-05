# M1 数据库 ER 图

三张表：`spaces` → `projects` / `tasks`，任务可挂一层子任务。

**图上连线是逻辑关联，不是外键。** 库表不建外键，一致性由应用层保证；
完整字段定义见 [`deploy/mysql/init/02-schema.sql`](../../deploy/mysql/init/02-schema.sql)。

```mermaid
erDiagram
    spaces ||--o{ projects : "包含"
    spaces ||--o{ tasks : "归属"
    projects ||--o{ tasks : "归属（可空）"
    tasks ||--o{ tasks : "父子，只一层"

    spaces {
        char36 id PK
        char36 user_id "来自 identity，只存 ID"
        varchar40 name
        datetime deleted_at "非空即已删"
    }

    projects {
        char36 id PK
        char36 user_id
        char36 space_id
        varchar80 name
        text description
        datetime archived_at
    }

    tasks {
        char36 id PK
        char36 user_id
        char36 space_id
        char36 project_id "可空"
        char36 parent_id "可空，只一层"
        varchar200 title
        text notes
        varchar16 status "inbox..done 六值"
        varchar16 priority "none..urgent 五值"
        date scheduled_date
        date due_date
        int estimate_minutes
        int actual_minutes
        int version "乐观锁"
        datetime completed_at "与 status=done 绑定"
        datetime deleted_at "非空即已删"
    }
```

## 几条约束

| 规则 | 落在哪里 |
|---|---|
| 状态只有六个值，没有 `archived` | `chk_tasks_status` |
| 优先级只有五个值 | `chk_tasks_priority` |
| `done` 与 `completed_at` 同时成立 | `chk_tasks_done` |
| 同一用户的活跃空间不重名 | `spaces_active_name_uq` + 生成列 `active_name` |
| 同一空间的活跃项目不重名 | `projects_active_name_uq` + 生成列 `active_name` |
| 任务只做逻辑删除 | `deleted_at`，所有查询过滤 `deleted_at IS NULL` |

## 尚未建的表

`tags`、`task_tags`、`outbox`、`idempotency_keys`、`processed_events` 属于后续切片，
等用到时再加。
