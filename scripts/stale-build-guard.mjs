#!/usr/bin/env node
/**
 * Remove stale tsconfig.tsbuildinfo files when dist output is missing.
 *
 * Fresh clones receive committed .tsbuildinfo artifacts but not dist/ (gitignored).
 * Without this guard, `tsc -b` assumes projects are up to date and skips emitting
 * declaration files, which breaks @rhie/* module resolution during the same build.
 */
import { existsSync, readFileSync, readdirSync, unlinkSync } from 'node:fs';
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

let removed = 0;

for (const dir of packageDirs) {
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  if (!pkg.name?.startsWith('@rhie/')) {
    continue;
  }

  const tsbuildinfo = join(dir, 'tsconfig.tsbuildinfo');
  const distTypes = join(dir, 'dist', 'index.d.ts');

  if (existsSync(tsbuildinfo) && !existsSync(distTypes)) {
    unlinkSync(tsbuildinfo);
    removed += 1;
    console.log(`Removed stale build cache: ${pkg.name} (missing ${distTypes})`);
  }
}

if (removed > 0) {
  console.log(`Stale build guard: cleared ${removed} tsconfig.tsbuildinfo file(s).`);
}
