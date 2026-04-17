import {
  RouteDefinition,
  RouteSectionProps,
  createAsync,
  useAction,
} from "@solidjs/router";
import { createSignal, Show, Suspense } from "solid-js";
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
    <Suspense fallback={<div class="h-dvh w-full flex items-center justify-center">Loading session...</div>}>
      <Show when={user()} fallback={<LoginPage />}>
        <div class="h-dvh w-full flex overflow-hidden">
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
            userName={user()?.name!}
            userWcaID={user()?.wcaID!}
            userTokensUsed={user()?.tokensUsed!}
            userTokenCap={user()?.tokenCap!}
            onLogout={() => logout()}
          />

          <div class="flex-1 flex flex-col min-w-0 min-h-0 h-full">
            {props.children}
          </div>
        </div>
      </Show>
    </Suspense>
  );
}