import "dotenv/config";
import { db } from "../server/db";
import { companySettings } from "../shared/schema";
import { eq } from "drizzle-orm";

async function fixOgImage() {
  console.log("Fetching current settings...");
  const settings = await db.select().from(companySettings).where(eq(companySettings.id, 1));
  
  if (!settings || settings.length === 0) {
    console.log("No settings found.");
    return;
  }

  const current = settings[0];
  console.log("\nCurrent ogImage:", current.ogImage);
  console.log("Current heroImageUrl:", current.heroImageUrl);

  // Use heroImageUrl as ogImage if ogImage is empty
  const ogImage = current.heroImageUrl || "";

  console.log("\nUpdating ogImage to:", ogImage);

  await db
    .update(companySettings)
    .set({ ogImage })
    .where(eq(companySettings.id, 1));

  console.log("\n✅ OG Image updated successfully!");

  // Verify
  const updated = await db.select().from(companySettings).where(eq(companySettings.id, 1));
  console.log("\nVerifying updated ogImage:", updated[0].ogImage);
  
  process.exit(0);
}

fixOgImage().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
