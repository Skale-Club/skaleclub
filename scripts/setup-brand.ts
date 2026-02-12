#!/usr/bin/env tsx

import { readFileSync, existsSync } from "fs";
import path from "path";
import { eq } from "drizzle-orm";

type BrandPayload = Record<string, unknown>;

function parseArgs() {
  const args = process.argv.slice(2);
  const fileFlagIndex = args.findIndex((arg) => arg === "--file" || arg === "-f");
  const file = fileFlagIndex >= 0 ? args[fileFlagIndex + 1] : undefined;
  return { file };
}

function loadPayload(filePath: string): BrandPayload {
  const absolute = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(process.cwd(), filePath);

  if (!existsSync(absolute)) {
    throw new Error(`Brand file not found: ${absolute}`);
  }

  const raw = readFileSync(absolute, "utf-8");
  const payload = JSON.parse(raw) as BrandPayload;

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Brand file must contain a JSON object");
  }

  return payload;
}

async function setupBrand() {
  const { file } = parseArgs();

  if (!file) {
    throw new Error("Missing --file argument. Example: npm run setup:brand -- --file ./brand.json");
  }

  const payload = loadPayload(file);

  const [{ db }, { companySettings }] = await Promise.all([
    import("../server/db"),
    import("../shared/schema"),
  ]);

  const currentRows = await db.select().from(companySettings).limit(1);
  const current = currentRows[0];

  if (!current) {
    const [created] = await db.insert(companySettings).values(payload).returning();
    console.log("Brand bootstrap created company settings:", created.id);
    return;
  }

  const [updated] = await db
    .update(companySettings)
    .set(payload)
    .where(eq(companySettings.id, current.id))
    .returning();

  console.log("Brand bootstrap updated company settings:", updated.id);
}

setupBrand()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("setup-brand failed:", error);
    process.exit(1);
  });
