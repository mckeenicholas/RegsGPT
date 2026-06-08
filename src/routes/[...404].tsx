export default function NotFound() {
  return (
    <div class="relative flex min-h-screen items-center justify-center overflow-hidden bg-bg-primary">
      <div class="absolute -top-48 -right-24 h-125 w-125 rounded-full bg-danger opacity-15 blur-[120px]" />
      <div class="absolute -bottom-48 -left-24 h-125 w-125 rounded-full bg-warning opacity-10 blur-[120px]" />
      <div class="card relative z-10 mx-4 w-full max-w-md p-12 text-center">
        <h1 class="mb-2 text-3xl font-bold text-text-primary">404</h1>
        <p class="mb-8 text-sm leading-relaxed text-text-secondary">
          This page doesn't exist. Maybe the regulation you're looking for is in a different
          section?
        </p>
        <a href="/" class="btn btn-primary px-6 py-2.5 text-base" id="back-home-button">
          ← Back to RegsGPT
        </a>
      </div>
    </div>
  );
}
