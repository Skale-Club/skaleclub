import crypto from "node:crypto";

/** 8 random bytes rendered in base36 (about 13 chars): unguessable slug suffix. */
export function randomSlugSuffix(): string {
  return BigInt("0x" + crypto.randomBytes(8).toString("hex")).toString(36);
}
