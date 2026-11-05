import { Show, createSignal, onMount, type Component } from "solid-js";

// WCA OAuth config — these are public (client-side safe)
const WCA_URL = import.meta.env.VITE_WCA_URL;
const APPLICATION_ID = import.meta.env.VITE_WCA_APPLICATION_ID;
const REDIRECT_URI = import.meta.env.VITE_WCA_REDIRECT_URI;

const LoginPage: Component = () => {
  const [error, setError] = createSignal<string | null>(null);

  // Check for auth error from server redirect
  onMount(() => {
    const urlParams = new URLSearchParams(globalThis.location.search);
    if (urlParams.get("auth_error")) {
      setError("Authentication failed. Please try again.");
      globalThis.history.replaceState({}, "", globalThis.location.pathname);
    }
  });

  const loginURLParams = new URLSearchParams({
    client_id: APPLICATION_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: "public",
  });

  const loginURL = new URL(`${WCA_URL}/oauth/authorize?${loginURLParams.toString()}`);

  return (
    <div class="relative flex min-h-screen items-center justify-center overflow-hidden bg-bg-primary">
      {/* Ambient glow effects */}
      <div class="absolute -top-48 -right-24 h-125 w-125 rounded-full bg-accent opacity-15 blur-[120px]" />
      <div class="absolute -bottom-48 -left-24 h-125 w-125 rounded-full bg-sky-400 opacity-10 blur-[120px]" />

      <div class="card relative z-10 mx-4 w-full max-w-md p-12 text-center">
        {/* Logo */}
        <h1 class="mb-2 text-3xl font-bold text-text-primary">
          Regs<span class="text-accent">GPT</span>
        </h1>

        <p class="mb-8 text-sm leading-relaxed text-text-secondary">
          AI-powered assistant for WCA Delegates.
        </p>

        <a
          class="btn btn-primary gap-2.5 px-7 py-3 text-base transition-all hover:-translate-y-0.5 hover:shadow-[0_0_24px_rgba(56,189,248,0.25)] active:translate-y-0"
          href={loginURL.toString()}
          id="login-button"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
            <polyline points="10 17 15 12 10 7" />
            <line x1="15" y1="12" x2="3" y2="12" />
          </svg>
          Sign in with WCA
        </a>

        {/* Error message */}
        <Show when={error()}>
          <div class="mt-4 rounded-lg border border-danger/20 bg-danger/10 p-3 text-sm text-danger">
            {error()}
          </div>
        </Show>
      </div>
    </div>
  );
};

export default LoginPage;
