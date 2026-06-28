import {
  discoverEnvironment,
  resolveCachePath,
  type EnvironmentDiscoveryResult,
} from '@rhie/environment-discovery';
import type {
  EnvironmentDiscoveryConfig,
  LocalDatabaseConfig,
  OnlineDatabaseConfig,
  PlatformConfig,
} from './types.js';
import { ConfigurationError } from './errors.js';
import { resolveRepositoryRoot } from './paths.js';

export function needsEnvironmentDiscovery(config: PlatformConfig): boolean {
  if (config.environmentDiscovery?.enabled === false) {
    return false;
  }

  if (process.env.MEDISOFT_SKIP_DISCOVERY === '1') {
    return false;
  }

  const localMissing = !config.localDatabase.database?.trim();
  const onlineNeedsDiscovery =
    config.onlineDatabases.length === 0 ||
    config.onlineDatabases.some((database) => !database.database?.trim());

  return localMissing || onlineNeedsDiscovery;
}

function resolveDiscoveryMode(
  config: EnvironmentDiscoveryConfig,
): 'auto' | 'local' | 'online' {
  const envMode = process.env.DISCOVERY_MODE?.trim().toLowerCase();
  if (envMode === 'auto' || envMode === 'local' || envMode === 'online') {
    return envMode;
  }
  return config.mode;
}

export async function applyEnvironmentDiscovery(
  config: PlatformConfig,
): Promise<{ config: PlatformConfig; discovery: EnvironmentDiscoveryResult | null }> {
  if (!needsEnvironmentDiscovery(config)) {
    return { config, discovery: null };
  }

  const discoveryConfig = config.environmentDiscovery ?? {
    enabled: true,
    mode: 'auto',
    cachePath: './data/discovered-environment.json',
    centralDatabase: 'medisoft_hie',
    excludeDatabases: [],
  };

  const local = config.localDatabase;

  try {
    const discovery = await discoverEnvironment({
      credentials: {
        host: local.host,
        port: local.port,
        user: local.user,
        password: local.password,
      },
      mode: resolveDiscoveryMode(discoveryConfig),
      centralDatabase: discoveryConfig.centralDatabase,
      excludeDatabases: discoveryConfig.excludeDatabases,
      cachePath: resolveCachePath(discoveryConfig.cachePath, resolveRepositoryRoot()),
      selectedDatabase: process.env.MEDISOFT_DATABASE?.trim(),
      forceRediscover: process.env.FORCE_REDISCOVER === '1',
      connectionLimit: local.connectionLimit,
      connectTimeoutMs: local.connectTimeoutMs,
    });

    return {
      config: mergeDiscoveredEnvironment(config, discovery),
      discovery,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ConfigurationError(`Environment discovery failed: ${message}`);
  }
}

export function mergeDiscoveredEnvironment(
  config: PlatformConfig,
  discovery: EnvironmentDiscoveryResult,
): PlatformConfig {
  const localTemplate = config.localDatabase;

  const localDatabase: LocalDatabaseConfig = {
    ...localTemplate,
    database: discovery.localDatabase.database,
    name: discovery.localDatabase.facilityName,
  };

  const onlineDatabases: OnlineDatabaseConfig[] = discovery.onlineDatabases.map((online) => ({
    id: online.id,
    name: online.facilityName,
    role: 'online' as const,
    facilityCode: online.facilityCode,
    host: online.host,
    port: online.port,
    user: online.user,
    password: online.password,
    database: online.database,
    connectionLimit: localTemplate.connectionLimit,
    connectTimeoutMs: localTemplate.connectTimeoutMs,
    enabled: true,
  }));

  return {
    ...config,
    localDatabase,
    onlineDatabases:
      onlineDatabases.length > 0 ? onlineDatabases : config.onlineDatabases,
  };
}
