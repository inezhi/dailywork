-- M1 的三张表：spaces / projects / tasks。
--
-- 按约定不使用外键：跨表一致性由应用层保证，不依赖数据库。
-- 任务只做逻辑删除（写 deleted_at），不做物理清理，所以也没有级联删除的问题。
-- 插入前要自己确认 space_id / project_id 指向的记录存在。
-- 索引照建：外键列该有的查询索引一个不少。

CREATE TABLE spaces (
  id          CHAR(36) PRIMARY KEY,
  user_id     CHAR(36) NOT NULL,
  name        VARCHAR(40) NOT NULL,
  color       VARCHAR(7) NOT NULL DEFAULT '#1677FF',
  archived_at DATETIME(3) NULL,
  created_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
              ON UPDATE CURRENT_TIMESTAMP(3),
  active_name VARCHAR(40) GENERATED ALWAYS AS
              (IF(archived_at IS NULL, LOWER(name), NULL)) STORED,
  UNIQUE KEY spaces_active_name_uq (user_id, active_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE projects (
  id          CHAR(36) PRIMARY KEY,
  user_id     CHAR(36) NOT NULL,
  space_id    CHAR(36) NOT NULL,
  name        VARCHAR(80) NOT NULL,
  description MEDIUMTEXT NOT NULL,
  color       VARCHAR(7) NOT NULL DEFAULT '#1677FF',
  start_date  DATE NULL,
  due_date    DATE NULL,
  archived_at DATETIME(3) NULL,
  created_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
              ON UPDATE CURRENT_TIMESTAMP(3),
  active_name VARCHAR(80) GENERATED ALWAYS AS
              (IF(archived_at IS NULL, LOWER(name), NULL)) STORED,
  UNIQUE KEY projects_active_name_uq (space_id, active_name),
  KEY projects_space_idx (space_id, archived_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE tasks (
  id               CHAR(36) PRIMARY KEY,
  user_id          CHAR(36) NOT NULL,
  space_id         CHAR(36) NOT NULL,
  project_id       CHAR(36) NULL,
  parent_id        CHAR(36) NULL,
  title            VARCHAR(200) NOT NULL,
  notes            MEDIUMTEXT NOT NULL,
  status           VARCHAR(16) NOT NULL DEFAULT 'inbox',
  priority         VARCHAR(16) NOT NULL DEFAULT 'none',
  scheduled_date   DATE NULL,
  due_date         DATE NULL,
  estimate_minutes INT NULL,
  actual_minutes   INT NOT NULL DEFAULT 0,
  sort_order       BIGINT NOT NULL DEFAULT 0,
  version          INT NOT NULL DEFAULT 1,
  completed_at     DATETIME(3) NULL,
  deleted_at       DATETIME(3) NULL,
  created_at       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                   ON UPDATE CURRENT_TIMESTAMP(3),
  KEY tasks_today_idx (user_id, deleted_at, scheduled_date, due_date),
  KEY tasks_project_idx (project_id, deleted_at, status),
  KEY tasks_parent_idx (parent_id),
  KEY tasks_space_idx (space_id, deleted_at),
  CONSTRAINT chk_tasks_status CHECK (status IN ('inbox','next','doing','waiting','blocked','done')),
  CONSTRAINT chk_tasks_priority CHECK (priority IN ('none','low','medium','high','urgent')),
  CONSTRAINT chk_tasks_done CHECK ((status = 'done') = (completed_at IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
