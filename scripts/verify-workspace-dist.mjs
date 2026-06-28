#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function collectPackageDirs(baseDir) {
  if (!existsSync(baseDir)) {
    return [];
  }
  return readdirSync(baseDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(baseDir, entry.name))
    .filter((dir) => existsSync(join(dir, 'package.json')));
}

const packageDirs = [
  ...collectPackageDirs(join(root, 'packages')),
  ...collectPackageDirs(join(root, 'services')),
  ...collectPackageDirs(join(root, 'apps')),
];

const missing = [];

for (const dir of packageDirs) {
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  if (!pkg.name?.startsWith('@rhie/')) {
    continue;
  }

  const distEntry = join(dir, 'dist', 'index.js');
  if (!existsSync(distEntry)) {
    missing.push(`${pkg.name} (${distEntry})`);
  }
}

if (missing.length > 0) {
  console.error('Workspace build verification failed. Missing dist/index.js for:');
  for (const entry of missing) {
    console.error(`  - ${entry}`);
  }
  console.error('\nRun "npm run build" from the repository root before starting services.');
  process.exit(1);
}

console.log(`Verified ${packageDirs.length} workspace packages have dist/index.js`);
