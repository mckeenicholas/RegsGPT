import { defineConfig } from "vite";
import { nitro } from "nitro/vite";
import { solidStart } from "@solidjs/start/config";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [solidStart(), tailwindcss(), nitro()],
  optimizeDeps: {
    include: ["solid-markdown > micromark", "solid-markdown > unified"],
  },
  ssr: {
    noExternal: ["solid-markdown"],
  },
});
