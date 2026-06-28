export {
  loadConfig,
  getConfig,
  resetConfigCache,
  getEnabledOnlineDatabases,
  getDatabaseById,
  getLocalDatabase,
  getLoadedConfigPath,
  summarizeDatabaseConfig,
  resolvePlatformConfigPath,
  resolveRepositoryRoot,
  getDefaultPlatformConfigPath,
  resetRepositoryRootCache,
} from './loader.js';

export { ConfigurationError } from './errors.js';
export {
  assertDatabaseConnectionConfig,
  assertLocalDatabaseConfig,
  type DatabaseConfigLogSummary,
} from './database-validation.js';

export type {
  PlatformConfig,
  DatabaseConfig,
  LocalDatabaseConfig,
  OnlineDatabaseConfig,
  RhieConfig,
  RhieAuthConfig,
  RetryConfig,
  WorkerConfig,
  CoordinatorConfig,
  MonitoringConfig,
  LoggingConfig,
  ProcessingMode,
  FacilityProcessingState,
  CoordinatorState,
  WorkerHostConfig,
  WorkerHostHealthState,
  ClientRegistryConfig,
  ClientRegistryExecutionMode,
  EncounterIdConfig,
  EncounterIdExecutionMode,
  IntegrationStateConfig,
  ReplicationMonitorConfig,
  ReplicationHealthStatus,
} from './types.js';

export { ClientRegistryConfigSchema } from './client-registry.js';
export { EncounterIdConfigSchema } from './encounter-id.js';
export { IntegrationStateConfigSchema } from './integration-state.js';
export { ReplicationMonitorConfigSchema } from './replication-monitor.js';

export {
  PlatformConfigSchema,
  DatabaseConfigSchema,
  RhieConfigSchema,
  RetryConfigSchema,
  WorkerConfigSchema,
} from './types.js';
