
import "dotenv/config";
import { db } from "../server/db";
import { companySettings, chatSettings } from "../shared/schema";

async function checkSettings() {
  try {
    const settings = await db.select().from(companySettings).limit(1);
    const chat = await db.select().from(chatSettings).limit(1);
    console.log("Current Settings:", JSON.stringify(settings, null, 2));
    console.log("Current Chat Settings:", JSON.stringify(chat, null, 2));
    process.exit(0);
  } catch (error) {
    console.error("Error checking settings:", error);
    process.exit(1);
  }
}

checkSettings();
