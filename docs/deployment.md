# Deployment Guide

This monorepo uses **npm workspaces** with a committed **`package-lock.json`**. Deployments must install from the lockfile so every environment gets the same dependency tree.

## Prerequisites

- Node.js >= 20
- `package-lock.json` present in the repository (committed to Git — do not delete or gitignore it)
- MySQL and RHIE credentials configured (see [Configuration](./configuration.md))

## Environment files

The application **always reads `.env` at runtime** (`packages/config/src/loader.ts` loads the repo-root `.env` file). That file is gitignored and must not be committed.

Maintained source templates:

| File | Purpose | Git |
|------|---------|-----|
| `.env.example` | Generic template with placeholders only | Committed |
| `.env.development` | Local development defaults | Committed |
| `.env.production` | Production bootstrap (set `LOCAL_DB_PASSWORD` on the host) | Committed |
| `.env` | Active runtime config | **Gitignored** |

### Development

```bash
cp .env.development .env
# Set RHIE_PASSWORD in .env if required by your services
```

### Production

```bash
cp .env.production .env
# Edit .env — set LOCAL_DB_PASSWORD and RHIE_PASSWORD before starting services
```

Do not edit `.env.development` or `.env.production` on the server in place; update the committed template in Git, then re-copy to `.env` on each host.

## Install (reproducible)

Always use **`npm ci`** in deployment and CI — not `npm install`. `npm ci` installs exactly what is recorded in `package-lock.json` and removes extraneous packages.

**Important:** Do not run `npm install --omit=dev` or set `NODE_ENV=production` before install. TypeScript and other build tools are devDependencies and must be present for `npm run build`.

```bash
cp .env.production .env
# Edit .env — set LOCAL_DB_PASSWORD, RHIE_PASSWORD, and configs/platform.yaml

npm ci
npm run build
```

`npm run build` runs a stale-build guard, then `tsc -b` (TypeScript project references for all workspaces), then verifies every package emitted `dist/index.js` and `dist/index.d.ts`. No manual per-package builds are required.

Build artifacts (`dist/`) and incremental caches (`tsconfig.tsbuildinfo`) are **not** committed. A fresh clone must always run `npm run build` once before starting services.

`npm ci` runs the root **postinstall** hook, which verifies runtime dependencies (`yaml`, `axios`, and axios HTTP adapter dependencies). If any package is missing or incomplete, install fails before you start services.

## Build

```bash
npm run build
```

This compiles all workspace packages and verifies each emits `dist/index.js` and `dist/index.d.ts`.

## Start services

Development:

```bash
npm run dev:coordinator
npm run dev:client-host
```

Production (PM2):

```bash
./scripts/build.sh   # npm ci + npm run build
./scripts/start-all.sh
```

Each app runs **prestart** checks (workspace build outputs + runtime dependencies) before `node dist/index.js`.

## Clean deployment checklist

On a fresh host or after `git clone`:

```bash
git clone <repo-url> rhie-integration
cd rhie-integration
cp .env.production .env
# Set LOCAL_DB_PASSWORD, RHIE_PASSWORD, and configs/platform.yaml
npm ci
npm run build
./scripts/start-all.sh
```

## Do not use broad dist cleanup on node_modules

Avoid deleting every `dist/` directory under the repo:

```bash
# BAD — also removes node_modules/*/dist (axios, yaml, etc.)
find . -name dist -type d -exec rm -rf {} +
```

To clean workspace build output only:

```bash
npm run clean
```

Or exclude `node_modules`:

```bash
find . -path ./node_modules -prune -o -name dist -type d -print -exec rm -rf {} +
```

If dependencies were damaged, reinstall from the lockfile:

```bash
rm -rf node_modules packages/*/node_modules apps/*/node_modules services/*/node_modules
npm ci
```

## Lockfile policy

| File | Policy |
|------|--------|
| `package-lock.json` | **Must be committed**. Required for `npm ci` and reproducible installs. |
| `node_modules/` | Never committed (see `.gitignore`). |

When adding or upgrading dependencies locally, run `npm install` at the repo root and commit the updated `package-lock.json` with your change.
