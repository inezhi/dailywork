-- 建表脚本。MySQL 容器第一次启动时自动执行（数据卷为空时）。
-- 改了这里要 make down-v 重建数据卷才会生效。
--
-- 约定：不建外键，跨表一致性由应用层保证；任务只做逻辑删除（deleted_at），
-- 不做物理清理，所以也没有级联删除的问题。外键列的索引照建。

USE dailywork;

-- 空间：任务的一级分组。每个用户至少有一个"个人"空间。
-- 空间可以删除：deleted_at 非空即视为已删，所有查询都要过滤。
CREATE TABLE spaces (
  id          CHAR(36) PRIMARY KEY,                    -- UUID，应用生成
  user_id     CHAR(36) NOT NULL,                       -- 归属用户；来自 identity 库，只存 ID 不建外键
  name        VARCHAR(40) NOT NULL,                    -- 空间名，用户可见
  deleted_at  DATETIME(3) NULL,                        -- 逻辑删除时间；非空即已删，不做物理清理
  created_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
              ON UPDATE CURRENT_TIMESTAMP(3),
  active_name VARCHAR(40) GENERATED ALWAYS AS
              (IF(deleted_at IS NULL, LOWER(name), NULL)) STORED,
              -- 生成列：未删除时等于名字小写，删除后为 NULL。
              -- 配合下面的唯一索引，实现"活跃空间名唯一、已删空间可重名"。
  UNIQUE KEY spaces_active_name_uq (user_id, active_name)  -- 同一用户的活跃空间不能重名
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 项目：空间的下一级分组。任务可以只挂在空间上，也可以再归到某个项目。
CREATE TABLE projects (
  id          CHAR(36) PRIMARY KEY,
  user_id     CHAR(36) NOT NULL,                       -- 归属用户
  space_id    CHAR(36) NOT NULL,                       -- 所属空间；应用层保证存在
  name        VARCHAR(80) NOT NULL,                    -- 项目名
  description MEDIUMTEXT NOT NULL,                     -- 项目说明；空串表示没写
  color       VARCHAR(7)  NOT NULL DEFAULT '#1677FF',
  start_date  DATE NULL,                               -- 计划开始日；YYYY-MM-DD，不做时区转换
  due_date    DATE NULL,                               -- 计划截止日
  archived_at DATETIME(3) NULL,                        -- 归档时间；归档项目下的任务不进"今天"
  created_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
              ON UPDATE CURRENT_TIMESTAMP(3),
  active_name VARCHAR(80) GENERATED ALWAYS AS
              (IF(archived_at IS NULL, LOWER(name), NULL)) STORED,
              -- 同 spaces.active_name：活跃名称唯一，归档后可重名
  UNIQUE KEY projects_active_name_uq (space_id, active_name),  -- 同一空间内活跃项目不重名
  KEY projects_space_idx (space_id, archived_at)               -- 按空间列项目
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 任务：核心表。只做逻辑删除，deleted_at 非空即视为已删，所有查询都要过滤。
CREATE TABLE tasks (
  id               CHAR(36) PRIMARY KEY,               -- UUID，应用生成（MySQL 没有 RETURNING）
  user_id          CHAR(36) NOT NULL,                  -- 归属用户；来自会话，不接受客户端传
  space_id         CHAR(36) NOT NULL,                  -- 所属空间；带 parent_id 时继承父任务的
  project_id       CHAR(36) NULL,                      -- 所属项目；NULL 表示只挂在空间上
  parent_id        CHAR(36) NULL,                      -- 父任务；只允许一层，父任务自身不能再有父任务
  title            VARCHAR(200) NOT NULL,              -- 标题，1–200 字符
  notes            MEDIUMTEXT NOT NULL,                -- 正文；空串表示没写。MEDIUMTEXT 是为了装下 2 万字符
  status           VARCHAR(16) NOT NULL DEFAULT 'inbox',
                   -- inbox|next|doing|waiting|blocked|done；没有 archived
  priority         VARCHAR(16) NOT NULL DEFAULT 'none',
                   -- none|low|medium|high|urgent；只影响排序与视觉
  scheduled_date   DATE NULL,                          -- 计划哪天做；决定"今天计划"分组
  due_date         DATE NULL,                          -- 哪天必须交；早于今天且未完成即"逾期"
  estimate_minutes INT NULL,                           -- 预估耗时（分钟），0–10000；NULL 表示没估过
  actual_minutes   INT NOT NULL DEFAULT 0,             -- 实际耗时；v2.0 只存不用
  sort_order       BIGINT NOT NULL DEFAULT 0,          -- 同组内的手工排序位
  version          INT NOT NULL DEFAULT 1,             -- 乐观锁版本，每次成功写入 +1
  completed_at     DATETIME(3) NULL,                   -- 完成时间；与 status='done' 必须同时成立或同时不成立
  deleted_at       DATETIME(3) NULL,                   -- 逻辑删除时间；非空即已删，不做物理清理
  created_at       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                   ON UPDATE CURRENT_TIMESTAMP(3),

  KEY tasks_today_idx (user_id, deleted_at, scheduled_date, due_date),  -- 今天查询
  KEY tasks_project_idx (project_id, deleted_at, status),               -- 按项目列任务
  KEY tasks_parent_idx (parent_id),                                     -- 查子任务
  KEY tasks_space_idx (space_id, deleted_at),                           -- 按空间列任务

  CONSTRAINT chk_tasks_status CHECK (status IN ('inbox','next','doing','waiting','blocked','done')),
  CONSTRAINT chk_tasks_priority CHECK (priority IN ('none','low','medium','high','urgent')),
  CONSTRAINT chk_tasks_done CHECK ((status = 'done') = (completed_at IS NOT NULL))
    -- 完成状态与完成时间必须一致：不能出现 done 却没有 completed_at，反之亦然
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
