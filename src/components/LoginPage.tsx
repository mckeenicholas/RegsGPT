import { Component, Show, createSignal, onMount } from "solid-js";

// WCA OAuth config — these are public (client-side safe)
const WCA_URL = import.meta.env.VITE_WCA_URL;
const APPLICATION_ID = import.meta.env.VITE_WCA_APPLICATION_ID;
const REDIRECT_URI = import.meta.env.VITE_WCA_REDIRECT_URI;

const LoginPage: Component = () => {
  const [error, setError] = createSignal<string | null>(null);

  // Check for auth error from server redirect
  onMount(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("auth_error")) {
      setError("Authentication failed. Please try again.");
      window.history.replaceState({}, "", window.location.pathname);
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
    <div class="min-h-screen flex items-center justify-center bg-bg-primary relative overflow-hidden">
      {/* Ambient glow effects */}
      <div class="absolute w-125 h-125 rounded-full blur-[120px] opacity-15 bg-accent -top-48 -right-24" />
      <div class="absolute w-125 h-125 rounded-full blur-[120px] opacity-10 bg-sky-400 -bottom-48 -left-24" />

      <div class="relative z-10 text-center p-12 card max-w-md w-full mx-4">
        {/* Logo */}
        <h1 class="text-3xl font-bold text-text-primary mb-2">
          Regs<span class="text-accent">GPT</span>
        </h1>

        <p class="text-sm text-text-secondary leading-relaxed mb-8">
          AI-powered assistant for WCA Delegates.
        </p>

        <a
          class="btn btn-primary px-7 py-3 text-base gap-2.5 hover:shadow-[0_0_24px_rgba(56,189,248,0.25)] hover:-translate-y-0.5 active:translate-y-0 transition-all"
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
          <div class="mt-4 rounded-lg bg-danger/10 border border-danger/20 p-3 text-sm text-danger">
            {error()}
          </div>
        </Show>
      </div>
    </div>
  );
};

export default LoginPage;
