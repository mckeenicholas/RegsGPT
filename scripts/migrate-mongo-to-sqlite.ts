/**
 * One-time migration from the old MongoDB database to the new SQLite database.
 *
 * Migrates: users, conversations, messages.
 * Skips:    sessions and incidents.
 *
 * The script is intended to be run OUTSIDE the Docker container while it is
 * still running. It only reads from MongoDB and writes to a separate local
 * SQLite file, so it does not touch the container's database.
 *
 * Usage:
 *   MONGODB_URI="mongodb://localhost:27017/regsgpt" \
 *     bun run scripts/migrate-mongo-to-sqlite.ts --out ./data/regsgpt-migrated.db
 *
 * Options:
 *   --uri <mongodb-uri>   MongoDB connection string (default: $MONGODB_URI)
 *   --out <path>          Output SQLite file (default: ./data/regsgpt-migrated.db)
 *   --force               Clear existing users/conversations/messages in the
 *                         target file before migrating (incidents are kept)
 *   --help                Show this help
 *
 * Notes:
 *   - Old Mongo ObjectIds are preserved as conversation `public_id`s, so old
 *     /c/<id> links continue to work after the migration.
 *   - The target file is created from scratch if it does not exist.
 *   - Sessions are intentionally not migrated; users will log in again.
 */

import "dotenv/config";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { MongoClient, ObjectId, type Document } from "mongodb";
import { migrate } from "../src/lib/server/db/schema";

interface LegacyUser extends Document {
  wcaUserID?: number;
  wcaID?: string | null;
  name?: string;
  requestsUsedToday?: number;
  lastRequestDate?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface LegacyConversation extends Document {
  userId?: unknown;
  title?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface LegacyMessage extends Document {
  conversationId?: unknown;
  role?: string;
  content?: string;
  tokensUsed?: number;
  createdAt?: Date;
}

interface Options {
  uri: string | null;
  out: string;
  force: boolean;
  help: boolean;
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    uri: process.env.MONGODB_URI ?? null,
    out: resolve(process.cwd(), "data", "regsgpt-migrated.db"),
    force: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }

    if (arg === "--force") {
      options.force = true;
      continue;
    }

    if (arg === "--uri") {
      const value = argv[++i];
      if (!value) throw new Error("--uri requires a value");
      options.uri = value;
      continue;
    }

    if (arg === "--out") {
      const value = argv[++i];
      if (!value) throw new Error("--out requires a value");
      options.out = isAbsolute(value) ? value : resolve(process.cwd(), value);
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function printHelp(): void {
  console.log(`Migrate users, conversations and messages from MongoDB to SQLite.

Usage:
  MONGODB_URI="mongodb://localhost:27017/regsgpt" \\
    bun run scripts/migrate-mongo-to-sqlite.ts --out ./data/regsgpt-migrated.db

Options:
  --uri <mongodb-uri>   MongoDB connection string (default: $MONGODB_URI)
  --out <path>          Output SQLite file (default: ./data/regsgpt-migrated.db)
  --force               Clear existing users/conversations/messages first
  --help, -h            Show this help

Sessions and incidents are not migrated.
`);
}

function idString(value: unknown): string | null {
  if (value instanceof ObjectId) return value.toHexString();
  if (typeof value === "string") return value;
  if (value == null) return null;
  return String(value);
}

/**
 * Converts a Mongo date-like value to epoch milliseconds. Falls back to the
 * ObjectId timestamp (for documents missing timestamps), then to 0.
 */
function toEpochMs(value: unknown, fallbackId?: unknown): number {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.getTime();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
  }

  if (fallbackId instanceof ObjectId) {
    return fallbackId.getTimestamp().getTime();
  }

  return 0;
}

function toInt(value: unknown, fallback = 0): number {
  if (value == null || value === "") return fallback;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function toText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value == null) return "";
  return String(value);
}

function countRows(db: DatabaseSync, table: string): number {
  const row = db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number };
  return row.count;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  if (!options.uri) {
    throw new Error("MONGODB_URI is not set. Pass --uri <mongodb-uri> or set MONGODB_URI.");
  }

  console.log("[Mongo] Connecting...");
  const client = new MongoClient(options.uri, { serverSelectionTimeoutMS: 10_000 });

  let db: DatabaseSync | null = null;

  try {
    await client.connect();
    const mongoDb = client.db();
    console.log(`[Mongo] Connected to database "${mongoDb.databaseName}"`);

    // Read everything before touching the output file, so a connection or
    // read error cannot leave behind a partially created SQLite database.
    console.log("[Mongo] Reading users...");
    const users = await mongoDb.collection<LegacyUser>("users").find({}).toArray();

    console.log("[Mongo] Reading conversations...");
    const conversations = await mongoDb
      .collection<LegacyConversation>("conversations")
      .find({})
      .sort({ _id: 1 })
      .toArray();

    console.log("[Mongo] Reading messages...");
    const messages = await mongoDb
      .collection<LegacyMessage>("messages")
      .find({})
      .sort({ createdAt: 1, _id: 1 })
      .toArray();

    console.log(
      `[Mongo] Found ${users.length} users, ${conversations.length} conversations, ${messages.length} messages`,
    );

    mkdirSync(dirname(options.out), { recursive: true });
    const existed = existsSync(options.out);
    db = new DatabaseSync(options.out);
    db.exec("PRAGMA journal_mode = DELETE;");
    db.exec("PRAGMA foreign_keys = ON;");
    db.exec("PRAGMA busy_timeout = 5000;");
    migrate(db);

    const existing = {
      users: countRows(db, "users"),
      conversations: countRows(db, "conversations"),
      messages: countRows(db, "messages"),
    };
    const hasExistingData =
      existing.users > 0 || existing.conversations > 0 || existing.messages > 0;

    if (hasExistingData && !options.force) {
      throw new Error(
        `Target "${options.out}" already contains data ` +
          `(${existing.users} users, ${existing.conversations} conversations, ` +
          `${existing.messages} messages). Use --out to choose a new file or ` +
          `--force to clear these tables first.`,
      );
    }

    if (hasExistingData) {
      console.log("[SQLite] --force set; clearing users, conversations and messages...");
      db.exec("BEGIN");
      try {
        db.exec("DELETE FROM messages");
        db.exec("DELETE FROM conversations");
        // Deleting users also cascades to sessions (which are not migrated).
        db.exec("DELETE FROM users");
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    }

    // ObjectId -> wca_user_id, and ObjectId -> new conversations.id mapping.
    const userIdByObjectId = new Map<string, number>();
    const conversationIdByObjectId = new Map<string, number>();

    let skippedUsers = 0;
    let skippedConversations = 0;
    let skippedMessages = 0;

    db.exec("BEGIN");
    try {
      // --- Users ---
      const insertUser = db.prepare(
        `INSERT INTO users (
           wca_user_id, wca_id, name, requests_used_today, last_request_date,
           created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(wca_user_id) DO UPDATE SET
           wca_id = excluded.wca_id,
           name = excluded.name,
           requests_used_today = excluded.requests_used_today,
           last_request_date = excluded.last_request_date,
           created_at = excluded.created_at,
           updated_at = excluded.updated_at`,
      );

      for (const doc of users) {
        const wcaUserId = toInt(doc.wcaUserID, Number.NaN);

        if (!Number.isInteger(wcaUserId)) {
          skippedUsers++;
          console.warn(`[Users] Skipping ${idString(doc._id) ?? "unknown"}: missing wcaUserID`);
          continue;
        }

        const objectId = idString(doc._id);
        if (!objectId) {
          skippedUsers++;
          console.warn(`[Users] Skipping user ${wcaUserId}: missing _id`);
          continue;
        }

        const wcaId = toText(doc.wcaID).trim() || null;
        const name = toText(doc.name).trim() || `WCA User ${wcaUserId}`;
        const createdAt = toEpochMs(doc.createdAt, doc._id);
        const updatedAt = doc.updatedAt != null ? toEpochMs(doc.updatedAt, doc._id) : createdAt;

        insertUser.run(
          wcaUserId,
          wcaId,
          name,
          Math.max(0, toInt(doc.requestsUsedToday, 0)),
          toText(doc.lastRequestDate),
          createdAt,
          updatedAt,
        );

        userIdByObjectId.set(objectId, wcaUserId);
      }

      // --- Conversations ---
      const insertConversation = db.prepare(
        `INSERT INTO conversations (public_id, user_id, title, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(public_id) DO UPDATE SET
           user_id = excluded.user_id,
           title = excluded.title,
           created_at = excluded.created_at,
           updated_at = excluded.updated_at`,
      );
      const selectConversation = db.prepare("SELECT id FROM conversations WHERE public_id = ?");

      for (const doc of conversations) {
        const oldId = idString(doc._id);
        const oldUserId = idString(doc.userId);
        const userId = oldUserId ? userIdByObjectId.get(oldUserId) : undefined;

        if (!oldId) {
          skippedConversations++;
          console.warn("[Conversations] Skipping document without _id");
          continue;
        }

        if (userId == null) {
          skippedConversations++;
          console.warn(
            `[Conversations] Skipping ${oldId}: owner user ${oldUserId ?? "unknown"} was not migrated`,
          );
          continue;
        }

        const createdAt = toEpochMs(doc.createdAt, doc._id);
        const updatedAt = doc.updatedAt != null ? toEpochMs(doc.updatedAt, doc._id) : createdAt;

        insertConversation.run(
          oldId,
          userId,
          toText(doc.title).trim() || "New Chat",
          createdAt,
          updatedAt,
        );

        const row = selectConversation.get(oldId) as { id: number } | undefined;
        if (!row) {
          throw new Error(`Failed to read back migrated conversation ${oldId}`);
        }
        conversationIdByObjectId.set(oldId, row.id);
      }

      // --- Messages ---
      const insertMessage = db.prepare(
        `INSERT INTO messages (conversation_id, role, content, tokens_used, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      );

      for (const doc of messages) {
        const oldConversationId = idString(doc.conversationId);
        const conversationId = oldConversationId
          ? conversationIdByObjectId.get(oldConversationId)
          : undefined;

        if (conversationId == null) {
          skippedMessages++;
          console.warn(
            `[Messages] Skipping ${idString(doc._id) ?? "unknown"}: conversation ` +
              `${oldConversationId ?? "unknown"} was not migrated`,
          );
          continue;
        }

        const role = doc.role;
        if (role !== "user" && role !== "assistant") {
          skippedMessages++;
          console.warn(
            `[Messages] Skipping ${idString(doc._id) ?? "unknown"}: invalid role ${String(role)}`,
          );
          continue;
        }

        insertMessage.run(
          conversationId,
          role,
          toText(doc.content),
          Math.max(0, toInt(doc.tokensUsed, 0)),
          toEpochMs(doc.createdAt, doc._id),
        );
      }

      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }

    const migrated = {
      users: countRows(db, "users"),
      conversations: countRows(db, "conversations"),
      messages: countRows(db, "messages"),
    };

    console.log("");
    console.log("[Done] Migration complete");
    console.log(`  Output:        ${options.out}${existed ? " (existing file)" : ""}`);
    console.log(`  Users:         ${migrated.users} migrated (${skippedUsers} skipped)`);
    console.log(
      `  Conversations: ${migrated.conversations} migrated (${skippedConversations} skipped)`,
    );
    console.log(`  Messages:      ${migrated.messages} migrated (${skippedMessages} skipped)`);
    console.log("  Sessions:      skipped");
    console.log("  Incidents:     skipped");
  } finally {
    if (db) {
      db.close();
    }
    await client.close().catch(() => {});
  }
}

try {
  await main();
} catch (error) {
  console.error("[Fatal]", error instanceof Error ? error.message : error);
  process.exit(1);
}
