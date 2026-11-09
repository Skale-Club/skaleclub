import type { IdentityBinding } from "./googleIdentityStore.js";

/** Lookups the resolver needs; injected so the resolution order is unit-testable without a database. */
export interface AccountLookups<U> {
  userIdForIdentity(binding: IdentityBinding): Promise<string | null>;
  userById(id: string): Promise<U | null>;
  userByPhone(phone: string): Promise<U | null>;
  /** Rows whose lower(email) equals the email; the resolver only asks for up to 2. */
  usersByEmail(email: string, limit: number): Promise<U[]>;
}

/**
 * Which existing user a verified identity signs in, in this order:
 *  a. the stored binding (project_id, subject) to a user;
 *  b. phone provider: users.phone equals the verified E.164 phone;
 *  c. Google provider: exactly one user whose lower(email) equals the verified
 *     email (the caller passes `binding.email` only when email_verified was true).
 * Returns null for an unknown identity; this app is invite-only, so nothing is created.
 */
export async function resolveAccount<U>(
  lookups: AccountLookups<U>,
  binding: IdentityBinding,
  phone?: string,
): Promise<U | null> {
  const linkedId = await lookups.userIdForIdentity(binding);
  if (linkedId) {
    const linked = await lookups.userById(linkedId);
    if (linked) return linked;
  }
  if (binding.provider === "phone") {
    return phone ? lookups.userByPhone(phone) : null;
  }
  if (binding.provider === "google.com" && binding.email) {
    const matches = await lookups.usersByEmail(binding.email, 2);
    // Never when two accounts share the email: that would be a guess.
    if (matches.length === 1) return matches[0];
  }
  return null;
}
