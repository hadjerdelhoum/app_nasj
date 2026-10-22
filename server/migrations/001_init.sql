-- NASJ schema (portable SQL: types/constraints map 1:1 to PostgreSQL if you migrate later)

CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'parent' CHECK (role IN ('parent','admin')),
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Only the SHA-256 hash of the bearer token is stored.
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  expires_at TEXT NOT NULL
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

CREATE TABLE learning_paths (
  id          TEXT PRIMARY KEY,
  age_group   TEXT NOT NULL UNIQUE CHECK (age_group IN ('3-5','5-10')),
  title       TEXT NOT NULL,
  description TEXT NOT NULL
);

CREATE TABLE children (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  display_name     TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 24),
  age_group        TEXT NOT NULL CHECK (age_group IN ('3-5','5-10')),
  age              INTEGER CHECK (age IS NULL OR age BETWEEN 3 AND 10),
  avatar           TEXT NOT NULL DEFAULT 'nasj-default',
  learning_path_id TEXT NOT NULL REFERENCES learning_paths(id),
  preferences      TEXT NOT NULL DEFAULT '{}',
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_children_user ON children(user_id);

CREATE TABLE levels (
  id                  INTEGER PRIMARY KEY,
  code                TEXT NOT NULL UNIQUE,
  title               TEXT NOT NULL,
  subtitle            TEXT NOT NULL,
  description         TEXT NOT NULL,
  category            TEXT NOT NULL,
  level_order         INTEGER NOT NULL UNIQUE,
  difficulty          INTEGER NOT NULL CHECK (difficulty BETWEEN 1 AND 3),
  unlock_requires     INTEGER REFERENCES levels(id),
  required_activities INTEGER NOT NULL DEFAULT 1 CHECK (required_activities >= 1)
);

CREATE TABLE level_age_groups (
  level_id  INTEGER NOT NULL REFERENCES levels(id) ON DELETE CASCADE,
  age_group TEXT NOT NULL CHECK (age_group IN ('3-5','5-10')),
  PRIMARY KEY (level_id, age_group)
);

CREATE TABLE activities (
  id           TEXT PRIMARY KEY,
  level_id     INTEGER NOT NULL REFERENCES levels(id) ON DELETE CASCADE,
  age_group    TEXT NOT NULL CHECK (age_group IN ('3-5','5-10')),
  kind         TEXT NOT NULL CHECK (kind IN ('vocab','math','memory','paint','discover')),
  category     TEXT NOT NULL,
  title        TEXT NOT NULL,
  description  TEXT NOT NULL,
  instructions TEXT NOT NULL,
  difficulty   INTEGER NOT NULL CHECK (difficulty BETWEEN 1 AND 3),
  position     INTEGER NOT NULL DEFAULT 1,
  content      TEXT NOT NULL,   -- JSON, SERVER ONLY (question pools, correct answers, evaluation rules)
  UNIQUE (level_id, age_group, position)
);

-- One row per child and level. Progress is keyed by level only, so changing the age group never loses it.
CREATE TABLE child_level_progress (
  child_id             TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  level_id             INTEGER NOT NULL REFERENCES levels(id),
  unlocked             INTEGER NOT NULL DEFAULT 0 CHECK (unlocked IN (0,1)),
  status               TEXT NOT NULL DEFAULT 'locked' CHECK (status IN ('locked','available','in_progress','completed')),
  best_stars           INTEGER NOT NULL DEFAULT 0 CHECK (best_stars BETWEEN 0 AND 3),
  completed_activities INTEGER NOT NULL DEFAULT 0,
  progress_pct         INTEGER NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
  last_activity_at     TEXT,
  completed_at         TEXT,
  PRIMARY KEY (child_id, level_id)
);

-- Activity history (one row per attempt). Correct answers live in `state` and never leave the server.
CREATE TABLE activity_attempts (
  id           TEXT PRIMARY KEY,
  child_id     TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  activity_id  TEXT NOT NULL REFERENCES activities(id),
  level_id     INTEGER NOT NULL REFERENCES levels(id),
  status       TEXT NOT NULL DEFAULT 'started' CHECK (status IN ('started','completed','abandoned')),
  state        TEXT NOT NULL,
  mistakes     INTEGER NOT NULL DEFAULT 0,
  stars        INTEGER NOT NULL DEFAULT 0 CHECK (stars BETWEEN 0 AND 3),
  score        INTEGER NOT NULL DEFAULT 0,
  result       TEXT,
  started_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  completed_at TEXT,
  time_spent_s INTEGER
);
CREATE INDEX idx_attempts_child ON activity_attempts(child_id, started_at);

-- Star ledger: the total of a child is SUM(amount). UNIQUE keys make every award idempotent.
CREATE TABLE star_ledger (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  child_id   TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  amount     INTEGER NOT NULL CHECK (amount > 0),
  reason     TEXT NOT NULL CHECK (reason IN ('level_best','daily_bonus')),
  level_id   INTEGER REFERENCES levels(id),
  attempt_id TEXT REFERENCES activity_attempts(id) ON DELETE SET NULL,
  day        TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX uq_ledger_attempt ON star_ledger(attempt_id, reason) WHERE attempt_id IS NOT NULL;
CREATE UNIQUE INDEX uq_ledger_daily ON star_ledger(child_id, day) WHERE reason = 'daily_bonus';

CREATE TABLE rewards (
  id          TEXT PRIMARY KEY,
  child_id    TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  type        TEXT NOT NULL DEFAULT 'badge',
  code        TEXT NOT NULL,
  name        TEXT NOT NULL,
  description TEXT NOT NULL,
  level_id    INTEGER REFERENCES levels(id),
  activity_id TEXT REFERENCES activities(id),
  achieved_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (child_id, code)
);

-- "Le Métier à Tisser Magique": adventures generated by the AI (or the safe fallback).
CREATE TABLE ai_adventures (
  id           TEXT PRIMARY KEY,
  child_id     TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  language     TEXT NOT NULL CHECK (language IN ('fr','ar')),
  topic        TEXT,
  source       TEXT NOT NULL CHECK (source IN ('ai','fallback')),
  title        TEXT NOT NULL,
  story        TEXT NOT NULL,
  challenges   TEXT NOT NULL,   -- JSON incl. correct answers: SERVER ONLY
  status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','completed')),
  score        INTEGER,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  completed_at TEXT
);
CREATE INDEX idx_adventures_child ON ai_adventures(child_id, created_at);
