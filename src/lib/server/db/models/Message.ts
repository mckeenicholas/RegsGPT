import { getDB } from "../connection";

export type MessageRole = "user" | "assistant";

export interface Message {
  id: number;
  conversationId: number;
  role: MessageRole;
  content: string;
  tokensUsed: number;
  createdAt: Date;
}

interface MessageRow {
  id: number;
  conversation_id: number;
  role: MessageRole;
  content: string;
  tokens_used: number;
  created_at: number;
}

function mapMessage(row: MessageRow): Message {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    tokensUsed: row.tokens_used,
    createdAt: new Date(row.created_at),
  };
}

export function listByConversation(conversationId: number): Message[] {
  const db = getDB();
  const rows = db
    .prepare(
      `SELECT * FROM messages
       WHERE conversation_id = ?
       ORDER BY created_at ASC, id ASC`,
    )
    .all(conversationId) as unknown as MessageRow[];
  return rows.map(mapMessage);
}

export function createMessage(input: {
  conversationId: number;
  role: MessageRole;
  content: string;
  tokensUsed?: number;
}): Message {
  const db = getDB();
  const createdAt = Date.now();
  const result = db
    .prepare(
      `INSERT INTO messages (
         conversation_id, role, content, tokens_used, created_at
       ) VALUES (?, ?, ?, ?, ?)`,
    )
    .run(
      input.conversationId,
      input.role,
      input.content,
      input.tokensUsed ?? 0,
      createdAt,
    );

  const row = db
    .prepare("SELECT * FROM messages WHERE id = ?")
    .get(Number(result.lastInsertRowid)) as MessageRow | undefined;
  if (!row) {
    throw new Error("Failed to load message after insert");
  }
  return mapMessage(row);
}
