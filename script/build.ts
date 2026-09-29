import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile } from "fs/promises";
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

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();

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
