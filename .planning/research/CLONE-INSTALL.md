# Phase 0: Clone & Install — Research

**Project:** get-shit-done (GSD)
**Research date:** 2026-03-30
**Subject:** Cloning GitHub App repos and installing dependencies
**Confidence:** HIGH

---

## Three Target Repositories

| # | Full name | Visibility | Expected size | Root language |
|---|-----------|------------|---------------|---------------|
| 1 | `PGS-Powered/gpt-crawler` | **Likely private** (404 when unauthenticated) | ~50 files | Node.js |
| 2 | `ishaan1013/shade` | **Likely private** (404 — the public repo is `ishaan1013/shadow`) | Monorepo ~300+ files | Node.js |
| 3 | `Nutlope/napkins` | **Public** | ~50 files | Node.js |

### Repo 1 — PGS-Powered/gpt-crawler
- Based on `BuilderIO/gpt-crawler` (the public upstream).
- `package.json` uses **npm** (`"npm i"` in README).
- `"type": "module"` — ESM-first.
- `scripts.preinstall` runs `npx playwright install` (auto-downloads browsers).
- Dev deps: TypeScript 5, ts-node, husky, semantic-release.

### Repo 2 — ishaan1013/shade
- **Public repo name is `ishaan1013/shadow`.** `shade` returns 404.
- Turborepo monorepo (`"packageManager": "npm@10.9.2"`).
- Workspaces: `apps/*`, `packages/*`.
- Requires **Node.js ≥ 18** (README says 22).
- External deps: **PostgreSQL** (Prisma), optionally **Pinecone**.
- Dev setup: `cp .env.template .env` for three separate `.env` files.

### Repo 3 — Nutlope/napkins
- Public **Next.js 14** app.
- Uses **npm** (no lockfile type specified; `npm install` in README).
- Requires **Together AI API key** + **S3 bucket** for full functionality.
- TypeScript 5, Tailwind CSS 3.

## Cloning Methods

### Method A — `gh repo clone` (RECOMMENDED)

`gh` uses your **logged-in GitHub session** and automatically handles HTTPS tokens, SSH keys, and GitHub App installation tokens.

```bash
gh auth status          # check if logged in
gh repo clone OWNER/REPO DEST_DIR
```

**How it works:**
- `gh` asks the GitHub API for a clone URL and authenticates with your stored OAuth token.
- If the repo belongs to a GitHub App installation, `gh` will use your personal token to clone — this works as long as your user account has access to the repo.

**Pros:** Zero config, works with HTTPS tokens and SSH keys, automatically detects access method.
**Cons:** Requires `gh` CLI installed and authenticated.

### Method B — HTTPS with token

```bash
git clone https://oauth2:${GITHUB_TOKEN}@github.com/OWNER/REPO.git
# or
git clone https://x-access-token:${GITHUB_TOKEN}@github.com/OWNER/REPO.git
```

**GitHub App installation token format:**
```bash
git clone https://x-access-token:${INSTALLATION_TOKEN}@github.com/OWNER/REPO.git
```

**Pros:** Works anywhere, scriptable.
**Cons:** Token in URL (leaks in shell history/logs); installation tokens expire after 1 hour.

### Method C — SSH

```bash
git clone git@github.com:OWNER/REPO.git
```

**Pros:** No token expiry, standard git workflow.
**Cons:** Requires SSH key added to GitHub account (or GitHub App SSH key configured).

### Method D — `gh api` + installation token (for GitHub App-specific access)

```bash
INSTALLATION_ID=$(gh api repos/OWNER/REPO/installation --jq '.id')
TOKEN=$(gh api -X POST "app/installations/${INSTALLATION_ID}/access_tokens" --jq '.token')
git clone https://x-access-token:${TOKEN}@github.com/OWNER/REPO.git
```

**Pros:** Uses GitHub App permissions specifically (not user permissions).
**Cons:** Complex, tokens expire in 1 hour, only needed if user access isn't enough.

## Which method to use

| Scenario | Method |
|----------|--------|
| `gh` is installed & authenticated | **A** (`gh repo clone`) |
| Only `git` available, PAT available | **B** (HTTPS + token) |
| SSH key configured | **C** (SSH) |
| Access denied with user token, need App token | **D** |

**Recommendation:** Method A (`gh repo clone`) is simplest. Fall back to B if `gh` isn't available.

## Dependency Installation

Each repo uses **npm** — no bun or pnpm detected.

| Repo | Install command | Notes |
|------|----------------|-------|
| PGS-Powered/gpt-crawler | `npm i` | `preinstall` hook runs `npx playwright install` (downloads ~400 MB of browsers) |
| ishaan1013/shade | `npm install` | Turborepo workspace install; then `npm run generate` (Prisma) |
| Nutlope/napkins | `npm install` | Plain Next.js install |

### Post-install steps per repo

**PGS-Powered/gpt-crawler:**
```bash
cd gpt-crawler
npm i                    # triggers playwright install
npm run build            # tsc
```

**ishaan1013/shade:**
```bash
cd shade
npm install
# Setup .env files:
cp apps/server/.env.template apps/server/.env
cp apps/frontend/.env.template apps/frontend/.env
cp packages/db/.env.template packages/db/.env
npm run generate         # prisma generate
npm run db:push          # requires local PostgreSQL
npm run dev              # turbo dev
```

**Nutlope/napkins:**
```bash
cd napkins
npm install
cp .env.example .env     # add TOGETHER_API_KEY
npm run dev
```

## Error handling: common `git clone` failures

| Error | Cause | Fix |
|-------|-------|-----|
| `Repository not found` | Repo is private, or wrong name | Check name; use `gh auth login` or token |
| `Permission denied (publickey)` | SSH key not configured | `ssh-keygen` + add to GitHub, or switch to HTTPS |
| `remote: Repository not found` (HTTPS) | Token lacks access | Use `gh repo clone` or a token with `repo` scope |
| `RPC failed; curl 56` | Large repo, network timeout | `git config --global http.postBuffer 524288000` |
| `destination path already exists` | Directory exists | Delete or rename the directory |

## What might I have missed?

1. **Repo 2 naming:** The prompt says `ishaan1013/shade` but the public repo is `ishaan1013/shadow`. Need clarification — `shade` may be a private fork with different setup.
2. **Private repos:** If `PGS-Powered/gpt-crawler` is a GitHub App private repo, the user needs a GitHub App installation token, not a personal token. Method D is the fallback.
3. **Windows considerations:** Playwright on Windows needs additional setup; `npx playwright install` may prompt for OS-level deps.

## Sources

- GitHub Docs: Authenticating as a GitHub App installation (HIGH confidence)
- BuilderIO/gpt-crawler README + package.json (HIGH confidence)
- ishaan1013/shadow README + package.json (HIGH confidence)
- Nutlope/napkins README + package.json (HIGH confidence)
- GitHub CLI docs: `gh repo clone` (HIGH confidence)
