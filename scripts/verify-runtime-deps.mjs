#!/usr/bin/env node
/**
 * Verify runtime dependencies resolve and load before build artifacts or apps start.
 *
 * Catches incomplete node_modules trees (e.g. after deleting every dist/ directory under
 * the repo, or using npm install instead of npm ci on a stale tree).
 */
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Packages required at runtime by axios (Node HTTP adapter chain). */
const AXIOS_RUNTIME_DEPS = [
  'axios',
  'https-proxy-agent',
  'follow-redirects',
  'form-data',
  'proxy-from-env',
];

/** Required files when dist/ was removed from a dependency package. */
const REQUIRED_FILES = {
  axios: ['dist/node/axios.cjs'],
  'https-proxy-agent': ['dist/index.js'],
  yaml: ['dist/index.js'],
};

function verifyModule(requireFn, moduleName, anchorLabel) {
  const errors = [];

  try {
    const resolved = requireFn.resolve(moduleName);
    if (!existsSync(resolved)) {
      errors.push(
        `${moduleName}: resolved entry missing at ${resolved} (from ${anchorLabel})`,
      );
      return errors;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(`${moduleName}: cannot resolve from ${anchorLabel} (${message})`);
    return errors;
  }

  for (const relativePath of REQUIRED_FILES[moduleName] ?? []) {
    try {
      const pkgJson = requireFn.resolve(`${moduleName}/package.json`);
      const requiredPath = join(dirname(pkgJson), relativePath);
      if (!existsSync(requiredPath)) {
        errors.push(
          `${moduleName}: incomplete install — missing ${relativePath} (from ${anchorLabel})`,
        );
      }
    } catch {
      // package.json resolution failed; covered by resolve check above.
    }
  }

  try {
    requireFn(moduleName);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(`${moduleName}: failed to load from ${anchorLabel} (${message})`);
  }

  return errors;
}

const rhieClientPkg = join(root, 'packages/rhie-client/package.json');
const configPkg = join(root, 'packages/config/package.json');

const rhieClientRequire = createRequire(rhieClientPkg);
const configRequire = createRequire(configPkg);

const failures = [
  ...verifyModule(configRequire, 'yaml', '@rhie/config'),
  ...AXIOS_RUNTIME_DEPS.flatMap((name) =>
    verifyModule(rhieClientRequire, name, '@rhie/rhie-client'),
  ),
];

if (failures.length > 0) {
  console.error('Runtime dependency verification failed:\n');
  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }
  console.error(
    '\nReinstall dependencies from the lockfile for a reproducible tree:\n' +
      '  rm -rf node_modules packages/*/node_modules apps/*/node_modules services/*/node_modules\n' +
      '  npm ci\n' +
      '\nEnsure package-lock.json is committed and matches this checkout.',
  );
  process.exit(1);
}

console.log(
  'Verified runtime dependencies: yaml, axios, https-proxy-agent, follow-redirects, form-data, proxy-from-env',
);
