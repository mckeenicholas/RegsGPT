export default function NotFound() {
  return (
    <div class="min-h-screen flex items-center justify-center bg-bg-primary relative overflow-hidden">
      <div class="absolute w-125 h-125 rounded-full blur-[120px] opacity-15 bg-danger -top-48 -right-24" />
      <div class="absolute w-125 h-125 rounded-full blur-[120px] opacity-10 bg-warning -bottom-48 -left-24" />
      <div class="relative z-10 text-center p-12 card max-w-md w-full mx-4">
        <h1 class="text-3xl font-bold text-text-primary mb-2">404</h1>
        <p class="text-sm text-text-secondary leading-relaxed mb-8">
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
