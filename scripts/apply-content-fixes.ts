import "dotenv/config";
import { applyContentFixes, syncProductArtwork } from "../server/lib/contentFixes";

/**
 * Manual entry point for the content fixes. The server applies the same
 * tasks by itself after every boot (server/lib/bootstrapTasks.ts); this is
 * for running them from a shell with a production .env.
 */
async function main() {
  for (const [name, fn] of [["content fixes", applyContentFixes], ["product artwork", syncProductArtwork]] as const) {
    const result = await fn();
    console.log(`${name}: ${result.done ? "done" : "pending"}`);
    for (const n of result.notes) console.log(`  - ${n}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
