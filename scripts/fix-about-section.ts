import "dotenv/config";
import { db } from "../server/db";
import { companySettings } from "../shared/schema";
import { eq } from "drizzle-orm";

async function fixAboutSection() {
  console.log("Fetching current settings...");
  const settings = await db.select().from(companySettings).where(eq(companySettings.id, 1));
  
  if (!settings || settings.length === 0) {
    console.log("No settings found.");
    return;
  }

  const current = settings[0];
  console.log("\nCurrent aboutSection:", JSON.stringify(current.homepageContent?.aboutSection, null, 2));

  const aboutSection = {
    label: "About Us",
    heading: "Who We Are",
    description: "We are experts in helping Brazilian entrepreneurs scale their service businesses in the USA. Through personalized 1-on-1 mentorship, we teach digital marketing strategies that generate real clients with predictability.",
    defaultImageUrl: "",
    highlights: [
      {
        title: "Excellence",
        description: "Commitment to quality in every delivery."
      },
      {
        title: "Experience",
        description: "Years of experience in the American market."
      },
      {
        title: "Personalized Service",
        description: "Solutions tailored just for you."
      }
    ]
  };

  console.log("\nUpdating aboutSection to:", JSON.stringify(aboutSection, null, 2));

  const updatedHomepageContent = {
    ...(current.homepageContent || {}),
    aboutSection
  };

  await db
    .update(companySettings)
    .set({ homepageContent: updatedHomepageContent })
    .where(eq(companySettings.id, 1));

  console.log("\n✅ About section updated successfully!");

  // Verify
  const updated = await db.select().from(companySettings).where(eq(companySettings.id, 1));
  console.log("\nVerifying updated aboutSection:", JSON.stringify(updated[0].homepageContent?.aboutSection, null, 2));
  
  process.exit(0);
}

fixAboutSection().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
