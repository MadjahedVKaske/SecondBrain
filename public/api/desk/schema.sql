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
  estimate_hours DECIMAL(8,2) NULL,
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
  archived TINYINT(1) NOT NULL DEFAULT 0,
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

-- Append-only ledger for the private add-only Desk ingress.  It makes retries
-- safe without exposing a public task-creation endpoint.
CREATE TABLE IF NOT EXISTS desk_ingress_requests (
  source VARCHAR(32) NOT NULL,
  request_key CHAR(64) NOT NULL,
  request_sha256 CHAR(64) NOT NULL,
  task_id CHAR(36) NOT NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (source, request_key),
  KEY idx_task (task_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Gamification is a separate progress layer.  It never replaces the Desk
-- task/habit state and all XP is recorded in the append-only event ledger.
CREATE TABLE IF NOT EXISTS game_profile (
  id VARCHAR(32) NOT NULL PRIMARY KEY,
  avatar_key VARCHAR(64) NOT NULL DEFAULT 'pixel-spark',
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS game_skills (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  title VARCHAR(190) NOT NULL,
  color VARCHAR(16) NOT NULL DEFAULT '',
  position INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS game_bindings (
  object_type ENUM('task','habit') NOT NULL,
  object_id VARCHAR(64) NOT NULL,
  skill_id VARCHAR(64) NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (object_type, object_id),
  KEY idx_game_bindings_skill (skill_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS game_events (
  id CHAR(36) NOT NULL PRIMARY KEY,
  event_key VARCHAR(190) NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  source_type VARCHAR(32) NOT NULL,
  source_id VARCHAR(64) NOT NULL,
  reward_date DATE NULL,
  xp INT NOT NULL,
  skill_id VARCHAR(64) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL,
  UNIQUE KEY uq_game_event_key (event_key),
  KEY idx_game_events_created (created_at),
  KEY idx_game_events_skill (skill_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- A voluntary, once-a-day check-in. A quiet day is a valid game state, not a missed obligation.
CREATE TABLE IF NOT EXISTS game_daily_pulses (
  pulse_date DATE NOT NULL PRIMARY KEY,
  energy TINYINT NULL,
  mood TINYINT NULL,
  note VARCHAR(600) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS game_daily_quests (
  quest_date DATE NOT NULL,
  task_id VARCHAR(36) NOT NULL,
  position INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (quest_date, task_id),
  KEY idx_game_daily_quests_task (task_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Rank is a voluntary estimate of emotional effort.  It lives beside, not in,
-- Desk objects so task and habit facts stay untouched.
CREATE TABLE IF NOT EXISTS game_rank_bindings (
  object_type ENUM('task','habit') NOT NULL,
  object_id VARCHAR(64) NOT NULL,
  rank_id VARCHAR(16) NOT NULL,
  -- Red quests are deliberately exceptional: their reward is chosen per task.
  xp_override INT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (object_type, object_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Exactly these five routines count towards the all-dailies bonus.  Other
-- habits may still earn their own XP, but cannot accidentally change 5/5.
CREATE TABLE IF NOT EXISTS game_daily_habits (
  habit_id VARCHAR(64) NOT NULL PRIMARY KEY,
  position INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Meditation records the chosen duration for a particular completion.  The
-- habit check remains the source of truth and this table only explains its XP.
CREATE TABLE IF NOT EXISTS game_habit_variants (
  habit_id VARCHAR(64) NOT NULL,
  completed_date DATE NOT NULL,
  variant_id VARCHAR(32) NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (habit_id, completed_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Some habits are made of several small, concrete actions. The parent habit
-- becomes true only when all steps for that day have been recorded.
CREATE TABLE IF NOT EXISTS game_habit_step_plans (
  habit_id       VARCHAR(64) NOT NULL PRIMARY KEY,
  steps_required INT NOT NULL,
  step_xp        INT NOT NULL DEFAULT 2,
  target_ml      INT NULL,
  start_date     DATE NOT NULL,
  end_date       DATE NOT NULL,
  label          VARCHAR(190) NOT NULL DEFAULT '',
  created_at     DATETIME NOT NULL,
  updated_at     DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS game_habit_step_checks (
  habit_id  VARCHAR(64) NOT NULL,
  check_date DATE NOT NULL,
  step_no   INT NOT NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (habit_id, check_date, step_no),
  KEY idx_habit_date (habit_id, check_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
