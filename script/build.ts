import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile, writeFile } from "fs/promises";
import { spawn } from "child_process";

// server deps to bundle to reduce syscalls, which helps cold start times.
// express, pg and express-session are deliberately NOT here: Sentry's
// auto-instrumentation patches them at require time, which only works when
// they are real runtime modules loaded after dist/instrument.cjs.
const allowlist = [
  "@google/generative-ai",
  "axios",
  "connect-pg-simple",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express-rate-limit",
  "jose",
  "jsonwebtoken",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "stripe",
  "uuid",
  "xlsx",
  "zod",
  "zod-validation-error",
];

async function injectSEO() {
  return new Promise<void>((resolve, reject) => {
    console.log("\n🔧 Injecting dynamic SEO data...");
    const child = spawn("tsx", ["scripts/inject-seo-build.ts"], {
      stdio: "inherit",
      shell: true,
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        console.warn("⚠️  SEO injection had warnings, but build continues...");
        resolve(); // Don't fail build even if SEO injection fails
      }
    });

    child.on("error", (err) => {
      console.warn("⚠️  SEO injection error:", err.message);
      resolve(); // Don't fail build
    });
  });
}

// Give every build its own service-worker cache names (the placeholder lives in
// client/public/sw.js) so a deploy invalidates the previous build's caches.
async function stampServiceWorker() {
  const swPath = "dist/public/sw.js";
  const hash = (process.env.GITHUB_SHA || process.env.SOURCE_COMMIT || Date.now().toString(36)).slice(0, 12);
  const source = await readFile(swPath, "utf-8");
  const stamped = source.replaceAll("__BUILD_HASH__", hash);
  if (stamped.includes("__BUILD_HASH__")) {
    throw new Error("service worker still contains __BUILD_HASH__ after stamping");
  }
  await writeFile(swPath, stamped);
  console.log(`service worker stamped with build ${hash}`);
}

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();

  await stampServiceWorker();

  console.log("building SSR bundle...");
  // A second Vite build of the server render entry (client/src/entry-server.tsx), the
  // production counterpart of `vite.ssrLoadModule` in server/vite.ts. It emits an ES
  // module at dist/server/entry-server.js that server/ssr-react.ts imports at request time.
  //
  // vite.config.ts is still loaded (root `client/`, React plugin, aliases) and these
  // overrides merged on top, like the client build above.
  process.env.SKALE_SSR_BUILD = "1";
  await viteBuild({
    // Bundle every npm dependency in: the production image ships the esbuild'd server and
    // `dist/`, and a bare `import "react"` in the SSR output would not resolve there.
    ssr: { noExternal: true },
    build: {
      ssr: "src/entry-server.tsx",
      // Relative to the `client/` root: lands next to dist/public, as dist/server.
      outDir: "../dist/server",
      // Never empty dist/public (just built) or dist/ itself.
      emptyOutDir: false,
      ssrEmitAssets: false,
      // The client build already copied public/ into dist/public.
      copyPublicDir: false,
      // Only our own process reads this bundle: minifying buys nothing and unreadable
      // stack traces cost. No source map either: it would hold every bundled module.
      minify: false,
      sourcemap: false,
    },
  });
  delete process.env.SKALE_SSR_BUILD;

  // Inject SEO data after client build
  await injectSEO();

  console.log("\nbuilding server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    logLevel: "info",
  });

  // Preloaded with `node --require ./dist/instrument.cjs dist/index.cjs` so
  // Sentry initialises (and patches express/pg) before the app is required.
  await esbuild({
    entryPoints: ["server/instrument.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/instrument.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    logLevel: "info",
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
