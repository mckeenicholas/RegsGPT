import { createSignal, Show, Suspense } from "solid-js";
import { RouteDefinition, RouteSectionProps, createAsync, useAction } from "@solidjs/router";
import ChatSidebar from "~/components/ChatSidebar";
import LoginPage from "~/components/LoginPage";
import {
  getConversationsQuery,
  createConversationAction,
  deleteConversationAction,
} from "~/lib/server/services/conversations";
import { getUserSession } from "~/lib/server/services/session";
import { logoutAction } from "~/lib/server/services/session";

export const route = {
  load: () => {
    getUserSession();
    getConversationsQuery();
  },
} satisfies RouteDefinition;

export const [sidebarOpen, setSidebarOpen] = createSignal(false);

export default function Layout(props: RouteSectionProps) {
  const user = createAsync(() => getUserSession());
  const conversations = createAsync(() => getConversationsQuery());

  const createChat = useAction(createConversationAction);
  const deleteChat = useAction(deleteConversationAction);
  const logout = useAction(logoutAction);

  const activeConvId = () => props.params.id || null;

  return (
    <Suspense
      fallback={<div class="flex h-dvh w-full items-center justify-center">Loading session...</div>}
    >
      <Show when={user()} fallback={<LoginPage />}>
        <div class="flex h-dvh w-full overflow-hidden">
          <ChatSidebar
            conversations={conversations() || []}
            activeId={activeConvId()}
            isOpen={sidebarOpen()}
            onSelect={() => setSidebarOpen(false)}
            onNewChat={() => {
              createChat();
              setSidebarOpen(false);
            }}
            onDelete={async (id) => {
              await deleteChat(id);
              if (activeConvId() === id) {
                window.location.href = "/c";
              }
            }}
            onClose={() => setSidebarOpen(false)}
            userName={user()!.name}
            userWcaID={user()!.wcaID}
            userRequestsUsedToday={user()!.requestsUsedToday}
            userRequestCap={user()!.requestCap}
            onLogout={() => logout()}
          />

          <div class="flex h-full min-h-0 min-w-0 flex-1 flex-col">{props.children}</div>
        </div>
      </Show>
    </Suspense>
  );
}
