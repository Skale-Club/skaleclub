
import { createClient } from "@supabase/supabase-js";
import { db } from "../server/db";
import { users } from "../shared/schema";
import { eq } from "drizzle-orm";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing Supabase credentials (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)");
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function syncUsers() {
  console.log("Fetching users from Supabase Auth...");
  
  // Pagination might be needed if there are many users, but for now listUsers defaults to 50
  const { data: { users: authUsers }, error } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000
  });

  if (error) {
    console.error("Error fetching users:", error);
    process.exit(1);
  }

  console.log(`Found ${authUsers.length} users.`);

  let createdCount = 0;
  let updatedCount = 0;

  for (const authUser of authUsers) {
    const existingUser = await db.query.users.findFirst({
      where: eq(users.id, authUser.id),
    });

    const firstName = authUser.user_metadata?.first_name || authUser.user_metadata?.name?.split(' ')[0] || "";
    const lastName = authUser.user_metadata?.last_name || authUser.user_metadata?.name?.split(' ').slice(1).join(' ') || "";
    const profileImageUrl = authUser.user_metadata?.avatar_url || "";

    if (!existingUser) {
      console.log(`Creating user: ${authUser.email}`);
      await db.insert(users).values({
        id: authUser.id,
        email: authUser.email || "",
        firstName,
        lastName,
        profileImageUrl,
        isAdmin: false, // Default to false, manual promotion required
      });
      createdCount++;
    } else {
        // Optional: Update user details if changed in Auth (though Auth metadata isn't always source of truth)
        // For now, we skip updating to avoid overwriting local changes
      console.log(`User already exists: ${authUser.email}`);
    }
  }

  console.log(`Sync complete. Created: ${createdCount}, Existing: ${updatedCount}`);
  process.exit(0);
}

syncUsers().catch(err => {
    console.error("Unexpected error:", err);
    process.exit(1);
});
