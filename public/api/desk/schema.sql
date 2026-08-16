-- REG.RU / ISPmanager: Базы данных → создать. Имя короткое: desk
-- Получится uXXXXXXX_desk (префикс логина хостинга, лимит 16 символов).
-- Хост: localhost. Реквизиты вписать в config.php. Таблицы создадутся сами.

CREATE TABLE IF NOT EXISTS desk_tasks (
  id CHAR(36) NOT NULL PRIMARY KEY,
  slug VARCHAR(190) NOT NULL,
  title VARCHAR(500) NOT NULL,
  area VARCHAR(32) NOT NULL DEFAULT '',
  client VARCHAR(190) NOT NULL DEFAULT '',
  status VARCHAR(32) NOT NULL DEFAULT 'todo',
  due_date DATE NULL,
  due_start DATETIME NULL,
  due_end DATETIME NULL,
  all_day TINYINT(1) NOT NULL DEFAULT 1,
  notes TEXT,
  source_file VARCHAR(255) NOT NULL DEFAULT '',
  wait_contact VARCHAR(190) NOT NULL DEFAULT '',
  wait_until VARCHAR(32) NOT NULL DEFAULT '',
  remind_at VARCHAR(32) NOT NULL DEFAULT '',
  remind_sent TINYINT(1) NOT NULL DEFAULT 0,
  project_id VARCHAR(36) NOT NULL DEFAULT '',
  client_id VARCHAR(64) NOT NULL DEFAULT '',
  blocked_by VARCHAR(36) NOT NULL DEFAULT '',
  parent_task_id VARCHAR(36) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY uq_slug (slug),
  KEY idx_due (due_start),
  KEY idx_status (status),
  KEY idx_parent (parent_task_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS desk_task_directions (
  task_id      VARCHAR(36) NOT NULL,
  direction_id VARCHAR(64) NOT NULL,
  created_at   DATETIME NOT NULL,
  PRIMARY KEY (task_id, direction_id),
  KEY idx_direction (direction_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS desk_task_links (
  id         CHAR(36) NOT NULL PRIMARY KEY,
  from_task  VARCHAR(36) NOT NULL,
  to_task    VARCHAR(36) NOT NULL,
  type       ENUM('blocks','spawned_from','next','related') NOT NULL,
  created_at DATETIME NOT NULL,
  UNIQUE KEY uq_edge (from_task, to_task, type),
  KEY idx_from (from_task, type),
  KEY idx_to   (to_task, type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS desk_checklists (
  id         CHAR(36) NOT NULL PRIMARY KEY,
  task_id    VARCHAR(36) NOT NULL,
  title      VARCHAR(500) NOT NULL DEFAULT 'Список',
  position   INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  KEY idx_task (task_id, position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS desk_checklist_items (
  id           CHAR(36) NOT NULL PRIMARY KEY,
  checklist_id CHAR(36) NOT NULL,
  text         TEXT NOT NULL,
  done         TINYINT(1) NOT NULL DEFAULT 0,
  position     INT NOT NULL DEFAULT 0,
  created_at   DATETIME NOT NULL,
  KEY idx_list (checklist_id, position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS desk_events (
  id CHAR(36) NOT NULL PRIMARY KEY,
  uid VARCHAR(190) NOT NULL,
  title VARCHAR(500) NOT NULL,
  calendar_name VARCHAR(64) NOT NULL DEFAULT '',
  start_at DATETIME NULL,
  end_at DATETIME NULL,
  all_day TINYINT(1) NOT NULL DEFAULT 0,
  description TEXT,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY uq_uid (uid),
  KEY idx_start (start_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS desk_comments (
  id CHAR(36) NOT NULL PRIMARY KEY,
  task_id VARCHAR(36) NOT NULL,
  body TEXT NOT NULL,
  created_at DATETIME NOT NULL,
  KEY idx_task (task_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS desk_projects (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'idea',
  area VARCHAR(32) NOT NULL DEFAULT '',
  notes TEXT,
  due_date VARCHAR(32) NOT NULL DEFAULT '',
  client_id VARCHAR(64) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  KEY idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS desk_goals (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  horizon VARCHAR(64) NOT NULL DEFAULT '',
  progress INT NOT NULL DEFAULT 0,
  krs LONGTEXT,
  notes TEXT,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS desk_habits (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  checks LONGTEXT,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS desk_clients (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  title VARCHAR(190) NOT NULL,
  source VARCHAR(32) NOT NULL DEFAULT 'desk',
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  KEY idx_title (title)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS desk_works (
  id CHAR(36) NOT NULL PRIMARY KEY,
  task_id VARCHAR(36) NOT NULL,
  work_date DATE NOT NULL,
  hours DECIMAL(8,2) NOT NULL DEFAULT 0,
  note TEXT,
  created_at DATETIME NOT NULL,
  KEY idx_task (task_id),
  KEY idx_date (work_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS desk_wake (
  id CHAR(36) NOT NULL PRIMARY KEY,
  kind VARCHAR(32) NOT NULL DEFAULT 'tg',
  payload MEDIUMTEXT,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL,
  acked_at DATETIME NULL,
  KEY idx_status_created (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
