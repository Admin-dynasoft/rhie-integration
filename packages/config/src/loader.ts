import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { parse as parseYaml } from 'yaml';
import {
  PlatformConfigSchema,
  type PlatformConfig,
  type DatabaseConfig,
  type OnlineDatabaseConfig,
} from './types.js';
import {
  resolvePlatformConfigPath,
  resolveRepositoryRoot,
} from './paths.js';
import { ConfigurationError } from './errors.js';
import {
  assertLocalDatabaseConfig,
} from './database-validation.js';
import { applyEnvironmentDiscovery } from './apply-environment-discovery.js';

export * from './types.js';
export {
  resolvePlatformConfigPath,
  resolveRepositoryRoot,
  getDefaultPlatformConfigPath,
  resetRepositoryRootCache,
} from './paths.js';

let cachedConfig: PlatformConfig | null = null;

function substituteEnvVars(value: unknown, path = 'config'): unknown {
  if (typeof value === 'string') {
    return value.replace(/\$\{(\w+)\}/g, (_placeholder, name: string) => {
      const envValue = process.env[name];
      if (envValue === undefined || envValue === '') {
        return '';
      }
      return envValue;
    });
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => substituteEnvVars(item, `${path}[${index}]`));
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = substituteEnvVars(val, `${path}.${key}`);
    }
    return result;
  }
  return value;
}

function applyEnvOverrides(raw: Record<string, unknown>): Record<string, unknown> {
  const result = structuredClone(raw);

  if (process.env.LOG_LEVEL) {
    result.logging = { ...(result.logging as object ?? {}), level: process.env.LOG_LEVEL };
  }

  if (process.env.RHIE_BASE_URL) {
    result.rhie = { ...(result.rhie as object ?? {}), baseUrl: process.env.RHIE_BASE_URL };
  }

  const localDatabase = {
    ...(result.localDatabase as Record<string, unknown> ?? {}),
  };

  if (process.env.LOCAL_DB_HOST?.trim()) {
    localDatabase.host = process.env.LOCAL_DB_HOST.trim();
  }

  if (process.env.LOCAL_DB_PORT?.trim()) {
    const port = Number.parseInt(process.env.LOCAL_DB_PORT, 10);
    if (!Number.isFinite(port) || port <= 0) {
      throw new ConfigurationError(
        `LOCAL_DB_PORT must be a positive integer, got "${process.env.LOCAL_DB_PORT}"`,
      );
    }
    localDatabase.port = port;
  }

  if (process.env.LOCAL_DB_USER?.trim()) {
    localDatabase.user = process.env.LOCAL_DB_USER.trim();
  }

  if (process.env.LOCAL_DB_PASSWORD !== undefined && process.env.LOCAL_DB_PASSWORD !== '') {
    localDatabase.password = process.env.LOCAL_DB_PASSWORD;
  }

  if (process.env.LOCAL_DB_DATABASE?.trim()) {
    localDatabase.database = process.env.LOCAL_DB_DATABASE.trim();
  }

  if (Object.keys(localDatabase).length > 0) {
    result.localDatabase = localDatabase;
  }

  return result;
}

function loadEnvironmentFiles(): void {
  try {
    const repositoryRoot = resolveRepositoryRoot();
    loadDotenv({ path: resolve(repositoryRoot, '.env') });
  } catch {
    // Repository root is resolved again when loading config.
  }

  loadDotenv();
}

function parseConfigFile(resolvedPath: string): Record<string, unknown> {
  const fileContent = readFileSync(resolvedPath, 'utf-8');
  const extension = resolvedPath.split('.').pop()?.toLowerCase();

  if (extension === 'yaml' || extension === 'yml') {
    return parseYaml(fileContent) as Record<string, unknown>;
  }
  if (extension === 'json') {
    return JSON.parse(fileContent) as Record<string, unknown>;
  }
  throw new Error(`Unsupported config format: ${extension}`);
}

async function finalizeConfig(
  parsed: PlatformConfig,
  resolvedPath: string,
): Promise<PlatformConfig> {
  const { config, discovery } = await applyEnvironmentDiscovery(parsed);

  try {
    assertLocalDatabaseConfig(config.localDatabase);
  } catch (error) {
    if (error instanceof ConfigurationError) {
      throw new ConfigurationError(
        `Failed to load ${resolvedPath}: ${error.message}`,
      );
    }
    throw error;
  }

  if (discovery) {
    // Discovery metadata is intentionally not logged here — callers log after load.
    void discovery;
  }

  return config;
}

export async function loadConfig(configPath?: string): Promise<PlatformConfig> {
  if (cachedConfig) {
    return cachedConfig;
  }

  loadEnvironmentFiles();

  const resolvedPath = resolvePlatformConfigPath(configPath);

  if (!existsSync(resolvedPath)) {
    throw new Error(`Configuration file not found: ${resolvedPath}`);
  }

  const raw = parseConfigFile(resolvedPath);
  const withSubstitution = substituteEnvVars(raw) as Record<string, unknown>;
  const withEnv = applyEnvOverrides(withSubstitution);
  const parsed = PlatformConfigSchema.parse(withEnv);
  cachedConfig = await finalizeConfig(parsed, resolvedPath);
  return cachedConfig;
}

export function getLoadedConfigPath(): string {
  return resolvePlatformConfigPath();
}

export { summarizeDatabaseConfig } from './database-validation.js';
export { needsEnvironmentDiscovery, mergeDiscoveredEnvironment } from './apply-environment-discovery.js';

export function getConfig(): PlatformConfig {
  if (!cachedConfig) {
    throw new ConfigurationError(
      'Configuration has not been loaded. Call await loadConfig() during service startup.',
    );
  }
  return cachedConfig;
}

export function resetConfigCache(): void {
  cachedConfig = null;
}

export function getEnabledOnlineDatabases(config?: PlatformConfig): OnlineDatabaseConfig[] {
  const cfg = config ?? getConfig();
  return cfg.onlineDatabases.filter((db) => db.enabled);
}

export function getDatabaseById(id: string, config?: PlatformConfig): DatabaseConfig | undefined {
  const cfg = config ?? getConfig();

  if (cfg.localDatabase.id === id) {
    return cfg.localDatabase;
  }

  return cfg.onlineDatabases.find((db) => db.id === id);
}

export function getLocalDatabase(config?: PlatformConfig): DatabaseConfig {
  return (config ?? getConfig()).localDatabase;
}
