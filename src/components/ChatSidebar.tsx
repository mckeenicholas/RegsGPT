import { For, Show, type Component } from "solid-js";
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
  userRequestsUsedToday: number;
  userRequestCap: number;
  onLogout: () => void;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) {
    return "Just now";
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days}d ago`;
  }
  return new Date(dateStr).toLocaleDateString();
}

const ChatSidebar: Component<ChatSidebarProps> = (props) => (
  <>
    {/* Backdrop for mobile */}
    <Show when={props.isOpen}>
      <div
        class="sidebar-backdrop fixed inset-0 z-[99] hidden bg-black/50 md:hidden"
        onClick={() => props.onClose()}
      />
    </Show>

    <aside
      class={`z-[100] flex h-full w-[280px] min-w-[280px] flex-col border-r border-border bg-bg-secondary transition-transform duration-250
          max-md:fixed max-md:top-0 max-md:left-0 max-md:h-screen ${props.isOpen ? "max-md:translate-x-0 max-md:shadow-2xl" : "max-md:-translate-x-full"}`}
    >
      {/* New Chat Button */}
      <div class="border-b border-border/50 p-4">
        <button
          class="btn btn-primary w-full gap-2 py-2.5"
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
            <div class="px-4 py-5 text-center text-sm text-text-muted">
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
                class={`conversation-item mb-0.5 flex cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2.5 transition-colors
                    ${
                      props.activeId === conv.id
                        ? "border border-accent/20 bg-accent/10"
                        : "hover:bg-bg-hover"
                    }`}
                onClick={() => {
                  props.onClose();
                }}
              >
                <div class="min-w-0 flex-1">
                  <div class="truncate text-sm text-text-primary">{conv.title}</div>
                  <div class="mt-0.5 text-xs text-text-muted">{timeAgo(conv.updatedAt)}</div>
                </div>
                <button
                  class="delete-btn shrink-0 rounded p-1 text-sm text-text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (globalThis.confirm("Delete this conversation? This cannot be undone.")) {
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
        requestsUsedToday={props.userRequestsUsedToday}
        requestCap={props.userRequestCap}
        onLogout={props.onLogout}
      />
    </aside>
  </>
);

export default ChatSidebar;
