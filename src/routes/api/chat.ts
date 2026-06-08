import type { APIEvent } from "@solidjs/start/server";
import { connectDB } from "~/lib/server/db/connection";
import { Conversation } from "~/lib/server/db/models/Conversation";
import { Message } from "~/lib/server/db/models/Message";
import { User } from "~/lib/server/db/models/User";
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
    const today = new Date().toISOString().split("T")[0];
    const requestsUsed = user.lastRequestDate === today ? user.requestsUsedToday : 0;
    const requestCap = Number(process.env.REQUEST_CAP) || 50;

    if (isOverRequestCap(requestsUsed, requestCap)) {
      return new Response(
        `data: ${JSON.stringify({ type: "error", message: "Daily request limit reached (50 requests per day)." })}\n\n`,
        {
          status: 429,
          headers: { "Content-Type": "text/event-stream" },
        },
      );
    }

    const body = await event.request.json();
    const { conversationId, message, isRetry } = body;

    if (!conversationId || !message?.trim()) {
      return new Response(
        `data: ${JSON.stringify({ type: "error", message: "Missing conversationId or message" })}\n\n`,
        {
          status: 400,
          headers: { "Content-Type": "text/event-stream" },
        },
      );
    }

    await connectDB();

    // Verify conversation ownership
    const conversation = await Conversation.findOne({
      _id: conversationId,
      userId: user._id,
    });

    if (!conversation) {
      return new Response(
        `data: ${JSON.stringify({ type: "error", message: "Conversation not found" })}\n\n`,
        {
          status: 404,
          headers: { "Content-Type": "text/event-stream" },
        },
      );
    }

    // Save the user message immediately if not a retry
    if (!isRetry) {
      await Message.create({
        conversationId,
        role: "user",
        content: message.trim(),
        tokensUsed: 0,
      });
    }

    // Load conversation history
    const previousMessages = await Message.find({ conversationId }).sort({ createdAt: 1 }).lean();

    const history: ChatMessage[] = previousMessages
      .filter((m: any) => m.role !== "user" || m.content !== message.trim()) // exclude the just-added message
      .slice(-20) // keep last 20 messages for context window
      .map((m: any) => ({
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
          await Message.create({
            conversationId,
            role: "assistant",
            content: fullResponse,
            tokensUsed: usage.totalTokens,
          });

          // Update user request count
          if (user.lastRequestDate === today) {
            await User.updateOne({ _id: user._id }, { $inc: { requestsUsedToday: 1 } });
          } else {
            await User.updateOne(
              { _id: user._id },
              { $set: { requestsUsedToday: 1, lastRequestDate: today } },
            );
          }

          // Auto-generate conversation title from first user message
          if (conversation.title === "New Chat") {
            const title =
              message.trim().length > 50 ? message.trim().slice(0, 50) + "..." : message.trim();
            await Conversation.updateOne({ _id: conversationId }, { title });
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
