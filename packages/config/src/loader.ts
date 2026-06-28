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

export * from './types.js';

let cachedConfig: PlatformConfig | null = null;

function substituteEnvVars(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.replace(/\$\{(\w+)\}/g, (_, name: string) => process.env[name] ?? '');
  }
  if (Array.isArray(value)) {
    return value.map(substituteEnvVars);
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = substituteEnvVars(val);
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

  if (process.env.LOCAL_DB_HOST) {
    result.localDatabase = {
      ...(result.localDatabase as object ?? {}),
      host: process.env.LOCAL_DB_HOST,
    };
  }

  if (process.env.LOCAL_DB_PASSWORD) {
    result.localDatabase = {
      ...(result.localDatabase as object ?? {}),
      password: process.env.LOCAL_DB_PASSWORD,
    };
  }

  return result;
}

function resolveConfigPath(configPath?: string): string {
  const envPath = configPath ?? process.env.CONFIG_PATH ?? './configs/platform.yaml';
  return resolve(process.cwd(), envPath);
}

export function loadConfig(configPath?: string): PlatformConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  loadDotenv();

  const resolvedPath = resolveConfigPath(configPath);

  if (!existsSync(resolvedPath)) {
    throw new Error(`Configuration file not found: ${resolvedPath}`);
  }

  const fileContent = readFileSync(resolvedPath, 'utf-8');
  const extension = resolvedPath.split('.').pop()?.toLowerCase();

  let raw: Record<string, unknown>;

  if (extension === 'yaml' || extension === 'yml') {
    raw = parseYaml(fileContent) as Record<string, unknown>;
  } else if (extension === 'json') {
    raw = JSON.parse(fileContent) as Record<string, unknown>;
  } else {
    throw new Error(`Unsupported config format: ${extension}`);
  }

  const withSubstitution = substituteEnvVars(raw) as Record<string, unknown>;
  const withEnv = applyEnvOverrides(withSubstitution);
  const parsed = PlatformConfigSchema.parse(withEnv);

  cachedConfig = parsed;
  return parsed;
}

export function getConfig(): PlatformConfig {
  if (!cachedConfig) {
    return loadConfig();
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
