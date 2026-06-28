import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { DiscoveredEnvironment } from './types.js';
import { EnvironmentDiscoveryError } from './errors.js';

export function resolveCachePath(cachePath: string, repositoryRoot?: string): string {
  if (cachePath.startsWith('/')) {
    return cachePath;
  }
  if (repositoryRoot) {
    return resolve(repositoryRoot, cachePath);
  }
  return resolve(process.cwd(), cachePath);
}

export function loadDiscoveredEnvironment(cachePath: string): DiscoveredEnvironment | null {
  if (!existsSync(cachePath)) {
    return null;
  }

  try {
    const raw = JSON.parse(readFileSync(cachePath, 'utf-8')) as DiscoveredEnvironment;
    if (raw.version !== 1) {
      return null;
    }
    return raw;
  } catch {
    return null;
  }
}

export function saveDiscoveredEnvironment(
  cachePath: string,
  environment: DiscoveredEnvironment,
): void {
  const directory = dirname(cachePath);
  if (!existsSync(directory)) {
    mkdirSync(directory, { recursive: true });
  }

  writeFileSync(cachePath, `${JSON.stringify(environment, null, 2)}\n`, 'utf-8');
}

export function assertCacheMatchesConnection(
  cached: DiscoveredEnvironment,
  connectionSignature: string,
): void {
  if (cached.connectionSignature !== connectionSignature) {
    throw new EnvironmentDiscoveryError(
      `Cached environment was discovered for ${cached.connectionSignature}, but current connection is ${connectionSignature}. ` +
        'Set FORCE_REDISCOVER=1 or delete the cache file to rediscover.',
    );
  }
}
