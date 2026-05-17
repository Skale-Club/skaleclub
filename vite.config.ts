import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

export default defineConfig({
  plugins: [
    react(),
    // runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes("node_modules")) {
            return undefined;
          }

          // React core + router — small, foundational, every route needs it
          if (
            id.includes("/node_modules/react/") ||
            id.includes("/node_modules/react-dom/") ||
            id.includes("/node_modules/scheduler/") ||
            id.includes("/node_modules/wouter/")
          ) {
            return "vendor-react";
          }

          // Radix UI primitives + headless UI libs (cmdk, vaul, day-picker)
          //
          // NOTE: lucide-react is intentionally NOT grouped into a vendor chunk.
          // The full icon library is ~500 KB; bundling it as a single vendor
          // chunk forces all icons (used or not) into every page load. Letting
          // Vite/Rollup chunk it per-route preserves per-icon tree-shaking, so
          // each route only ships the icons it actually imports.
          if (
            id.includes("/node_modules/@radix-ui/") ||
            id.includes("/node_modules/cmdk/") ||
            id.includes("/node_modules/vaul/") ||
            id.includes("/node_modules/react-day-picker/")
          ) {
            return "vendor-ui";
          }

          // React Query (and devtools if ever installed)
          if (id.includes("/node_modules/@tanstack/")) {
            return "vendor-query";
          }

          // Small utility libs grouped together
          if (
            id.includes("/node_modules/date-fns/") ||
            id.includes("/node_modules/zod/") ||
            id.includes("/node_modules/drizzle-zod/") ||
            id.includes("/node_modules/clsx/") ||
            id.includes("/node_modules/tailwind-merge/")
          ) {
            return "vendor-utils";
          }

          // Everything else → let Vite/Rollup decide (per-route auto chunks)
          return undefined;
        },
      },
    },
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
