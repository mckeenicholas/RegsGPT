import { Component, For, Show, createEffect } from "solid-js";
import { SolidMarkdown } from "solid-markdown";

const WCA_BASE = "https://www.worldcubeassociation.org";

/**
 * Post-process LLM output to convert [reg:X] and [case:X] tokens into
 * clickable markdown links to the WCA website.
 */
function substituteLinks(text: string): string {
  return (
    text
      // [reg:9f1] → [Regulation 9f1](https://www.worldcubeassociation.org/regulations/#9f1)
      .replace(
        /\[reg:([^\]]+)\]/gi,
        (_, id) => `[Regulation ${id}](${WCA_BASE}/regulations/#${id})`,
      )
      // [case:169] → [Incident 169](https://www.worldcubeassociation.org/incidents/169)
      .replace(
        /\[case:(\d+)\]/gi,
        (_, id) => `[Incident ${id}](${WCA_BASE}/incidents/${id})`,
      )
      // [comp:WC2025] → [Competition WC2025](https://www.worldcubeassociation.org/competitions/WC2025)
      .replace(
        /\[comp:([^\]]+)\]/gi,
        (_, id) => `[${id}](${WCA_BASE}/competitions/${id})`,
      )
  );
}

interface Message {
  id?: string;
  role: "user" | "assistant";
  content: string;
}

interface ChatWindowProps {
  messages: Message[];
  isStreaming: boolean;
  streamingContent: string;
  conversationTitle: string;
  onSuggestionClick: (text: string) => void;
  onToggleSidebar: () => void;
  userName: string;
}

const ChatWindow: Component<ChatWindowProps> = (props) => {
  let messagesEndRef: HTMLDivElement | undefined;

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef?.scrollIntoView({ behavior: "smooth" });
    }, 10);
  };

  createEffect(() => {
    props.messages.length;
    props.streamingContent;
    scrollToBottom();
  });

  const hasMessages = () => props.messages.length > 0 || props.isStreaming;

  return (
    <div class="flex-1 flex flex-col min-w-0 min-h-0 h-full relative">
      {/* Header */}
      <div class="px-5 py-3 border-b border-border/50 flex items-center gap-3 min-h-13 bg-bg-primary">
        <button
          class="hidden max-md:block bg-transparent border-none text-text-secondary cursor-pointer p-1.5 text-xl rounded"
          onClick={() => props.onToggleSidebar()}
          id="mobile-menu-button"
        >
          ☰
        </button>
        <div class="text-sm font-medium text-text-primary truncate">
          {props.conversationTitle || "RegsGPT"}
        </div>
      </div>

      <Show
        when={hasMessages()}
        fallback={
          /* Welcome Screen */
          <div class="flex-1 flex flex-col items-center justify-center px-5 py-10 text-center">
            <h1 class="text-xl font-semibold text-text-secondary mb-2">
              Hello {props.userName.split(" ")[0]}! What do you need help with?
            </h1>
          </div>
        }
      >
        {/* Messages */}
        <div class="flex-1 overflow-y-auto min-h-0 py-5">
          <div class="max-w-3xl mx-auto px-5">
            <For each={props.messages}>
              {(msg) => (
                <div class="mb-6 animate-message-in">
                  <div class="flex items-center gap-2 mb-1.5">
                    <div
                      class={`w-6 h-6 rounded flex items-center justify-center text-xs font-semibold shrink-0 ${msg.role === "user"
                        ? "bg-bg-hover text-text-secondary"
                        : "bg-linear-to-br from-accent to-accent-dim text-bg-primary"
                        }`}
                    >
                      {msg.role === "user"
                        ? props.userName
                          ? props.userName[0].toUpperCase()
                          : "U"
                        : "R"}
                    </div>
                    <span class="text-sm font-semibold text-text-secondary">
                      {msg.role === "user" ? "You" : "RegsGPT"}
                    </span>
                  </div>
                  <div class="pl-8 text-sm leading-relaxed text-text-primary prose-markdown">
                    <Show
                      when={msg.role === "assistant"}
                      fallback={<p>{msg.content}</p>}
                    >
                      <SolidMarkdown children={substituteLinks(msg.content)} />
                    </Show>
                  </div>
                </div>
              )}
            </For>

            {/* Streaming message */}
            <Show when={props.isStreaming}>
              <div class="mb-6 animate-message-in">
                <div class="flex items-center gap-2 mb-1.5">
                  <div class="w-6 h-6 rounded flex items-center justify-center text-xs font-semibold shrink-0 bg-linear-to-br from-accent to-accent-dim text-bg-primary">
                    R
                  </div>
                  <span class="text-sm font-semibold text-text-secondary">
                    RegsGPT
                  </span>
                </div>
                <div class="pl-8 text-sm leading-relaxed text-text-primary prose-markdown">
                  <Show
                    when={props.streamingContent.length > 0}
                    fallback={
                      <span class="inline-block w-0.5 h-4 bg-accent animate-blink align-text-bottom" />
                    }
                  >
                    <SolidMarkdown
                      children={substituteLinks(props.streamingContent)}
                      renderingStrategy="reconcile"
                    />
                    <span class="inline-block w-0.5 h-4 bg-accent animate-blink align-text-bottom" />
                  </Show>
                </div>
              </div>
            </Show>

            <div ref={messagesEndRef} />
          </div>
        </div>
      </Show>
    </div>
  );
};

export default ChatWindow;
