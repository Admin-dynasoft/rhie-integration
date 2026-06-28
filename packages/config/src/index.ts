export {
  loadConfig,
  getConfig,
  resetConfigCache,
  getEnabledOnlineDatabases,
  getDatabaseById,
  getLocalDatabase,
  resolvePlatformConfigPath,
  resolveRepositoryRoot,
  getDefaultPlatformConfigPath,
  resetRepositoryRootCache,
} from './loader.js';

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
} from './types.js';

export { ClientRegistryConfigSchema } from './client-registry.js';
export { EncounterIdConfigSchema } from './encounter-id.js';

export {
  PlatformConfigSchema,
  DatabaseConfigSchema,
  RhieConfigSchema,
  RetryConfigSchema,
  WorkerConfigSchema,
} from './types.js';
