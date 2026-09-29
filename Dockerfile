# syntax=docker/dockerfile:1
#
# Shared Coolify/Hetzner host — the base tag MUST stay `node:24-alpine`,
# identical across every app on the box, so Docker stores one base layer and
# reuses it. See skaleclub-apps/COOLIFY.md → "Disk discipline (shared host)".

FROM node:24-alpine AS base
# glibc shim that sharp's prebuilt binary needs on musl.
RUN apk add --no-cache libc6-compat
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Build-time inputs. Vite inlines VITE_* at build, @sentry/vite-plugin uploads
# sourcemaps when SENTRY_AUTH_TOKEN is present, and scripts/inject-seo-build.ts
# reads companySettings from Postgres to pre-render SEO meta into
# dist/public/index.html (it warns and falls back to defaults without a URL).
ARG VITE_SENTRY_DSN
ARG VITE_CANONICAL_ORIGIN
ARG SENTRY_AUTH_TOKEN
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN \
    VITE_CANONICAL_ORIGIN=$VITE_CANONICAL_ORIGIN \
    SENTRY_AUTH_TOKEN=$SENTRY_AUTH_TOKEN
# POSTGRES_URL is only needed by the SEO inject step, so it is NOT an ENV (it
# would otherwise be visible to every later command in this stage). Preferred:
# a BuildKit secret `postgres_url` (docker build --secret id=postgres_url,...).
# Fallback: the POSTGRES_URL build arg Coolify passes today, which keeps working
# where build secrets are not configured. Only the runner stage is shipped, so
# neither value reaches the final image. With neither set the build still
# succeeds and falls back to default SEO tags.
ARG POSTGRES_URL
# vite build -> dist/public, esbuild -> dist/index.cjs + dist/instrument.cjs
RUN --mount=type=secret,id=postgres_url \
    if [ -s /run/secrets/postgres_url ]; then POSTGRES_URL="$(cat /run/secrets/postgres_url)"; fi; \
    export POSTGRES_URL; \
    npm run build

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=8888
# script/build.ts bundles only an allowlist into dist/index.cjs; everything
# else (sharp, @supabase/supabase-js, @sentry/node, twilio, resend, openai,
# @google/genai, helmet, dotenv, …) stays external and must exist at runtime.
# --ignore-scripts: runtime deps need no postinstall, and sharp's musl binary
# is a plain file extraction.
# Run as the unprivileged `node` user that ships with node:alpine.
RUN chown node:node /app
USER node
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=builder --chown=node:node /app/dist ./dist
EXPOSE 8888
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8888/api/health || exit 1
# instrument.cjs is preloaded so Sentry can patch express/pg before they load.
CMD ["node", "--require", "./dist/instrument.cjs", "dist/index.cjs"]
