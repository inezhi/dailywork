export const MIGRATION_1 = `
CREATE TABLE meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE spaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#D97757',
  icon TEXT NOT NULL DEFAULT 'layers',
  sort_order REAL NOT NULL DEFAULT 0,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#D97757',
  icon TEXT NOT NULL DEFAULT 'folder',
  status TEXT NOT NULL DEFAULT 'active'
    CHECK(status IN ('active','paused','done','archived')),
  start_date TEXT,
  due_date TEXT,
  acceptance_criteria TEXT NOT NULL DEFAULT '',
  sort_order REAL NOT NULL DEFAULT 0,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL REFERENCES spaces(id),
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  parent_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'next'
    CHECK(status IN ('inbox','next','doing','waiting','blocked','done')),
  priority TEXT NOT NULL DEFAULT 'none'
    CHECK(priority IN ('none','low','medium','high','urgent')),
  scheduled_date TEXT,
  scheduled_time TEXT,
  due_date TEXT,
  estimate_minutes INTEGER,
  actual_minutes INTEGER,
  sort_order REAL NOT NULL DEFAULT 0,
  completed_at TEXT,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_tasks_status ON tasks(status, sort_order);
CREATE INDEX idx_tasks_project ON tasks(project_id, status);
CREATE INDEX idx_tasks_space ON tasks(space_id, status);
CREATE INDEX idx_tasks_scheduled ON tasks(scheduled_date);
CREATE INDEX idx_tasks_due ON tasks(due_date);
CREATE INDEX idx_tasks_parent ON tasks(parent_id);
CREATE INDEX idx_tasks_completed ON tasks(completed_at);

CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  color TEXT NOT NULL DEFAULT '#8A857D',
  created_at TEXT NOT NULL
);

CREATE TABLE task_tags (
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, tag_id)
);
CREATE INDEX idx_task_tags_tag ON task_tags(tag_id);

CREATE TABLE memos (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  tags_json TEXT NOT NULL DEFAULT '[]',
  pinned INTEGER NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT '#FAF9F5',
  converted_task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
);
CREATE INDEX idx_memos_created ON memos(created_at);

CREATE TABLE focus_sessions (
  id TEXT PRIMARY KEY,
  task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  mode TEXT NOT NULL DEFAULT 'focus' CHECK(mode IN ('focus','break')),
  planned_minutes INTEGER NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  actual_seconds INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'running'
    CHECK(status IN ('running','completed','cancelled')),
  note TEXT NOT NULL DEFAULT ''
);
CREATE INDEX idx_focus_started ON focus_sessions(started_at);
CREATE INDEX idx_focus_task ON focus_sessions(task_id);
CREATE UNIQUE INDEX idx_focus_single_running ON focus_sessions(status) WHERE status = 'running';

CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  parent_id TEXT REFERENCES documents(id) ON DELETE CASCADE,
  space_id TEXT REFERENCES spaces(id) ON DELETE SET NULL,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT '未命名文档',
  icon TEXT NOT NULL DEFAULT 'file-text',
  excerpt TEXT NOT NULL DEFAULT '',
  sort_order REAL NOT NULL DEFAULT 0,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_documents_parent ON documents(parent_id, sort_order);
CREATE INDEX idx_documents_space ON documents(space_id);
CREATE INDEX idx_documents_project ON documents(project_id);
CREATE INDEX idx_documents_task ON documents(task_id);

CREATE TABLE document_bodies (
  document_id TEXT PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
  content_json TEXT NOT NULL,
  text TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);

CREATE TABLE document_links (
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK(target_type IN ('document','task','project')),
  target_id TEXT NOT NULL,
  PRIMARY KEY (document_id, target_type, target_id)
);
CREATE INDEX idx_document_links_target ON document_links(target_type, target_id);

CREATE TABLE capacity_days (
  date TEXT PRIMARY KEY,
  capacity_minutes INTEGER NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);

CREATE TABLE routines (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  time TEXT,
  weekdays_json TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE deliverables (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','done')),
  due_date TEXT,
  note TEXT NOT NULL DEFAULT '',
  sort_order REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_deliverables_project ON deliverables(project_id, sort_order);

CREATE TABLE templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  space_id TEXT REFERENCES spaces(id) ON DELETE SET NULL,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  items_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE blobs (
  id TEXT PRIMARY KEY,
  sha256 TEXT NOT NULL UNIQUE,
  mime TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  data BLOB NOT NULL,
  thumb_data BLOB,
  ref_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE attachments (
  id TEXT PRIMARY KEY,
  owner_type TEXT NOT NULL CHECK(owner_type IN ('task','document','memo')),
  owner_id TEXT NOT NULL,
  blob_id TEXT NOT NULL REFERENCES blobs(id),
  filename TEXT NOT NULL,
  sort_order REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_attachments_owner ON attachments(owner_type, owner_id, sort_order);
CREATE INDEX idx_attachments_blob ON attachments(blob_id);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE op_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  op_id TEXT NOT NULL UNIQUE,
  ts TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT 'user',
  source TEXT NOT NULL DEFAULT 'gui',
  command TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  payload_json TEXT NOT NULL DEFAULT '{}',
  after_json TEXT,
  schema_version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_op_log_ts ON op_log(ts);
CREATE INDEX idx_op_log_aggregate ON op_log(aggregate_type, aggregate_id);
CREATE INDEX idx_op_log_command ON op_log(command);

CREATE TABLE ai_providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  model TEXT NOT NULL,
  api_key_encrypted TEXT,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE ai_conversations (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '新对话',
  context_kind TEXT NOT NULL DEFAULT 'global',
  context_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE ai_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  tool_name TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_ai_messages_conversation ON ai_messages(conversation_id, created_at);
`


export const MIGRATION_2 = `
UPDATE tasks SET completed_at = updated_at
WHERE status = 'done' AND completed_at IS NULL;
`


export const MIGRATION_3 = `
ALTER TABLE op_log ADD COLUMN before_json TEXT;
`
