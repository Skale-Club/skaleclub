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
ARG POSTGRES_URL
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN \
    VITE_CANONICAL_ORIGIN=$VITE_CANONICAL_ORIGIN \
    SENTRY_AUTH_TOKEN=$SENTRY_AUTH_TOKEN \
    POSTGRES_URL=$POSTGRES_URL
# vite build -> dist/public, esbuild -> dist/index.cjs
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=8888
# script/build.ts bundles only an allowlist into dist/index.cjs; everything
# else (sharp, @supabase/supabase-js, @sentry/node, twilio, resend, openai,
# @google/genai, helmet, dotenv, …) stays external and must exist at runtime.
# --ignore-scripts: runtime deps need no postinstall, and sharp's musl binary
# is a plain file extraction.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=builder /app/dist ./dist
EXPOSE 8888
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8888/api/health || exit 1
CMD ["node", "dist/index.cjs"]
