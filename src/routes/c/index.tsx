import { createSignal } from "solid-js";
import { createAsync } from "@solidjs/router";
import ChatInput from "~/components/ChatInput";
import ChatWindow, { type ChatMessage } from "~/components/ChatWindow";
import { streamChatRequest } from "~/lib/chatStream";
import { createConversationRPC } from "~/lib/server/services/conversations";
import { getUserSession } from "~/lib/server/services/session";
import { setSidebarOpen } from "~/routes/c";

export default function NewChat() {
  const user = createAsync(() => getUserSession());
  const [messages, setMessages] = createSignal<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = createSignal(false);
  const [streamingContent, setStreamingContent] = createSignal("");
  const [conversationId, setConversationId] = createSignal<string | null>(null);

  let nextLocalId = 1;

  const markFailed = (localId: number, failed: boolean) => {
    setMessages((prev) => prev.map((m) => (m.localId === localId ? { ...m, failed } : m)));
  };

  const send = async (message: string, localId: number) => {
    setIsStreaming(true);
    setStreamingContent("");

    try {
      let convId = conversationId();

      // Only create the conversation on the first attempt. A retry after a
      // failed response must reuse the conversation (and the user message the
      // server already stored).
      if (!convId) {
        const data = await createConversationRPC();
        convId = data.id;
        setConversationId(convId);

        // Swap the URL immediately using history so we don't drop the SSE stream state
        globalThis.history.replaceState({}, "", `/c/${convId}`);
      }

      await streamChatRequest(convId, message, {
        onChunk: (fullText) => setStreamingContent(fullText),
      });

      // Load the persisted conversation state from the server.
      globalThis.location.href = `/c/${convId}`;
    } catch (error) {
      console.error(error);
      markFailed(localId, true);
      setIsStreaming(false);
      setStreamingContent("");
    }
  };

  const handleSend = (message: string) => {
    const localId = nextLocalId++;
    setMessages((prev) => [...prev, { role: "user", content: message, localId }]);
    void send(message, localId);
  };

  const handleRetry = (message: ChatMessage) => {
    if (message.localId === undefined || isStreaming()) {
      return;
    }
    markFailed(message.localId, false);
    void send(message.content, message.localId);
  };

  return (
    <>
      <ChatWindow
        messages={messages()}
        isStreaming={isStreaming()}
        streamingContent={streamingContent()}
        conversationTitle="New Chat"
        onSuggestionClick={handleSend}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        onRetry={handleRetry}
        userName={user()?.name ?? "User"}
      />
      <ChatInput onSend={handleSend} disabled={isStreaming()} />
    </>
  );
}
