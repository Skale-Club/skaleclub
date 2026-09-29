import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile, writeFile } from "fs/promises";
import { spawn } from "child_process";

// server deps to bundle to reduce openat(2) syscalls
// which helps cold start times
const allowlist = [
  "@google/generative-ai",
  "axios",
  "connect-pg-simple",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "passport",
  "passport-local",
  "pg",
  "stripe",
  "uuid",
  "ws",
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
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
