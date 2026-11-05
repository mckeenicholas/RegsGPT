import { getDB } from "../connection";

export interface User {
  /** WCA's stable numeric user id, used as our primary key. */
  id: number;
  wcaUserID: number;
  wcaID: string;
  name: string;
  requestsUsedToday: number;
  lastRequestDate: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserRow {
  wca_user_id: number;
  wca_id: string | null;
  name: string;
  requests_used_today: number;
  last_request_date: string;
  created_at: number;
  updated_at: number;
}

export function mapUserRow(row: UserRow): User {
  return {
    id: row.wca_user_id,
    wcaUserID: row.wca_user_id,
    wcaID: row.wca_id ?? "",
    name: row.name,
    requestsUsedToday: row.requests_used_today,
    lastRequestDate: row.last_request_date,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function getUserById(wcaUserId: number): User | null {
  const db = getDB();
  const row = db
    .prepare("SELECT * FROM users WHERE wca_user_id = ?")
    .get(wcaUserId) as UserRow | undefined;
  return row ? mapUserRow(row) : null;
}

/**
 * Upserts a user from WCA OAuth data. Existing usage counters are preserved.
 */
export function findOrCreateUser(wcaData: {
  wcaUserID: number;
  wcaID: string;
  name: string;
}): User {
  const db = getDB();
  const now = Date.now();

  db.prepare(
    `INSERT INTO users (
       wca_user_id, wca_id, name, requests_used_today, last_request_date,
       created_at, updated_at
     ) VALUES (?, ?, ?, 0, '', ?, ?)
     ON CONFLICT(wca_user_id) DO UPDATE SET
       wca_id = excluded.wca_id,
       name = excluded.name,
       updated_at = excluded.updated_at`,
  ).run(wcaData.wcaUserID, wcaData.wcaID || null, wcaData.name, now, now);

  const user = getUserById(wcaData.wcaUserID);
  if (!user) {
    throw new Error(`Failed to load user ${wcaData.wcaUserID} after upsert`);
  }
  return user;
}

/**
 * Records one successful request, resetting the daily counter when the date
 * changes.
 */
export function recordRequest(wcaUserId: number, today: string): void {
  const db = getDB();
  db.prepare(
    `UPDATE users
       SET requests_used_today =
             CASE WHEN last_request_date = ? THEN requests_used_today + 1 ELSE 1 END,
           last_request_date = ?,
           updated_at = ?
     WHERE wca_user_id = ?`,
  ).run(today, today, Date.now(), wcaUserId);
}
