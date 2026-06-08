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
      .replaceAll(
        /\[reg:([^\]]+)\]/giu,
        (_, id) => `[Regulation ${id}](${WCA_BASE}/regulations/#${id})`,
      )
      // [case:169] → [Incident 169](https://www.worldcubeassociation.org/incidents/169)
      .replaceAll(/\[case:(\d+)\]/giu, (_, id) => `[Incident ${id}](${WCA_BASE}/incidents/${id})`)
      // [comp:WC2025] → [Competition WC2025](https://www.worldcubeassociation.org/competitions/WC2025)
      .replaceAll(/\[comp:([^\]]+)\]/giu, (_, id) => `[${id}](${WCA_BASE}/competitions/${id})`)
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
  onRetry?: () => void;
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
    <div class="relative flex h-full min-h-0 min-w-0 flex-1 flex-col">
      {/* Header */}
      <div class="flex min-h-13 items-center gap-3 border-b border-border/50 bg-bg-primary px-5 py-3">
        <button
          class="hidden cursor-pointer rounded border-none bg-transparent p-1.5 text-xl text-text-secondary max-md:block"
          onClick={() => props.onToggleSidebar()}
          id="mobile-menu-button"
        >
          ☰
        </button>
        <div class="truncate text-sm font-medium text-text-primary">
          {props.conversationTitle || "RegsGPT"}
        </div>
      </div>

      <Show
        when={hasMessages()}
        fallback={
          /* Welcome Screen */
          <div class="flex flex-1 flex-col items-center justify-center px-5 py-10 text-center">
            <h1 class="mb-2 text-xl font-semibold text-text-secondary">
              Hello {props.userName.split(" ")[0]}! What do you need help with?
            </h1>
          </div>
        }
      >
        {/* Messages */}
        <div class="min-h-0 flex-1 overflow-y-auto py-5">
          <div class="mx-auto max-w-3xl px-5">
            <For each={props.messages}>
              {(msg) => (
                <div class="animate-message-in mb-6">
                  <div class="mb-1.5 flex items-center gap-2">
                    <div
                      class={`flex h-6 w-6 shrink-0 items-center justify-center rounded text-xs font-semibold ${
                        msg.role === "user"
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
                  <div class="prose-markdown pl-8 text-sm leading-relaxed text-text-primary">
                    <Show when={msg.role === "assistant"} fallback={<p>{msg.content}</p>}>
                      <SolidMarkdown children={substituteLinks(msg.content)} />
                    </Show>

                    <Show
                      when={
                        msg.role === "assistant" && msg.content.startsWith("⚠️") && props.onRetry
                      }
                    >
                      <button
                        onClick={() => props.onRetry!()}
                        class="mt-2.5 flex cursor-pointer items-center gap-1.5 rounded-lg border border-accent/30 bg-accent/10 px-3.5 py-1.5 text-xs font-semibold text-accent transition-all hover:border-accent/40 hover:bg-accent/20"
                      >
                        ↻ Retry
                      </button>
                    </Show>
                  </div>
                </div>
              )}
            </For>

            {/* Streaming message */}
            <Show when={props.isStreaming}>
              <div class="animate-message-in mb-6">
                <div class="mb-1.5 flex items-center gap-2">
                  <div class="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-linear-to-br from-accent to-accent-dim text-xs font-semibold text-bg-primary">
                    R
                  </div>
                  <span class="text-sm font-semibold text-text-secondary">RegsGPT</span>
                </div>
                <div class="prose-markdown pl-8 text-sm leading-relaxed text-text-primary">
                  <Show
                    when={props.streamingContent.length > 0}
                    fallback={
                      <span class="animate-blink inline-block h-4 w-0.5 bg-accent align-text-bottom" />
                    }
                  >
                    <SolidMarkdown
                      children={substituteLinks(props.streamingContent)}
                      renderingStrategy="reconcile"
                    />
                    <span class="animate-blink inline-block h-4 w-0.5 bg-accent align-text-bottom" />
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
