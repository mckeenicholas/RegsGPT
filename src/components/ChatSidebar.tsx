import { Component, For, Show } from "solid-js";
import { A } from "@solidjs/router";
import UserMenu from "./UserMenu";

interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
}

interface ChatSidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  isOpen: boolean;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  userName: string;
  userWcaID: string;
  userTokensUsed: number;
  userTokenCap: number;
  onLogout: () => void;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

const ChatSidebar: Component<ChatSidebarProps> = (props) => {
  return (
    <>
      {/* Backdrop for mobile */}
      <Show when={props.isOpen}>
        <div
          class="sidebar-backdrop fixed inset-0 bg-black/50 z-[99] hidden md:hidden"
          onClick={() => props.onClose()}
        />
      </Show>

      <aside
        class={`w-[280px] min-w-[280px] h-full bg-bg-secondary border-r border-border flex flex-col z-[100] transition-transform duration-250
          max-md:fixed max-md:left-0 max-md:top-0 max-md:h-screen ${props.isOpen ? "max-md:translate-x-0 max-md:shadow-2xl" : "max-md:-translate-x-full"}`}
      >
        {/* New Chat Button */}
        <div class="p-4 border-b border-border/50">
          <button
            class="btn btn-primary w-full py-2.5 gap-2"
            onClick={() => props.onNewChat()}
            id="new-chat-button"
          >
            <span>＋</span>
            New Chat
          </button>
        </div>

        {/* Conversation List */}
        <div class="flex-1 overflow-y-auto p-2">
          <Show
            when={props.conversations.length > 0}
            fallback={
              <div class="px-4 py-5 text-center text-text-muted text-sm">
                No conversations yet.
                <br />
                Start a new chat!
              </div>
            }
          >
            <For each={props.conversations}>
              {(conv) => (
                <A
                  href={`/c/${conv.id}`}
                  class={`conversation-item flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors mb-0.5
                    ${
                      props.activeId === conv.id
                        ? "bg-accent/10 border border-accent/20"
                        : "hover:bg-bg-hover"
                    }`}
                  onClick={() => {
                    props.onClose();
                  }}
                >
                  <div class="flex-1 min-w-0">
                    <div class="text-sm text-text-primary truncate">
                      {conv.title}
                    </div>
                    <div class="text-xs text-text-muted mt-0.5">
                      {timeAgo(conv.updatedAt)}
                    </div>
                  </div>
                  <button
                    class="delete-btn shrink-0 p-1 rounded text-text-muted hover:text-danger hover:bg-danger/10 text-sm transition-colors"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (
                        window.confirm(
                          "Delete this conversation? This cannot be undone.",
                        )
                      ) {
                        props.onDelete(conv.id);
                      }
                    }}
                    title="Delete conversation"
                  >
                    ✕
                  </button>
                </A>
              )}
            </For>
          </Show>
        </div>

        {/* User Menu */}
        <UserMenu
          name={props.userName}
          wcaID={props.userWcaID}
          tokensUsed={props.userTokensUsed}
          tokenCap={props.userTokenCap}
          onLogout={props.onLogout}
        />
      </aside>
    </>
  );
};

export default ChatSidebar;
