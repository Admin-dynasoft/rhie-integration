#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function updateWorkspacePackages(baseDir) {
  if (!existsSync(baseDir)) {
    return;
  }

  for (const name of readdirSync(baseDir)) {
    const dir = join(baseDir, name);
    const pkgPath = join(dir, 'package.json');
    if (!existsSync(pkgPath)) {
      continue;
    }

    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    if (!pkg.name?.startsWith('@rhie/')) {
      continue;
    }

    pkg.main = './dist/index.js';
    pkg.types = './dist/index.d.ts';
    pkg.exports = {
      '.': {
        types: './dist/index.d.ts',
        import: './dist/index.js',
        require: './dist/index.js',
        default: './dist/index.js',
      },
    };
    pkg.files = ['dist'];

    writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
    console.log(`Updated ${pkg.name}`);
  }
}

updateWorkspacePackages(join(root, 'services'));
