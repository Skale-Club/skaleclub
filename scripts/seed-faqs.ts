import "dotenv/config";
import { db } from "../server/db";
import { faqs } from "../shared/schema";
import { DEFAULT_FAQS } from "../shared/defaults/cms";

async function seedFaqs() {
  try {
    console.log("Starting FAQ seeding...");

    const existing = await db.select().from(faqs);

    if (existing.length > 0) {
      console.log(`Found ${existing.length} existing FAQs. Skipping seed.`);
      return;
    }

    for (const faq of DEFAULT_FAQS) {
      await db.insert(faqs).values(faq);
      console.log(`Created: \"${faq.question.substring(0, 50)}...\"`);
    }

    console.log(`\nSuccessfully seeded ${DEFAULT_FAQS.length} FAQs.`);
  } catch (error) {
    console.error("Error seeding FAQs:", error);
    process.exit(1);
  }
}

seedFaqs();
