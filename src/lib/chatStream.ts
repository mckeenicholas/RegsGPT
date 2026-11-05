export interface StreamChatOptions {
  onChunk?: (fullText: string) => void;
}

export interface StreamChatResult {
  content: string;
  tokensUsed: number;
}

/**
 * Sends a chat message and consumes the SSE response.
 *
 * Resolves only when the server sends a `done` event. Throws on HTTP errors,
 * server-sent `error` events, or if the stream ends before completion.
 */
export async function streamChatRequest(
  conversationId: string,
  message: string,
  options: StreamChatOptions = {},
): Promise<StreamChatResult> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversationId, message }),
  });

  if (!response.ok || !response.body) {
    throw new Error(`Chat request failed (${response.status})`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullResponse = "";
  let tokensUsed = 0;
  let done = false;
  let serverError: string | null = null;

  while (true) {
    // Streaming inherently requires reading chunk-by-chunk.
    // oxlint-disable-next-line no-await-in-loop
    const { done: streamDone, value } = await reader.read();
    if (streamDone) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) {
        continue;
      }
      const jsonStr = line.slice(6).trim();
      if (!jsonStr) {
        continue;
      }

      let event: any;
      try {
        event = JSON.parse(jsonStr);
      } catch {
        continue;
      }

      if (event.type === "chunk" && typeof event.text === "string") {
        fullResponse += event.text;
        options.onChunk?.(fullResponse);
      } else if (event.type === "done") {
        tokensUsed = typeof event.tokensUsed === "number" ? event.tokensUsed : 0;
        done = true;
      } else if (event.type === "error") {
        serverError = typeof event.message === "string" ? event.message : "Unknown error";
      }
    }
  }

  if (serverError) {
    throw new Error(serverError);
  }
  if (!done) {
    throw new Error("The connection was lost before the response completed.");
  }

  return { content: fullResponse, tokensUsed };
}
