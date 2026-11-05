import { getDB } from "../connection";
import { mapUserRow, type User } from "./User";

export interface SessionRecord {
  id: number;
  token: string;
  userId: number;
  wcaToken: string;
  wcaRefreshToken: string;
  wcaTokenExpiresAt: Date;
  expiresAt: Date;
  createdAt: Date;
}

interface SessionRow {
  id: number;
  token: string;
  user_id: number;
  wca_token: string;
  wca_refresh_token: string;
  wca_token_expires_at: number;
  expires_at: number;
  created_at: number;
}

interface SessionUserJoinRow {
  s_id: number;
  s_token: string;
  s_user_id: number;
  s_wca_token: string;
  s_wca_refresh_token: string;
  s_wca_token_expires_at: number;
  s_expires_at: number;
  s_created_at: number;
  u_wca_user_id: number;
  u_wca_id: string | null;
  u_name: string;
  u_requests_used_today: number;
  u_last_request_date: string;
  u_created_at: number;
  u_updated_at: number;
}

export interface SessionWithUser {
  session: SessionRecord;
  user: User;
}

function mapSession(row: SessionRow): SessionRecord {
  return {
    id: row.id,
    token: row.token,
    userId: row.user_id,
    wcaToken: row.wca_token,
    wcaRefreshToken: row.wca_refresh_token,
    wcaTokenExpiresAt: new Date(row.wca_token_expires_at),
    expiresAt: new Date(row.expires_at),
    createdAt: new Date(row.created_at),
  };
}

export function createSession(input: {
  token: string;
  userId: number;
  wcaToken: string;
  wcaRefreshToken: string;
  wcaTokenExpiresAt: Date;
  expiresAt: Date;
}): SessionRecord {
  const db = getDB();
  const createdAt = Date.now();

  const result = db
    .prepare(
      `INSERT INTO sessions (
         token, user_id, wca_token, wca_refresh_token,
         wca_token_expires_at, expires_at, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.token,
      input.userId,
      input.wcaToken,
      input.wcaRefreshToken,
      input.wcaTokenExpiresAt.getTime(),
      input.expiresAt.getTime(),
      createdAt,
    );

  const session = getSessionByToken(input.token);
  if (!session) {
    throw new Error(`Failed to load session ${String(result.lastInsertRowid)} after insert`);
  }
  return session;
}

export function getSessionByToken(token: string): SessionRecord | null {
  const db = getDB();
  const row = db.prepare("SELECT * FROM sessions WHERE token = ?").get(token) as
    | SessionRow
    | undefined;
  return row ? mapSession(row) : null;
}

/**
 * Loads a non-expired session together with its user (replaces Mongo populate).
 */
export function findSessionWithUser(token: string): SessionWithUser | null {
  const db = getDB();
  const row = db
    .prepare(
      `SELECT
         s.id                   AS s_id,
         s.token                AS s_token,
         s.user_id              AS s_user_id,
         s.wca_token            AS s_wca_token,
         s.wca_refresh_token    AS s_wca_refresh_token,
         s.wca_token_expires_at AS s_wca_token_expires_at,
         s.expires_at           AS s_expires_at,
         s.created_at           AS s_created_at,
         u.wca_user_id          AS u_wca_user_id,
         u.wca_id               AS u_wca_id,
         u.name                 AS u_name,
         u.requests_used_today  AS u_requests_used_today,
         u.last_request_date    AS u_last_request_date,
         u.created_at           AS u_created_at,
         u.updated_at           AS u_updated_at
       FROM sessions s
       JOIN users u ON u.wca_user_id = s.user_id
       WHERE s.token = ? AND s.expires_at > ?`,
    )
    .get(token, Date.now()) as SessionUserJoinRow | undefined;

  if (!row) {
    return null;
  }

  const session = mapSession({
    id: row.s_id,
    token: row.s_token,
    user_id: row.s_user_id,
    wca_token: row.s_wca_token,
    wca_refresh_token: row.s_wca_refresh_token,
    wca_token_expires_at: row.s_wca_token_expires_at,
    expires_at: row.s_expires_at,
    created_at: row.s_created_at,
  });

  const user = mapUserRow({
    wca_user_id: row.u_wca_user_id,
    wca_id: row.u_wca_id,
    name: row.u_name,
    requests_used_today: row.u_requests_used_today,
    last_request_date: row.u_last_request_date,
    created_at: row.u_created_at,
    updated_at: row.u_updated_at,
  });

  return { session, user };
}

export function updateWCATokens(
  sessionId: number,
  tokens: {
    wcaToken: string;
    wcaRefreshToken: string;
    wcaTokenExpiresAt: Date;
  },
): void {
  const db = getDB();
  db.prepare(
    `UPDATE sessions
       SET wca_token = ?, wca_refresh_token = ?, wca_token_expires_at = ?
     WHERE id = ?`,
  ).run(tokens.wcaToken, tokens.wcaRefreshToken, tokens.wcaTokenExpiresAt.getTime(), sessionId);
}

export function deleteSession(token: string): void {
  const db = getDB();
  db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

export function deleteAllUserSessions(userId: number): void {
  const db = getDB();
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
}

export function deleteExpiredSessions(): void {
  const db = getDB();
  db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(Date.now());
}
