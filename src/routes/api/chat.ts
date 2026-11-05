import type { APIEvent } from "@solidjs/start/server";
import { getForUser, setTitle, touch } from "~/lib/server/db/models/Conversation";
import { createMessage, listByConversation } from "~/lib/server/db/models/Message";
import { recordRequest } from "~/lib/server/db/models/User";
import { authenticateRequest } from "~/lib/server/services/auth";
import { streamChat, isOverRequestCap, type ChatMessage } from "~/lib/server/services/gemini";

/**
 * POST /api/chat — streaming chat endpoint (SSE)
 *
 * Body: { conversationId: string, message: string }
 *
 * Returns text/event-stream with:
 *   data: {"type":"chunk","text":"..."}\n\n
 *   data: {"type":"done","tokensUsed":N}\n\n
 *   data: {"type":"error","message":"..."}\n\n
 */
export async function POST(event: APIEvent) {
  const encoder = new TextEncoder();

  try {
    const user = await authenticateRequest(event.request);
    if (!user) {
      return new Response(
        `data: ${JSON.stringify({ type: "error", message: "Not authenticated" })}\n\n`,
        {
          status: 401,
          headers: { "Content-Type": "text/event-stream" },
        },
      );
    }

    // Check request cap
    const [today] = new Date().toISOString().split("T");
    const requestsUsed = user.lastRequestDate === today ? user.requestsUsedToday : 0;
    const requestCap = Number(process.env.REQUEST_CAP) || 50;

    if (isOverRequestCap(requestsUsed, requestCap)) {
      return new Response(
        `data: ${JSON.stringify({ type: "error", message: `Daily request limit reached (${requestCap} requests per day).` })}\n\n`,
        {
          status: 429,
          headers: { "Content-Type": "text/event-stream" },
        },
      );
    }

    const body = await event.request.json();
    const { conversationId, message } = body;

    if (
      typeof conversationId !== "string" ||
      conversationId.length === 0 ||
      conversationId.length > 64 ||
      !message?.trim()
    ) {
      return new Response(
        `data: ${JSON.stringify({ type: "error", message: "Missing conversationId or message" })}\n\n`,
        {
          status: 400,
          headers: { "Content-Type": "text/event-stream" },
        },
      );
    }

    // Verify conversation ownership
    const conversation = getForUser(conversationId, user.id);

    if (!conversation) {
      return new Response(
        `data: ${JSON.stringify({ type: "error", message: "Conversation not found" })}\n\n`,
        {
          status: 404,
          headers: { "Content-Type": "text/event-stream" },
        },
      );
    }

    // Load the existing history first. If the last message is the same user
    // message (e.g. a retry after a failed stream), reuse it instead of saving
    // a duplicate.
    const existingMessages = listByConversation(conversation.internalId);
    const lastMessage = existingMessages.at(-1);

    const userMessage =
      lastMessage?.role === "user" && lastMessage.content === message.trim()
        ? lastMessage
        : createMessage({
            conversationId: conversation.internalId,
            role: "user",
            content: message.trim(),
            tokensUsed: 0,
          });

    // Exclude the current user message from the history sent to the model.
    const previousMessages = existingMessages.filter((m) => m.id !== userMessage.id);

    const history: ChatMessage[] = previousMessages
      .slice(-20) // keep last 20 messages for context window
      .map((m) => ({
        role: m.role === "user" ? ("user" as const) : ("model" as const),
        text: m.content,
      }));

    // Start streaming from Gemini
    const { stream, getUsage } = await streamChat(history, message.trim());

    let fullResponse = "";

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            fullResponse += chunk;
            const data = JSON.stringify({ type: "chunk", text: chunk });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          }

          // Get token usage
          const usage = await getUsage();

          // Save the assistant response
          createMessage({
            conversationId: conversation.internalId,
            role: "assistant",
            content: fullResponse,
            tokensUsed: usage.totalTokens,
          });

          // Update user request count
          recordRequest(user.id, today);

          // Auto-generate conversation title from first user message
          if (conversation.title === "New Chat") {
            const title =
              message.trim().length > 50 ? `${message.trim().slice(0, 50)}...` : message.trim();
            setTitle(conversation.internalId, title);
          } else {
            touch(conversation.internalId);
          }

          // Send done event
          const doneData = JSON.stringify({
            type: "done",
            tokensUsed: usage.totalTokens,
          });
          controller.enqueue(encoder.encode(`data: ${doneData}\n\n`));
          controller.close();
        } catch (error: any) {
          console.error("[Chat Stream] Error:", error);
          const errorData = JSON.stringify({
            type: "error",
            message: "An error occurred while generating the response.",
          });
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("[Chat POST] Error:", error);
    return new Response(
      `data: ${JSON.stringify({ type: "error", message: "Internal server error" })}\n\n`,
      {
        status: 500,
        headers: { "Content-Type": "text/event-stream" },
      },
    );
  }
}
