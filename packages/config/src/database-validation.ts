import type { DatabaseConfig } from './types.js';
import { ConfigurationError } from './errors.js';

export interface DatabaseConfigLogSummary {
  id: string;
  host: string;
  port: number;
  database: string;
  user: string;
  passwordPresent: boolean;
}

const ENV_PLACEHOLDER = /\$\{(\w+)\}/;

function missingFieldMessage(label: string, field: string, hint?: string): string {
  const suffix = hint ? ` ${hint}` : '';
  return `Database "${label}": required field "${field}" is missing or empty.${suffix}`;
}

export function summarizeDatabaseConfig(config: DatabaseConfig): DatabaseConfigLogSummary {
  return {
    id: config.id,
    host: config.host,
    port: config.port,
    database: config.database ?? '',
    user: config.user,
    passwordPresent: config.password.length > 0,
  };
}

export function assertDatabaseConnectionConfig(
  config: DatabaseConfig,
  options?: { requirePassword?: boolean },
): void {
  const label = config.name || config.id;
  const requirePassword = options?.requirePassword ?? true;

  if (!config.host?.trim()) {
    throw new ConfigurationError(missingFieldMessage(label, 'host'));
  }

  if (!config.port || config.port <= 0) {
    throw new ConfigurationError(missingFieldMessage(label, 'port'));
  }

  if (!config.user?.trim()) {
    throw new ConfigurationError(
      missingFieldMessage(label, 'user', 'Set LOCAL_DB_USER in your environment or .env file.'),
    );
  }

  if (!config.database?.trim()) {
    throw new ConfigurationError(missingFieldMessage(label, 'database'));
  }

  if (ENV_PLACEHOLDER.test(config.host)) {
    throw new ConfigurationError(
      `Database "${label}": host still contains an unresolved environment placeholder.`,
    );
  }

  if (ENV_PLACEHOLDER.test(config.user)) {
    throw new ConfigurationError(
      `Database "${label}": user still contains an unresolved environment placeholder.`,
    );
  }

  if (ENV_PLACEHOLDER.test(config.database)) {
    throw new ConfigurationError(
      `Database "${label}": database still contains an unresolved environment placeholder.`,
    );
  }

  if (ENV_PLACEHOLDER.test(config.password)) {
    throw new ConfigurationError(
      `Database "${label}": password still contains an unresolved environment placeholder. Set LOCAL_DB_PASSWORD in your environment or .env file.`,
    );
  }

  if (requirePassword && !config.password) {
    throw new ConfigurationError(
      `Database "${label}": password is required but not set. Set LOCAL_DB_PASSWORD in your environment or .env file.`,
    );
  }
}

export function assertLocalDatabaseConfig(config: DatabaseConfig): void {
  assertDatabaseConnectionConfig(config, { requirePassword: true });
}
