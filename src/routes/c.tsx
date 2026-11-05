import { createRoot, createSignal, Show, Suspense } from "solid-js";
import {
  createAsync,
  redirect,
  useAction,
  type RouteDefinition,
  type RouteSectionProps,
} from "@solidjs/router";
import ChatSidebar from "~/components/ChatSidebar";
import {
  getConversationsQuery,
  createConversationAction,
  deleteConversationAction,
} from "~/lib/server/services/conversations";
import { getUserSession, logoutAction } from "~/lib/server/services/session";

export const route = {
  preload: async () => {
    const user = await getUserSession();
    if (!user) {
      throw redirect("/");
    }
    await getConversationsQuery();
  },
} satisfies RouteDefinition;

export const [sidebarOpen, setSidebarOpen] = createRoot(() => createSignal(false));

export default function Layout(props: RouteSectionProps) {
  const user = createAsync(() => getUserSession());
  const conversations = createAsync(() => getConversationsQuery());

  const createChat = useAction(createConversationAction);
  const deleteChat = useAction(deleteConversationAction);
  const logout = useAction(logoutAction);

  const activeConvId = () => props.params.id ?? null;

  return (
    <Suspense
      fallback={<div class="flex h-dvh w-full items-center justify-center">Loading session...</div>}
    >
      <Show when={user()}>
        <div class="flex h-dvh w-full overflow-hidden">
          <ChatSidebar
            conversations={conversations() ?? []}
            activeId={activeConvId()}
            isOpen={sidebarOpen()}
            onSelect={() => setSidebarOpen(false)}
            onNewChat={() => {
              void createChat();
              setSidebarOpen(false);
            }}
            onDelete={(id) => {
              void deleteChat(id).then(() => {
                if (activeConvId() === id) {
                  globalThis.location.href = "/c";
                }
              });
            }}
            onClose={() => setSidebarOpen(false)}
            userName={user()!.name}
            userWcaID={user()!.wcaID}
            userRequestsUsedToday={user()!.requestsUsedToday}
            userRequestCap={user()!.requestCap}
            onLogout={() => {
              void logout();
            }}
          />

          <div class="flex h-full min-h-0 min-w-0 flex-1 flex-col">{props.children}</div>
        </div>
      </Show>
    </Suspense>
  );
}
