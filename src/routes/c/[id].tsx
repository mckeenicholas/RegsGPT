import {
  RouteDefinition,
  RouteSectionProps,
  createAsync,
} from "@solidjs/router";
import { createSignal, createEffect } from "solid-js";
import ChatWindow, { type ChatMessage } from "~/components/ChatWindow";
import ChatInput from "~/components/ChatInput";
import { getMessagesQuery } from "~/lib/server/services/conversations";
import { setSidebarOpen } from "~/routes/c";
import { getUserSession } from "~/lib/server/services/session";
import { streamChatRequest } from "~/lib/chatStream";

export const route = {
  load: ({ params }) => {
    getMessagesQuery(params.id as string);
  },
} satisfies RouteDefinition;

export default function ExistingChat(props: RouteSectionProps) {
  const user = createAsync(() => getUserSession());
  const data = createAsync(() => getMessagesQuery(props.params.id as string));

  const [localMessages, setLocalMessages] = createSignal<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = createSignal(false);
  const [streamingContent, setStreamingContent] = createSignal("");
  const [pendingSuggestion, setPendingSuggestion] = createSignal("");

  let nextLocalId = 1;

  createEffect(() => {
    // Sync the server pre-rendered messages into our local state
    if (data()?.messages) {
      setLocalMessages(JSON.parse(JSON.stringify(data()?.messages))); // clone to detach from read-only signal
    }
  });

  const markFailed = (localId: number, failed: boolean) => {
    setLocalMessages((prev) =>
      prev.map((m) => (m.localId === localId ? { ...m, failed } : m)),
    );
  };

  const send = async (message: string, localId: number) => {
    const convId = props.params.id;
    if (!convId) return;

    setIsStreaming(true);
    setStreamingContent("");
    setPendingSuggestion("");

    try {
      const result = await streamChatRequest(convId, message, {
        onChunk: (fullText) => setStreamingContent(fullText),
      });

      setLocalMessages((prev) => [
        ...prev.map((m) =>
          m.localId === localId ? { ...m, failed: false } : m,
        ),
        { role: "assistant", content: result.content },
      ]);
      setIsStreaming(false);
      setStreamingContent("");
    } catch (err) {
      console.error("Chat stream error:", err);
      markFailed(localId, true);
      setIsStreaming(false);
      setStreamingContent("");
    }
  };

  const handleSend = (message: string) => {
    const localId = nextLocalId++;
    setLocalMessages((prev) => [
      ...prev,
      { role: "user", content: message, localId },
    ]);
    void send(message, localId);
  };

  const handleRetry = (message: ChatMessage) => {
    if (message.localId === undefined || isStreaming()) return;
    markFailed(message.localId, false);
    void send(message.content, message.localId);
  };

  return (
    <>
      <ChatWindow
        messages={localMessages()}
        isStreaming={isStreaming()}
        streamingContent={streamingContent()}
        conversationTitle={data()?.conversation.title || "RegsGPT Chat"}
        userName={user()?.name || "User"}
        onSuggestionClick={handleSend}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        onRetry={handleRetry}
      />
      <ChatInput
        onSend={handleSend}
        disabled={isStreaming()}
        initialValue={pendingSuggestion()}
      />
    </>
  );
}
