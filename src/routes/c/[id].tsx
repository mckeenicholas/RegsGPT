import {
  RouteDefinition,
  RouteSectionProps,
  createAsync,
} from "@solidjs/router";
import { createSignal, createEffect } from "solid-js";
import ChatWindow from "~/components/ChatWindow";
import ChatInput from "~/components/ChatInput";
import { getMessagesQuery } from "~/lib/server/services/conversations";
import { setSidebarOpen } from "~/routes/c";
import { getUserSession } from "~/lib/server/services/session";

export const route = {
  load: ({ params }) => {
    getMessagesQuery(params.id as string);
  },
} satisfies RouteDefinition;

export default function ExistingChat(props: RouteSectionProps) {
  const user = createAsync(() => getUserSession());
  const data = createAsync(() => getMessagesQuery(props.params.id as string));

  const [localMessages, setLocalMessages] = createSignal<any[]>([]);
  const [isStreaming, setIsStreaming] = createSignal(false);
  const [streamingContent, setStreamingContent] = createSignal("");
  const [pendingSuggestion, setPendingSuggestion] = createSignal("");

  createEffect(() => {
    // Sync the server pre-rendered messages into our local state
    if (data()?.messages) {
      setLocalMessages(JSON.parse(JSON.stringify(data()?.messages))); // clone to detach from read-only signal
    }
  });

  const handleSend = async (message: string) => {
    const convId = props.params.id;
    if (!convId) return;

    setLocalMessages((prev) => [...prev, { role: "user", content: message }]);
    setIsStreaming(true);
    setStreamingContent("");
    setPendingSuggestion("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: convId, message }),
      });

      if (!res.ok || !res.body) {
        throw new Error("Chat request failed");
      }

      const reader = res.body.getReader();
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
              setStreamingContent(fullResponse);
            } else if (event.type === "done") {
              setLocalMessages((prev) => [
                ...prev,
                { role: "assistant", content: fullResponse },
              ]);
              setIsStreaming(false);
              setStreamingContent("");
            } else if (event.type === "error") {
              console.error("Chat error:", event.message);
              setLocalMessages((prev) => [
                ...prev,
                { role: "assistant", content: `⚠️ Error: ${event.message}` },
              ]);
              setIsStreaming(false);
              setStreamingContent("");
            }
          } catch (parseErr) {
            console.error("Parsing Error", parseErr);
          }
        }
      }
    } catch (err) {
      console.error("Chat stream error:", err);
      setLocalMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "⚠️ An error occurred while connecting to the AI.",
        },
      ]);
      setIsStreaming(false);
      setStreamingContent("");
    }
  };

  return (
    <>
      <ChatWindow
        messages={localMessages()}
        isStreaming={isStreaming()}
        streamingContent={streamingContent()}
        conversationTitle={data()?.conversation.title || "RegsGPT Chat"}
        userName={user()?.name || "User"}
        onSuggestionClick={(text) => handleSend(text)}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
      />
      <ChatInput
        onSend={handleSend}
        disabled={isStreaming()}
        initialValue={pendingSuggestion()}
      />
    </>
  );
}
