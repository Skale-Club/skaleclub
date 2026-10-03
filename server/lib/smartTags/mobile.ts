import { desc, eq } from "drizzle-orm";
import { db } from "../../db.js";
import {
  smartTagCustomers,
  smartTagDestinationHistory,
  smartTagDirectWrites,
  smartTagProvisioningEvents,
  smartTags,
  type SmartTag,
} from "#shared/schema.js";
import { buildSmartTagUrls, defaultUtmEnabled } from "#shared/smartTags.js";
import { decidePhoneWrite, type DirectWriteItem, type DirectWriteMethod } from "#shared/nfcApp.js";
import { SmartTagError } from "./repository.js";

// Server side of the Skale NFC phone app (/nfc). Same rules as the admin
// panel, packed into the few one-shot operations a phone needs.

export interface QuickActivateInput {
  destinationUrl: string;
  destinationType: string;
  /** An existing customer, or… */
  customerId?: string | null;
  /** …the name of a new one, created in the same transaction. */
  customerName?: string | null;
  label?: string | null;
}

/**
 * Link + customer + activation in one transaction: the phone flow is "tap the
 * piece, paste the link, done". Keeps every rule of the step-by-step admin
 * flow (history row, no owner change on a live tag, retired stays retired).
 */
export async function quickActivateTag(id: string, input: QuickActivateInput, userId: string | null): Promise<SmartTag> {
  return db.transaction(async (tx) => {
    const [tag] = await tx.select().from(smartTags).where(eq(smartTags.id, id)).for("update");
    if (!tag) throw new SmartTagError("Tag not found", 404);
    if (tag.status === "retired") throw new SmartTagError("A retired tag cannot be edited", 409);

    let customerId = tag.customerId;
    const newName = input.customerName?.trim();
    if (input.customerId && input.customerId !== tag.customerId) {
      const [customer] = await tx.select({ id: smartTagCustomers.id }).from(smartTagCustomers).where(eq(smartTagCustomers.id, input.customerId));
      if (!customer) throw new SmartTagError("Customer not found", 404);
      customerId = customer.id;
    } else if (!input.customerId && newName) {
      const [customer] = await tx.insert(smartTagCustomers).values({ businessName: newName }).returning({ id: smartTagCustomers.id });
      customerId = customer.id;
    }
    if (!customerId) throw new SmartTagError("Assign a customer before activating", 409);

    const changingOwner = customerId !== tag.customerId;
    if (changingOwner && tag.customerId && tag.status === "active") {
      throw new SmartTagError("Disable the tag before moving it to another customer", 409);
    }

    const now = new Date();
    if (tag.destinationUrl !== input.destinationUrl || tag.destinationType !== input.destinationType) {
      await tx.insert(smartTagDestinationHistory).values({
        tagId: tag.id,
        previousUrl: tag.destinationUrl,
        newUrl: input.destinationUrl,
        previousDestinationType: tag.destinationType,
        newDestinationType: input.destinationType,
        changedByUserId: userId,
        reason: changingOwner && tag.customerId ? "Re-assigned to another customer (NFC app)" : "Configured in the NFC app",
      });
    }

    // UTMs follow the admin default the first time a destination is set (or
    // when the piece changes hands); an admin's later choice is kept.
    const keepUtm = !!tag.destinationUrl && !changingOwner && tag.destinationType === input.destinationType;
    const [updated] = await tx
      .update(smartTags)
      .set({
        customerId,
        destinationUrl: input.destinationUrl,
        destinationType: input.destinationType,
        utmEnabled: keepUtm ? tag.utmEnabled : defaultUtmEnabled(input.destinationType),
        utmCampaign: changingOwner ? null : tag.utmCampaign,
        ...(input.label !== undefined ? { label: input.label } : {}),
        status: "active",
        assignedAt: changingOwner || !tag.assignedAt ? now : tag.assignedAt,
        activatedAt: tag.status === "active" ? tag.activatedAt : now,
        disabledAt: null,
        updatedAt: now,
      })
      .where(eq(smartTags.id, id))
      .returning();
    console.log(`[smart-tags] quick-activate ${tag.publicCode}: ${tag.status} → active (user ${userId ?? "?"})`);
    return updated;
  });
}

/**
 * The phone wrote (or the operator wrote through another app) the tag's NFC
 * URL into the chip. The server decides what that proves — see decidePhoneWrite.
 */
export async function recordPhoneWrite(
  id: string,
  report: { readbackUrl?: string | null; method: DirectWriteMethod },
  baseUrl: string,
  userId: string | null,
) {
  return db.transaction(async (tx) => {
    const [tag] = await tx.select().from(smartTags).where(eq(smartTags.id, id)).for("update");
    if (!tag) throw new SmartTagError("Tag not found", 404);
    const { nfcUrl } = buildSmartTagUrls(baseUrl, tag.publicCode);
    const decision = decidePhoneWrite(nfcUrl, report.readbackUrl);
    const now = new Date();
    await tx
      .update(smartTags)
      .set({
        nfcProvisioningStatus: decision.status,
        nfcProgrammedAt: decision.ok ? now : tag.nfcProgrammedAt,
        nfcVerifiedAt: decision.status === "verified" ? now : null,
        nfcProvisioningDeviceId: null,
        updatedAt: now,
      })
      .where(eq(smartTags.id, id));
    await tx.insert(smartTagProvisioningEvents).values({
      jobId: null,
      tagId: tag.id,
      deviceId: null,
      eventType: decision.status === "verified" ? "verification_passed" : decision.ok ? "write_completed" : "verification_failed",
      detail: { source: "nfc_app", method: report.method, userId: userId ?? null },
    });
    console.log(`[smart-tags] phone write ${tag.publicCode}: ${decision.status} (${report.method}, user ${userId ?? "?"})`);
    if (!decision.ok) throw new SmartTagError(decision.error, 409);
    return { status: decision.status, expectedUrl: nfcUrl };
  });
}

// ─── Direct pieces ────────────────────────────────────────────────────────────

export interface DirectWriteInput {
  url: string;
  label?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  method: DirectWriteMethod;
  verified: boolean;
}

export async function recordDirectWrite(input: DirectWriteInput, userId: string | null): Promise<{ id: string }> {
  return db.transaction(async (tx) => {
    let customerId: string | null = null;
    const newName = input.customerName?.trim();
    if (input.customerId) {
      const [customer] = await tx.select({ id: smartTagCustomers.id }).from(smartTagCustomers).where(eq(smartTagCustomers.id, input.customerId));
      if (!customer) throw new SmartTagError("Customer not found", 404);
      customerId = customer.id;
    } else if (newName) {
      const [customer] = await tx.insert(smartTagCustomers).values({ businessName: newName }).returning({ id: smartTagCustomers.id });
      customerId = customer.id;
    }
    const [row] = await tx
      .insert(smartTagDirectWrites)
      .values({
        customerId,
        url: input.url,
        label: input.label ?? null,
        method: input.method,
        verified: input.verified,
        writtenByUserId: userId,
      })
      .returning({ id: smartTagDirectWrites.id });
    return row;
  });
}

export async function listDirectWrites(limit = 30): Promise<DirectWriteItem[]> {
  const list = await db
    .select({
      id: smartTagDirectWrites.id,
      url: smartTagDirectWrites.url,
      label: smartTagDirectWrites.label,
      customerId: smartTagDirectWrites.customerId,
      customerName: smartTagCustomers.businessName,
      method: smartTagDirectWrites.method,
      verified: smartTagDirectWrites.verified,
      createdAt: smartTagDirectWrites.createdAt,
    })
    .from(smartTagDirectWrites)
    .leftJoin(smartTagCustomers, eq(smartTagCustomers.id, smartTagDirectWrites.customerId))
    .orderBy(desc(smartTagDirectWrites.createdAt))
    .limit(Math.min(Math.max(limit, 1), 100));
  return list.map((r) => ({ ...r, customerName: r.customerName ?? null, createdAt: new Date(r.createdAt).toISOString() }));
}
