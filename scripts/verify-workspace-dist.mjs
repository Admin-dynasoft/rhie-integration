#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
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

  const distJs = join(dir, 'dist', 'index.js');
  const distTypes = join(dir, 'dist', 'index.d.ts');

  if (!existsSync(distJs)) {
    missing.push(`${pkg.name} (${distJs})`);
  }
  if (!existsSync(distTypes)) {
    missing.push(`${pkg.name} (${distTypes})`);
  }
}

if (missing.length > 0) {
  console.error('Workspace build verification failed. Missing build outputs for:');
  for (const entry of missing) {
    console.error(`  - ${entry}`);
  }
  console.error('\nRun "npm run build" from the repository root before starting services.');
  process.exit(1);
}

try {
  const configRequire = createRequire(join(root, 'packages/config/package.json'));
  const yamlPkgJson = configRequire.resolve('yaml/package.json');
  const yamlDist = join(dirname(yamlPkgJson), 'dist', 'index.js');
  if (!existsSync(yamlDist)) {
    throw new Error(`yaml dist/index.js missing at ${yamlDist}`);
  }
} catch (error) {
  console.error(
    'Dependency check failed: the yaml package is not usable from @rhie/config.\n' +
      `${error instanceof Error ? error.message : error}\n` +
      'Run "npm ci" from the repository root (postinstall restores yaml if dist/ was deleted).',
  );
  process.exit(1);
}

console.log(
  `Verified ${packageDirs.length} workspace packages emit dist/index.js and dist/index.d.ts`,
);
console.log('Verified yaml dependency is resolvable from @rhie/config');
