import { query, action, redirect } from "@solidjs/router";
import { getRequestEvent } from "solid-js/web";
import { authenticateRequest } from "~/lib/server/services/auth";
import {
  createConversation,
  deleteConversation,
  getForUser,
  listByUser,
} from "~/lib/server/db/models/Conversation";
import { listByConversation } from "~/lib/server/db/models/Message";

function isValidPublicId(id: string): boolean {
  return typeof id === "string" && id.length > 0 && id.length <= 64;
}

export const getConversationsQuery = query(async () => {
  "use server";
  const event = getRequestEvent();
  if (!event) throw new Error("No request event");

  const user = await authenticateRequest(event.request);
  if (!user) {
    throw redirect("/");
  }

  const conversations = listByUser(user.id);

  return conversations.map((c) => ({
    id: c.id,
    title: c.title,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }));
}, "conversations");

export const getMessagesQuery = query(async (id: string) => {
  "use server";
  const event = getRequestEvent();
  if (!event) throw new Error("No request event");

  const user = await authenticateRequest(event.request);
  if (!user) {
    throw redirect("/");
  }

  if (!isValidPublicId(id)) {
    throw redirect("/c");
  }

  const conversation = getForUser(id, user.id);
  if (!conversation) {
    throw redirect("/c");
  }

  const messages = listByConversation(conversation.internalId);

  return {
    conversation: {
      id: conversation.id,
      title: conversation.title,
    },
    messages: messages.map((m) => ({
      id: String(m.id),
      role: m.role,
      content: m.content,
      tokensUsed: m.tokensUsed,
      createdAt: m.createdAt.toISOString(),
    })),
  };
}, "messages");

export const createConversationAction = action(async () => {
  "use server";
  const event = getRequestEvent();
  if (!event) throw new Error("No request event");

  const user = await authenticateRequest(event.request);
  if (!user) {
    throw redirect("/");
  }

  const conversation = createConversation(user.id);

  throw redirect(`/c/${conversation.id}`);
}, "createConversation");

export async function createConversationRPC() {
  "use server";
  const event = getRequestEvent();
  if (!event) throw new Error("No request event");

  const user = await authenticateRequest(event.request);
  if (!user) {
    throw new Error("Unauthenticated");
  }

  const conversation = createConversation(user.id);

  return { id: conversation.id };
}

export const deleteConversationAction = action(async (id: string) => {
  "use server";
  const event = getRequestEvent();
  if (!event) throw new Error("No request event");

  const user = await authenticateRequest(event.request);
  if (!user) {
    throw redirect("/");
  }

  if (!isValidPublicId(id)) {
    return { success: false, error: "Not found" };
  }

  // Messages are removed by the foreign-key cascade.
  const deleted = deleteConversation(id, user.id);
  if (!deleted) return { success: false, error: "Not found" };

  return { success: true };
}, "deleteConversation");
