import "dotenv/config";
import { ensure3dPrintingService } from "../server/lib/contentFixes";

/**
 * Adds the "3D Printing" card to the homepage "Our Services" section and
 * generates its image. The server does the same by itself after every boot
 * (server/lib/bootstrapTasks.ts); this is the shell entry point.
 */
ensure3dPrintingService()
  .then((result) => {
    console.log(result.done ? "done" : "pending (will retry at next boot)");
    for (const n of result.notes) console.log(`  - ${n}`);
  })
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
