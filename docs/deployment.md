# Deployment Guide

This monorepo uses **npm workspaces** with a committed **`package-lock.json`**. Deployments must install from the lockfile so every environment gets the same dependency tree.

## Prerequisites

- Node.js >= 20
- `package-lock.json` present in the repository (committed to Git — do not delete or gitignore it)
- MySQL and RHIE credentials configured (see [Configuration](./configuration.md))

## Install (reproducible)

Always use **`npm ci`** in deployment and CI — not `npm install`. `npm ci` installs exactly what is recorded in `package-lock.json` and removes extraneous packages.

```bash
cp .env.example .env
# Edit .env and configs/platform.yaml

npm ci
npm run build
```

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
cp .env.example .env
# configure .env and configs/platform.yaml
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
