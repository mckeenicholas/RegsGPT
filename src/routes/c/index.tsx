import { createSignal } from "solid-js";
import { createAsync } from "@solidjs/router";
import ChatWindow from "~/components/ChatWindow";
import ChatInput from "~/components/ChatInput";
import { createConversationRPC } from "~/lib/server/services/conversations";
import { getUserSession } from "~/lib/server/services/session";
import { setSidebarOpen } from "~/routes/c";

export default function NewChat() {
  const user = createAsync(() => getUserSession());
  const [messages, setMessages] = createSignal<any[]>([]);
  const [isStreaming, setIsStreaming] = createSignal(false);

  const handleSend = async (message: string) => {
    setMessages([{ role: "user", content: message }]);
    setIsStreaming(true);

    try {
      const data = await createConversationRPC();
      const newId = data.id;

      // Swap the URL immediately using history so we don't drop the SSE stream state
      window.history.replaceState({}, "", `/c/${newId}`);

      const chatRes = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: newId, message }),
      });

      if (!chatRes.ok || !chatRes.body) throw new Error("Chat request failed");
      const reader = chatRes.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;
          try {
            const event = JSON.parse(jsonStr);
            if (event.type === "chunk") {
              fullResponse += event.text;
              document
                .getElementById("streaming-content")
                ?.dispatchEvent(
                  new CustomEvent("stream-update", { detail: fullResponse }),
                );
            }
          } catch (e) {
            console.error("Streaming error", e);
          }
        }
      }

      // Instead of manual sync, just trigger a hard navigation to load the DB state
      window.location.href = `/c/${newId}`;
    } catch (e) {
      console.error(e);
      setMessages([
        { role: "assistant", content: "⚠️ Failed to start conversation." },
      ]);
      setIsStreaming(false);
    }
  };

  return (
    <>
      <ChatWindow
        messages={messages()}
        isStreaming={isStreaming()}
        streamingContent={""} // Used minimally here as we swap routes quickly
        conversationTitle="New Chat"
        onSuggestionClick={(text) => handleSend(text)}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        userName={user()?.name || "User"}
      />
      <ChatInput onSend={handleSend} disabled={isStreaming()} />
    </>
  );
}
