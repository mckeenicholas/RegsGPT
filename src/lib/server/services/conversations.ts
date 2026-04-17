import { query, action, redirect } from "@solidjs/router";
import { getRequestEvent } from "solid-js/web";
import { authenticateRequest } from "~/lib/server/services/auth";
import { connectDB } from "~/lib/server/db/connection";
import { Conversation } from "~/lib/server/db/models/Conversation";
import { Message } from "~/lib/server/db/models/Message";

export const getConversationsQuery = query(async () => {
  "use server";
  const event = getRequestEvent();
  if (!event) throw new Error("No request event");

  const user = await authenticateRequest(event.request);
  if (!user) {
    throw redirect("/");
  }

  await connectDB();
  const conversations = await Conversation.find({ userId: user._id })
    .sort({ updatedAt: -1 })
    .select("title createdAt updatedAt")
    .lean();

  return conversations.map((c: any) => ({
    id: c._id.toString(),
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

  await connectDB();
  const conversation = await Conversation.findOne({
    _id: id,
    userId: user._id,
  }).lean();
  if (!conversation) {
    throw redirect("/c");
  }

  const messages = await Message.find({ conversationId: id })
    .sort({ createdAt: 1 })
    .lean();

  return {
    conversation: {
      id: conversation._id.toString(),
      title: conversation.title,
    },
    messages: messages.map((m: any) => ({
      id: m._id.toString(),
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

  await connectDB();
  const conversation = await Conversation.create({
    userId: user._id,
    title: "New Chat",
  });

  throw redirect(`/c/${conversation._id.toString()}`);
}, "createConversation");

export async function createConversationRPC() {
  "use server";
  const event = getRequestEvent();
  if (!event) throw new Error("No request event");

  const user = await authenticateRequest(event.request);
  if (!user) {
    throw new Error("Unauthenticated");
  }

  await connectDB();
  const conversation = await Conversation.create({
    userId: user._id,
    title: "New Chat",
  });

  return { id: conversation._id.toString() };
}

export const deleteConversationAction = action(async (id: string) => {
  "use server";
  const event = getRequestEvent();
  if (!event) throw new Error("No request event");

  const user = await authenticateRequest(event.request);
  if (!user) {
    throw redirect("/");
  }

  await connectDB();
  const conversation = await Conversation.findOne({
    _id: id,
    userId: user._id,
  });
  if (!conversation) return { success: false, error: "Not found" };

  await Message.deleteMany({ conversationId: id });
  await Conversation.deleteOne({ _id: id });

  return { success: true };
}, "deleteConversation");
