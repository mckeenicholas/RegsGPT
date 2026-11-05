import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { migrate } from "./schema";

interface DBCache {
  db: DatabaseSync | null;
}

const globalCache = globalThis as typeof globalThis & {
  regsgptDbCache?: DBCache;
};

globalCache.regsgptDbCache ??= { db: null };

function resolveDatabasePath(): string {
  const configured = process.env.DATABASE_PATH;
  if (configured) {
    return isAbsolute(configured) ? configured : resolve(process.cwd(), configured);
  }
  return resolve(process.cwd(), "data", "regsgpt.db");
}

/**
 * Returns the process-wide SQLite connection, opening it (and applying
 * migrations) on first use. The connection is cached on `globalThis` so that
 * dev-server hot reloads do not leak file handles.
 */
export function getDB(): DatabaseSync {
  const cached = globalCache.regsgptDbCache!;
  if (cached.db) {
    return cached.db;
  }

  const path = resolveDatabasePath();
  mkdirSync(dirname(path), { recursive: true });

  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA busy_timeout = 5000;");

  migrate(db);
  cached.db = db;

  console.log(`[SQLite] Connected: ${path}`);
  return db;
}

/**
 * Closes the cached connection. Used by standalone scripts so the process can
 * exit cleanly.
 */
export function closeDB(): void {
  const cached = globalCache.regsgptDbCache!;
  if (!cached.db) {
    return;
  }
  cached.db.close();
  cached.db = null;
}
