import type { DatabaseSync } from "node:sqlite";

const SCHEMA_VERSION = 1;

const SCHEMA_V1 = `
CREATE TABLE IF NOT EXISTS users (
  wca_user_id        INTEGER PRIMARY KEY,
  wca_id             TEXT,
  name               TEXT    NOT NULL,
  requests_used_today INTEGER NOT NULL DEFAULT 0,
  last_request_date  TEXT    NOT NULL DEFAULT '',
  created_at         INTEGER NOT NULL,
  updated_at         INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS users_wca_id_unique
  ON users(wca_id) WHERE wca_id IS NOT NULL AND wca_id <> '';

CREATE TABLE IF NOT EXISTS sessions (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  token                TEXT    NOT NULL UNIQUE,
  user_id              INTEGER NOT NULL REFERENCES users(wca_user_id) ON DELETE CASCADE,
  wca_token            TEXT    NOT NULL,
  wca_refresh_token    TEXT    NOT NULL,
  wca_token_expires_at INTEGER NOT NULL,
  expires_at           INTEGER NOT NULL,
  created_at           INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS conversations (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id  TEXT    NOT NULL,
  user_id    INTEGER NOT NULL REFERENCES users(wca_user_id) ON DELETE CASCADE,
  title      TEXT    NOT NULL DEFAULT 'New Chat',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS conversations_public_id_unique
  ON conversations(public_id);

CREATE INDEX IF NOT EXISTS conversations_user_updated_idx
  ON conversations(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role            TEXT    NOT NULL CHECK (role IN ('user', 'assistant')),
  content         TEXT    NOT NULL,
  tokens_used     INTEGER NOT NULL DEFAULT 0,
  created_at      INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS messages_conversation_idx
  ON messages(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS incidents (
  incident_id     INTEGER PRIMARY KEY,
  title           TEXT    NOT NULL,
  public_summary  TEXT    NOT NULL,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  resolved_at     INTEGER,
  url             TEXT    NOT NULL,
  tags            TEXT    NOT NULL DEFAULT '[]',
  competitions    TEXT    NOT NULL DEFAULT '[]'
);
`;

/**
 * Applies the schema. Safe to call on every connection.
 */
export function migrate(db: DatabaseSync): void {
  const row = db.prepare("PRAGMA user_version").get() as
    { user_version: number } | undefined;
  const currentVersion = Number(row?.user_version ?? 0);

  if (currentVersion >= SCHEMA_VERSION) return;

  db.exec("BEGIN");
  try {
    db.exec(SCHEMA_V1);
    db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
