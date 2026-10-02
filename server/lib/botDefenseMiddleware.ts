// Express adapter for the shared bot-defense core (./botDefense.ts).
//
//  clientIpMiddleware   — makes req.ip the real visitor IP for everything
//    downstream (every rate limit, Turnstile's remoteip, the IP hashes).
//    A fixed TRUST_PROXY_HOPS cannot be right for every host at once: behind
//    Cloudflare -> Traefik the visitor is two hops out, for a host that is not
//    on Cloudflare it is one. This walks the chain right-to-left and honours
//    CF-Connecting-IP only when the peer is a real Cloudflare edge.
//  botDefenseMiddleware — banned IPs get 403; scanner trap paths (/.env,
//    /.git/, xmlrpc.php, …) get 404 plus an escalating ban (1h → 24h → 7d).
//    /api/health is never blocked. BOT_DEFENSE_MODE=log|off to dial down.
import type { NextFunction, Request, Response } from "express";
import { banRemainingMs, checkTrap, resolveClientIp } from "./botDefense.js";

export function clientIpMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const ip = resolveClientIp({
    forwardedFor: req.headers["x-forwarded-for"],
    cfConnectingIp: req.headers["cf-connecting-ip"],
    remoteAddress: req.socket?.remoteAddress,
  });
  if (ip) {
    // Shadow Express's req.ip getter on this request only.
    Object.defineProperty(req, "ip", { value: ip, configurable: true, enumerable: true, writable: false });
  }
  next();
}

export function botDefenseMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (req.path === "/api/health") return next();
  const ip = req.ip ?? null;
  const remaining = banRemainingMs(ip);
  if (remaining > 0) {
    res.set("Cache-Control", "no-store");
    res.set("Retry-After", String(Math.ceil(remaining / 1000)));
    res.status(403).type("text/plain").send("Forbidden");
    return;
  }
  if (checkTrap(req.path, ip, req.get("user-agent")).trapped) {
    res.set("Cache-Control", "no-store");
    res.status(404).type("text/plain").send("Not Found");
    return;
  }
  next();
}
