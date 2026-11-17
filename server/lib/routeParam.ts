import type { Request } from "express";

/** Named resource parameters are scalars. Express 5 also permits wildcard
 * arrays, which must never be silently coerced into an id or slug. */
export function routeParam(req: Pick<Request, "params">, name: string): string {
  const value = req.params[name];
  if (typeof value !== "string") {
    throw Object.assign(new Error("Invalid route parameter"), { status: 400 });
  }
  return value;
}
