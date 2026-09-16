import "dotenv/config";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "../server/db";
import { companySettings } from "../shared/schema";
import type { OurServicesCard } from "../shared/schema";
import { eq } from "drizzle-orm";

/**
 * Adds "3D Printing" to the homepage "Our Services" section.
 *
 * These cards live in `company_settings.homepage_content.ourServicesSection`
 * (admin-managed) rather than in the `portfolio_services` table, which holds the
 * six X-branded products. 3D printing is a service we perform, not a subscription
 * product, so it belongs here alongside Paid Advertising and Branding.
 *
 * Idempotent: re-running updates the existing card in place instead of appending
 * a duplicate. Run with `npx tsx scripts/add-3d-printing-service.ts`.
 *
 * Image: the seven existing cards point at Supabase Storage
 * (`uploads/service-images/<slug>.jpg`), not at files in the repo, because the
 * Docker image only ships what is committed. This script does the same: it
 * looks for `client/public/service-images/3d-printing.{jpg,png,webp}` (produced
 * by `ONLY=3d-printing npm run gen:service-images`), uploads it to that same
 * path in the bucket, and stores the public URL. Without the file it still
 * inserts the card, with an empty image, and says so; re-run after generating.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const IMAGE_SLUG = "3d-printing";
const BUCKET = "uploads";

async function uploadServiceImage(): Promise<string> {
  const candidates = ["jpg", "jpeg", "png", "webp"].map((ext) => ({
    ext,
    path: join(__dirname, "..", "client", "public", "service-images", `${IMAGE_SLUG}.${ext}`),
  }));
  const found = candidates.find((c) => existsSync(c.path));
  if (!found) {
    console.warn(
      `No client/public/service-images/${IMAGE_SLUG}.{jpg,png,webp} found. ` +
        `Generate it with: ONLY=${IMAGE_SLUG} npm run gen:service-images — then re-run this script.`,
    );
    return "";
  }

  const { getSupabaseAdmin } = await import("../server/lib/supabase");
  const supabase = getSupabaseAdmin();
  const contentType = found.ext === "png" ? "image/png" : found.ext === "webp" ? "image/webp" : "image/jpeg";
  const objectPath = `service-images/${IMAGE_SLUG}.${found.ext === "jpeg" ? "jpg" : found.ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(objectPath, readFileSync(found.path), { contentType, upsert: true });
  if (error) throw new Error(`Upload of ${objectPath} failed: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
  console.log(`Uploaded ${found.path} -> ${data.publicUrl}`);
  return data.publicUrl;
}

const CARD: Omit<OurServicesCard, "order" | "imageUrl"> = {
  enabled: true,
  title: "3D Printing",
  subtitle: "Custom parts and branded pieces",
  description:
    "Custom 3D-printed pieces for your business: branded NFC keychains, display stands, " +
    "signage parts, prototypes and replacement parts. We prepare the file from your logo or " +
    "drawing, print it, and test every piece before it ships.",
  features: ["Branded keychains", "Prototypes", "Custom parts"],
};

async function main() {
  const rows = await db.select().from(companySettings).where(eq(companySettings.id, 1));
  if (rows.length === 0) {
    console.error("No company_settings row with id=1. Seed the database first.");
    process.exitCode = 1;
    return;
  }

  const imageUrl = await uploadServiceImage();
  const current = rows[0];
  const homepageContent = current.homepageContent ?? {};
  const section = homepageContent.ourServicesSection ?? {};
  const cards: OurServicesCard[] = [...(section.cards ?? [])];

  const existingIndex = cards.findIndex(
    (c) => c.title.trim().toLowerCase() === CARD.title.toLowerCase(),
  );

  if (existingIndex >= 0) {
    // Keep an image the admin may have set by hand when this run has none.
    cards[existingIndex] = {
      ...cards[existingIndex],
      ...CARD,
      imageUrl: imageUrl || cards[existingIndex].imageUrl || "",
    };
    console.log(`Updated existing "${CARD.title}" card (position ${existingIndex + 1}).`);
  } else {
    const nextOrder = cards.reduce((max, c) => Math.max(max, c.order ?? 0), 0) + 1;
    cards.push({ ...CARD, imageUrl, order: nextOrder });
    console.log(`Appended "${CARD.title}" card at order ${nextOrder}.`);
  }

  await db
    .update(companySettings)
    .set({
      homepageContent: {
        ...homepageContent,
        ourServicesSection: { ...section, cards },
      },
    })
    .where(eq(companySettings.id, 1));

  console.log(`Done. "Our Services" now has ${cards.length} cards:`);
  for (const c of [...cards].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))) {
    console.log(`  ${c.order}. ${c.title}${c.enabled === false ? " (disabled)" : ""}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
