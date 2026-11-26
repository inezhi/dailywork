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
  updated_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
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
  status           TINYINT NOT NULL DEFAULT 1,         -- 1=inbox 2=next 3=doing 4=waiting 5=blocked 6=done；与 const/task_const.thrift 的编号一致
  priority         TINYINT NOT NULL DEFAULT 1,         -- 1=none 2=low 3=medium 4=high 5=urgent；只影响排序与视觉
  scheduled_date   DATE NULL,                          -- 计划哪天做；决定"今天计划"分组
  due_date         DATE NULL,                          -- 哪天必须交；早于今天且未完成即"逾期"
  estimate_minutes INT NULL,                           -- 预估耗时（分钟），0–10000；NULL 表示没估过
  actual_minutes   INT NOT NULL DEFAULT 0,             -- 实际耗时；v2.0 只存不用
  sort_order       BIGINT NOT NULL DEFAULT 0,          -- 同组内的手工排序位
  version          INT NOT NULL DEFAULT 1,             -- 乐观锁版本，每次成功写入 +1
  completed_at     DATETIME(3) NULL,                   -- 完成时间；与 status='done' 必须同时成立或同时不成立
  deleted_at       DATETIME(3) NULL,                   -- 逻辑删除时间；非空即已删，不做物理清理
  created_at       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  KEY tasks_today_idx (user_id, deleted_at, scheduled_date, due_date),  -- 今天查询
  KEY tasks_project_idx (project_id, deleted_at, status),               -- 按项目列任务
  KEY tasks_parent_idx (parent_id),                                     -- 查子任务
  KEY tasks_space_idx (space_id, deleted_at),                           -- 按空间列任务

  CONSTRAINT chk_tasks_status   CHECK (status BETWEEN 1 AND 6),
  CONSTRAINT chk_tasks_priority CHECK (priority BETWEEN 1 AND 5),
  CONSTRAINT chk_tasks_done     CHECK ((status = 6) = (completed_at IS NOT NULL))
    -- 完成状态与完成时间必须一致：不能出现 done 却没有 completed_at，反之亦然
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 用户：邮箱与手机号二选一，密码只存 bcrypt 哈希。
CREATE TABLE users (
  id               CHAR(36) PRIMARY KEY,               -- UUID，应用生成
  email            VARCHAR(254) NULL,                  -- 登录名之一；与 phone 至少有一个
  phone            VARCHAR(20)  NULL,                  -- 登录名之一；中国手机号 11 位，留余量
  password_hash    VARCHAR(100) NOT NULL,              -- bcrypt 哈希固定 60 字符，留升级余量
  avatar_url       VARCHAR(500) NULL,                  -- 头像地址；以后接 MinIO 存对象路径
  membership_level TINYINT NOT NULL DEFAULT 0,         -- 0=free 1=pro，后续扩展
  created_at       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  UNIQUE KEY users_email_uq (email),                   -- 唯一索引允许多个 NULL
  UNIQUE KEY users_phone_uq (phone),
  CONSTRAINT chk_users_identifier CHECK (email IS NOT NULL OR phone IS NOT NULL)  -- 至少要有一种登录方式
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 会话：一行一次登录，JWT 里带的就是 id；设备列表 = 该用户未过期的行。
CREATE TABLE sessions (  id           CHAR(36) PRIMARY KEY,                   -- JWT 里的 session id
  user_id      CHAR(36) NOT NULL,                      -- 归属用户；不建外键
  client       VARCHAR(20) NOT NULL,                   -- web 或 desktop
  device       VARCHAR(100) NULL,                      -- 设备描述，如 "MacBook Pro / Chrome"
  ip           VARCHAR(45) NULL,                       -- IPv6 最长 45
  expires_at   DATETIME(3) NOT NULL,                   -- 过期时间；校验时比较
  revoked_at   DATETIME(3) NULL,                       -- 登出时间；非空即已吊销
  last_seen_at DATETIME(3) NULL,                       -- 最近活跃；分批更新，不每个请求都写
  created_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  KEY sessions_user_idx (user_id, expires_at),         -- 列某人的会话
  KEY sessions_expires_idx (expires_at)                -- 清理过期会话
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 待发布事件：与业务写入同一事务，由 relay 异步投递到 Kafka。
-- 投递语义是至少一次，消费者按事件 id 去重。
CREATE TABLE outbox (
  id             CHAR(36) PRIMARY KEY,                 -- 事件 id，消费者按它去重
  aggregate_type VARCHAR(50)  NOT NULL,                -- 聚合类型，如 task
  aggregate_id   CHAR(36)     NOT NULL,                -- 聚合 id，也是 Kafka 消息 key
  event_type     VARCHAR(100) NOT NULL,                -- 如 task.completed
  payload        JSON         NOT NULL,                -- 完整事件信封
  attempts       INT          NOT NULL DEFAULT 0,      -- 投递尝试次数
  published_at   DATETIME(3)  NULL,                    -- 非空即已发布
  created_at     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  KEY outbox_unpublished_idx (published_at, created_at),  -- relay 取未发布
  KEY outbox_aggregate_idx (aggregate_id)                 -- 按聚合查事件
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
