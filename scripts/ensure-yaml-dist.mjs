#!/usr/bin/env node
/**
 * Ensure the `yaml` package has its Node `dist/` entry (dist/index.js).
 *
 * A broad cleanup such as `find . -name dist -type d -exec rm -rf {} +` removes
 * node_modules/yaml/dist as well. `npm install` does not re-extract files for
 * packages that are already marked installed, so runtime resolution breaks until
 * the package directory is removed and reinstalled.
 */
import { existsSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const configPkgJson = join(root, 'packages/config/package.json');

function yamlDistExists() {
  try {
    const configRequire = createRequire(configPkgJson);
    const yamlPkgJson = configRequire.resolve('yaml/package.json');
    return existsSync(join(dirname(yamlPkgJson), 'dist', 'index.js'));
  } catch {
    return false;
  }
}

if (yamlDistExists()) {
  process.exit(0);
}

console.log('Restoring yaml package (dist/ missing — often caused by deleting all dist/ directories)...');

const yamlDirs = [
  join(root, 'node_modules/yaml'),
  join(root, 'packages/config/node_modules/yaml'),
];

for (const dir of yamlDirs) {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

execSync('npm install', {
  cwd: root,
  stdio: 'inherit',
});

if (!yamlDistExists()) {
  console.error(
    'Failed to restore yaml dist/index.js after reinstall.\n' +
      'Try: rm -rf node_modules packages/*/node_modules && npm ci',
  );
  process.exit(1);
}
