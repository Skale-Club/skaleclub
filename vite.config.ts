import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import path from "path";

// Sentry release: the commit CI/Coolify builds, or an explicit VITE_RELEASE.
const release = process.env.VITE_RELEASE || process.env.GITHUB_SHA || process.env.SOURCE_COMMIT || "";

export default defineConfig({
  define: {
    "import.meta.env.VITE_RELEASE": JSON.stringify(release),
  },
  plugins: [
    react(),
    // Upload source maps to Sentry on production builds (only when auth token is set)
    ...(process.env.SENTRY_AUTH_TOKEN
      ? [
          sentryVitePlugin({
            org: "skale-club",
            project: "skaleclub-frontend",
            authToken: process.env.SENTRY_AUTH_TOKEN,
            ...(release ? { release: { name: release } } : {}),
            sourcemaps: { filesToDeleteAfterUpload: ["dist/public/assets/*.js.map"] },
          }),
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

          // Only the primitives the public shell mounts (dialog, tooltip, toast, slot)
          // plus the Radix internals they share. Every other Radix package and
          // cmdk/vaul/react-day-picker stay unassigned so they split per route
          // (admin, forms) instead of loading on every page.
          //
          // NOTE: lucide-react is intentionally NOT grouped into a vendor chunk.
          // The full icon library is ~500 KB; bundling it as a single vendor
          // chunk forces all icons (used or not) into every page load.
          if (
            /\/node_modules\/@radix-ui\/react-(dialog|tooltip|toast|slot|primitive|compose-refs|context|id|presence|portal|dismissable-layer|focus-scope|focus-guards|popper|visually-hidden|use-[a-z-]+|direction|arrow|collection)\//.test(id) ||
            id.includes("/node_modules/@radix-ui/primitive/") ||
            id.includes("/node_modules/react-remove-scroll") ||
            id.includes("/node_modules/aria-hidden/") ||
            id.includes("/node_modules/@floating-ui/")
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
