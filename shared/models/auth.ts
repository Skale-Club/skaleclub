// This module is a thin re-export of the canonical `users`/`sessions` table
// definitions. The real source of truth lives in `../schema/auth.ts` (re-exported
// via the `#shared/schema.js` barrel) — do not redefine these tables here.
export { users, sessions } from "../schema/auth.js";
export type { User, UpsertUser } from "../schema/auth.js";
