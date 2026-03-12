<p align="center">
  <img src="public/clawd-logo.png" alt="ClawHub" width="120">
</p>

<h1 align="center">ClawHub</h1>

<p align="center">
  <a href="https://github.com/openclaw/clawhub/actions/workflows/ci.yml?branch=main"><img src="https://img.shields.io/github/actions/workflow/status/openclaw/clawhub/ci.yml?branch=main&style=for-the-badge" alt="CI status"></a>
  <a href="https://discord.gg/clawd"><img src="https://img.shields.io/discord/1456350064065904867?label=Discord&logo=discord&logoColor=white&color=5865F2&style=for-the-badge" alt="Discord"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge" alt="MIT License"></a>
</p>

ClawHub is the **public skill registry for Clawdbot**: publish, version, and search text-based agent skills (a `SKILL.md` plus supporting files).
It's designed for fast browsing + a CLI-friendly API, with moderation hooks and vector search.

This repository supports both:
- **Hosted mode**: The original SaaS deployment (clawhub.ai)
- **Self-hosted mode**: Run your own private ClawHub instance on your infrastructure

<p align="center">
  <a href="https://clawhub.ai">ClawHub</a> ·
  <a href="https://onlycrabs.ai">onlycrabs.ai</a> ·
  <a href="VISION.md">Vision</a> ·
  <a href="docs/README.md">Docs</a> ·
  <a href="CONTRIBUTING.md">Contributing</a> ·
  <a href="https://discord.gg/clawd">Discord</a>
</p>

## Quick Start: Self-Hosted Deployment

Run your own private ClawHub instance with Docker Compose:

### Prerequisites
- [Docker](https://www.docker.com/) and Docker Compose
- [Bun](https://bun.sh/) (for CLI operations)

### 1. Start the services

```bash
# Clone the repository
git clone https://github.com/openclaw/clawhub.git
cd clawhub

# Start PostgreSQL + API + Web frontend
docker compose -f docker-compose.selfhost.yml up -d

# Wait a few seconds for services to start
sleep 5

# Check service status
docker compose -f docker-compose.selfhost.yml ps
```

Services:
- **API**: http://localhost:3000 (backend HTTP API)
- **Web**: http://localhost:5173 (frontend dev server)
- **PostgreSQL**: localhost:5432 (database)

### 2. Generate an admin token

```bash
docker compose -f docker-compose.selfhost.yml exec api \
  bun selfhost/api/src/seed.ts
```

This outputs a token like: `clh_abc123...`

### 3. Login with the CLI

```bash
# Install dependencies (if not already done)
bun install

# Login (inside Docker container for clean network environment)
docker compose -f docker-compose.selfhost.yml exec api bash -c \
  "bun /app/packages/clawdhub/dist/cli.js login \
    --site http://localhost:3000 \
    --registry http://localhost:3000 \
    --token clh_YOUR_TOKEN_HERE"
```

### 4. Publish a skill

```bash
# Create a test skill
mkdir -p /tmp/my-skill
cat > /tmp/my-skill/SKILL.md << 'EOF'
# My First Skill

A test skill for ClawHub.

## Usage

This is a demonstration skill.
EOF

# Publish from inside the container
docker compose -f docker-compose.selfhost.yml exec api bash -c \
  "cd /tmp && mkdir -p my-skill && \
   echo '# My Skill\nTest content.' > my-skill/SKILL.md && \
   bun /app/packages/clawdhub/dist/cli.js publish my-skill \
     --version 1.0.0 \
     --changelog 'Initial release' \
     --site http://localhost:3000 \
     --registry http://localhost:3000"
```

### 5. Browse your registry

Open http://localhost:5173 in your browser. You should see:
- Homepage with your published skills
- Skill detail pages with README and install instructions
- Simplified UI for self-hosted mode (no GitHub OAuth, stars, or comments yet)

### Management Commands

```bash
# Stop all services
docker compose -f docker-compose.selfhost.yml down

# Stop and remove all data (including database)
docker compose -f docker-compose.selfhost.yml down -v

# View API logs
docker compose -f docker-compose.selfhost.yml logs -f api

# View all logs
docker compose -f docker-compose.selfhost.yml logs -f

# Restart services
docker compose -f docker-compose.selfhost.yml restart

# Rebuild after code changes
docker compose -f docker-compose.selfhost.yml up -d --build
```

### Architecture (Self-Hosted)

```
┌─────────────────┐
│  Web Frontend   │  Port 5173 (Vite dev server)
│  (React/Vite)   │
└────────┬────────┘
         │
         │ HTTP API calls
         ↓
┌─────────────────┐
│   API Server    │  Port 3000 (H3/Node.js)
│   (Node.js/H3)  │
└────────┬────────┘
         │
         ├─→ PostgreSQL (port 5432)
         └─→ Local Storage (/data/storage)
```

**Self-hosted features**:
- ✅ Skill publishing via CLI
- ✅ Skill browsing and search
- ✅ File storage (local disk)
- ✅ PostgreSQL database
- ✅ Token-based authentication
- ⚠️ No GitHub OAuth (use admin tokens instead)
- ⚠️ No vector search (keyword search only)
- ⚠️ No stars/comments/moderation UI

## What you can do with it

- Browse skills + render their `SKILL.md`.
- Publish new skill versions with changelogs + tags (including `latest`).
- Browse souls + render their `SOUL.md` (hosted mode only).
- Publish new soul versions with changelogs + tags (hosted mode only).
- Search via embeddings (vector index) instead of brittle keywords (hosted mode only).
- Star + comment; admins/mods can curate and approve skills (hosted mode only).

## CLI

Common CLI flows:

- Auth: `clawhub login`, `clawhub whoami`
- Discover: `clawhub search ...`, `clawhub explore`
- Manage local installs: `clawhub install <slug>`, `clawhub uninstall <slug>`, `clawhub list`, `clawhub update --all`
- Inspect without installing: `clawhub inspect <slug>`
- Publish/sync: `clawhub publish <path>`, `clawhub sync`

**Self-hosted registry**:
```bash
# Point CLI to your self-hosted instance
clawhub login --registry http://your-server:3000 --site http://your-server:3000
clawhub publish ./my-skill --version 1.0.0 --changelog "Initial release"
clawhub install my-skill --registry http://your-server:3000
```

Docs: [`docs/quickstart.md`](docs/quickstart.md), [`docs/cli.md`](docs/cli.md).

### Removal permissions

- `clawhub uninstall <slug>` only removes a local install on your machine.
- Uploaded registry skills use soft-delete/restore (`clawhub delete <slug>` / `clawhub undelete <slug>` or API equivalents).
- Soft-delete/restore is allowed for the skill owner, moderators, and admins.
- Hard delete is admin-only (management tools / ban flows).


## Telemetry

ClawHub tracks minimal **install telemetry** (to compute install counts) when you run `clawhub sync` while logged in.
Disable via:

```bash
export CLAWHUB_DISABLE_TELEMETRY=1
```

Details: [`docs/telemetry.md`](docs/telemetry.md).

## Repo layout

- `src/` — TanStack Start app (routes, components, styles).
- `convex/` — schema + queries/mutations/actions + HTTP API routes (hosted mode).
- `selfhost/` — self-hosted backend (PostgreSQL schema, API server, Docker setup).
- `packages/schema/` — shared API types/routes for the CLI and app.
- `packages/clawdhub/` — CLI implementation.
- [`docs/`](docs/README.md) — project documentation (architecture, CLI, auth, deployment, and more).
- [`docs/spec.md`](docs/spec.md) — product + implementation spec (good first read).

## Hosted Mode Development (clawhub.ai)

The original ClawHub deployment uses Convex as the backend.

### Prerequisites
- [Bun](https://bun.sh/) (Convex runs via `bunx`, no global install needed)
- [Convex account](https://www.convex.dev/)

### Setup

```bash
bun install
cp .env.local.example .env.local
# edit .env.local — see CONTRIBUTING.md for local Convex values

# terminal A: local Convex backend
bunx convex dev

# terminal B: web app (port 3000)
bun run dev

# seed sample data
bunx convex run --no-push devSeed:seedNixSkills
```

For full setup instructions (env vars, GitHub OAuth, JWT keys, database seeding), see [CONTRIBUTING.md](CONTRIBUTING.md).

### Environment (Hosted Mode)

- `VITE_CONVEX_URL`: Convex deployment URL (`https://<deployment>.convex.cloud`).
- `VITE_CONVEX_SITE_URL`: Convex site URL (`https://<deployment>.convex.site`).
- `VITE_SOULHUB_SITE_URL`: onlycrabs.ai site URL (`https://onlycrabs.ai`).
- `VITE_SOULHUB_HOST`: onlycrabs.ai host match (`onlycrabs.ai`).
- `VITE_SITE_MODE`: Optional override (`skills` or `souls`) for SSR builds.
- `CONVEX_SITE_URL`: same as `VITE_CONVEX_SITE_URL` (auth + cookies).
- `SITE_URL`: App URL (local: `http://localhost:3000`).
- `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET`: GitHub OAuth App.
- `JWT_PRIVATE_KEY` / `JWKS`: Convex Auth keys.
- `OPENAI_API_KEY`: embeddings for search + indexing.

## onlycrabs.ai (SOUL.md registry)

*Hosted mode only*

- Entry point is host-based: `onlycrabs.ai`.
- On the onlycrabs.ai host, the home page and nav default to souls.
- On ClawHub, souls live under `/souls`.
- Soul bundles only accept `SOUL.md` for now (no extra files).

## How it works (high level)

### Hosted Mode (clawhub.ai)
- Web app: TanStack Start (React, Vite/Nitro).
- Backend: Convex (DB + file storage + HTTP actions) + Convex Auth (GitHub OAuth).
- Search: OpenAI embeddings (`text-embedding-3-small`) + Convex vector search.
- API schema + routes: `packages/schema` (`clawhub-schema`).

### Self-Hosted Mode
- Web app: TanStack Start (React, Vite dev server).
- Backend: Node.js/H3 HTTP server + PostgreSQL + local disk storage.
- Search: Keyword-based (PostgreSQL `ILIKE`).
- Auth: Token-based (no OAuth).
- API: Same HTTP routes, compatible with the CLI.

## Nix plugins (nixmode skills)

ClawHub can store a nix-clawdbot plugin pointer in SKILL frontmatter so the registry knows which
Nix package bundle to install. A nix plugin is different from a regular skill pack: it bundles the
skill pack, the CLI binary, and its config flags/requirements together.

Add this to `SKILL.md`:

```yaml
---
name: peekaboo
description: Capture and automate macOS UI with the Peekaboo CLI.
metadata: {"clawdbot":{"nix":{"plugin":"github:clawdbot/nix-steipete-tools?dir=tools/peekaboo","systems":["aarch64-darwin"]}}}
---
```

Install via nix-clawdbot:

```nix
programs.clawdbot.plugins = [
  { source = "github:clawdbot/nix-steipete-tools?dir=tools/peekaboo"; }
];
```

You can also declare config requirements + an example snippet:

```yaml
---
name: padel
description: Check padel court availability and manage bookings via Playtomic.
metadata: {"clawdbot":{"config":{"requiredEnv":["PADEL_AUTH_FILE"],"stateDirs":[".config/padel"],"example":"config = { env = { PADEL_AUTH_FILE = \\\"/run/agenix/padel-auth\\\"; }; };"}}}
---
```

To show CLI help (recommended for nix plugins), include the `cli --help` output:

```yaml
---
name: padel
description: Check padel court availability and manage bookings via Playtomic.
metadata: {"clawdbot":{"cliHelp":"padel --help\\nUsage: padel [command]\\n"}}
---
```

`metadata.clawdbot` is preferred, but `metadata.clawdis` and `metadata.openclaw` are accepted as aliases.

## Skill metadata

Skills declare their runtime requirements (env vars, binaries, install specs) in the `SKILL.md` frontmatter. ClawHub's security analysis checks these declarations against actual skill behavior.

Full reference: [`docs/skill-format.md`](docs/skill-format.md#frontmatter-metadata)

Quick example:

```yaml
---
name: my-skill
description: Does a thing with an API.
metadata:
  openclaw:
    requires:
      env:
        - MY_API_KEY
      bins:
        - curl
    primaryEnv: MY_API_KEY
---
```

## Scripts

### Self-Hosted Mode
```bash
# Start all services (API + Web + PostgreSQL)
docker compose -f docker-compose.selfhost.yml up -d

# View logs
docker compose -f docker-compose.selfhost.yml logs -f

# Stop services
docker compose -f docker-compose.selfhost.yml down

# Generate admin token
docker compose -f docker-compose.selfhost.yml exec api bun selfhost/api/src/seed.ts
```

### Hosted Mode
```bash
bun run dev          # Local dev server
bun run build        # Production build
bun run test         # Run tests
bun run coverage     # Coverage report
bun run lint         # Lint/format
```
