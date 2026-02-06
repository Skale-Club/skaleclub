import { build as viteBuild } from "vite";
import { rm } from "fs/promises";
import { spawn } from "child_process";

async function injectSEO() {
  return new Promise<void>((resolve) => {
    console.log("\nInjecting dynamic SEO data...");
    const child = spawn("tsx", ["scripts/inject-seo-build.ts"], {
      stdio: "inherit",
      shell: true,
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        console.warn("SEO injection had warnings, but build continues...");
        resolve();
      }
    });

    child.on("error", (err) => {
      console.warn("SEO injection error:", err.message);
      resolve();
    });
  });
}

async function buildVercel() {
  await rm("dist", { recursive: true, force: true });

  console.log("Building client for Vercel...");
  await viteBuild();

  // Try to inject SEO data (may fail if DB not available at build time)
  await injectSEO();

  // No server build needed - Vercel compiles api/index.ts as a serverless function
  console.log("\nVercel build complete. Output: dist/public/");
}

buildVercel().catch((err) => {
  console.error(err);
  process.exit(1);
});
