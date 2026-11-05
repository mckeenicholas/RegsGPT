import { randomUUID } from "node:crypto";
import { getDB } from "../connection";

export interface Conversation {
  /** Opaque public id exposed to clients (UUID). */
  id: string;
  /** Internal auto-incrementing id, used only for message lookups. */
  internalId: number;
  userId: number;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ConversationRow {
  id: number;
  public_id: string;
  user_id: number;
  title: string;
  created_at: number;
  updated_at: number;
}

function mapConversation(row: ConversationRow): Conversation {
  return {
    id: row.public_id,
    internalId: row.id,
    userId: row.user_id,
    title: row.title,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function listByUser(userId: number): Conversation[] {
  const db = getDB();
  const rows = db
    .prepare(
      `SELECT * FROM conversations
       WHERE user_id = ?
       ORDER BY updated_at DESC, id DESC`,
    )
    .all(userId) as unknown as ConversationRow[];
  return rows.map(mapConversation);
}

export function getForUser(
  publicId: string,
  userId: number,
): Conversation | null {
  const db = getDB();
  const row = db
    .prepare("SELECT * FROM conversations WHERE public_id = ? AND user_id = ?")
    .get(publicId, userId) as ConversationRow | undefined;
  return row ? mapConversation(row) : null;
}

export function createConversation(
  userId: number,
  title = "New Chat",
): Conversation {
  const db = getDB();
  const now = Date.now();
  const publicId = randomUUID();

  db.prepare(
    `INSERT INTO conversations (public_id, user_id, title, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(publicId, userId, title, now, now);

  const conversation = getForUser(publicId, userId);
  if (!conversation) {
    throw new Error("Failed to load conversation after insert");
  }
  return conversation;
}

export function setTitle(conversationId: number, title: string): void {
  const db = getDB();
  db.prepare(
    "UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?",
  ).run(title, Date.now(), conversationId);
}

export function touch(conversationId: number): void {
  const db = getDB();
  db.prepare("UPDATE conversations SET updated_at = ? WHERE id = ?").run(
    Date.now(),
    conversationId,
  );
}

/**
 * Deletes a conversation owned by the user. Messages are removed by the
 * messages.conversation_id foreign key cascade.
 */
export function deleteConversation(publicId: string, userId: number): boolean {
  const db = getDB();
  const result = db
    .prepare("DELETE FROM conversations WHERE public_id = ? AND user_id = ?")
    .run(publicId, userId);
  return Number(result.changes) > 0;
}
