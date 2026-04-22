import "dotenv/config";
import { db } from "../server/db";
import { companySettings } from "../shared/schema";
import { DEFAULT_COMPANY_SETTINGS_SEED } from "../shared/defaults/cms";

async function seedTechContent() {
  try {
    console.log("Seeding tech company content...\n");

    const existing = await db.select().from(companySettings).limit(1);

    if (existing.length === 0) {
      await db.insert(companySettings).values(DEFAULT_COMPANY_SETTINGS_SEED);
      console.log("Created new company settings with tech content");
    } else {
      await db.update(companySettings).set(DEFAULT_COMPANY_SETTINGS_SEED);
      console.log("Updated company settings with tech content");
    }

    console.log("\nContent seeded successfully.");
  } catch (error) {
    console.error("Error seeding tech content:", error);
    process.exit(1);
  }
}

seedTechContent();
