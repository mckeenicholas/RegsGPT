import { createAsync, useNavigate } from "@solidjs/router";
import { Show, createEffect } from "solid-js";
import LoginPage from "~/components/LoginPage";
import { getUserSession } from "~/lib/server/services/session";

export default function Home() {
  const navigate = useNavigate();
  const user = createAsync(() => getUserSession());

  createEffect(() => {
    if (user()) {
      navigate("/c", { replace: true });
    }
  });

  return (
    <Show when={user()} fallback={<LoginPage />}>
      <div class="h-dvh w-full flex items-center justify-center bg-bg-primary text-text-primary">
        Loading RegsGPT...
      </div>
    </Show>
  );
}
