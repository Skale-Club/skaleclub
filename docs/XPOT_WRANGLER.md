# Xpot via Wrangler

This repo now includes a Cloudflare Worker configuration for `xpot.skale.club`.

## What it does

- Publishes a Worker on the custom domain `xpot.skale.club`
- Proxies app traffic to `https://skale.club/xpot`
- Passes through API, assets, icons, manifests, and service worker files without path prefixing
- Lets the existing Vercel app remain the upstream origin

## Files

- `wrangler.jsonc`
- `cloudflare/xpot-proxy.ts`

## Commands

```bash
npm install
npm run cf:dev
npm run cf:deploy
```

## Notes

- `XPOT_UPSTREAM_ORIGIN` defaults to `https://skale.club`
- `XPOT_UPSTREAM_PREFIX` defaults to `/xpot`
- If you want a staging origin, change the vars in `wrangler.jsonc` or move them to an environment block
- You still need Cloudflare auth locally before deploy:

```bash
npx wrangler login
```
