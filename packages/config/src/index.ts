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
  VisitEncounterConfig,
  VisitEncounterExecutionMode,
  ObservationConfig,
  ObservationExecutionMode,
  IntegrationStateConfig,
  ReplicationMonitorConfig,
  ReplicationHealthStatus,
} from './types.js';

export { needsEnvironmentDiscovery, mergeDiscoveredEnvironment } from './apply-environment-discovery.js';
export type { EnvironmentDiscoveryConfig } from './environment-discovery-config.js';
export { EnvironmentDiscoveryConfigSchema } from './environment-discovery-config.js';

export {
  PlatformConfigSchema,
  DatabaseConfigSchema,
  RhieConfigSchema,
  RetryConfigSchema,
  WorkerConfigSchema,
} from './types.js';
