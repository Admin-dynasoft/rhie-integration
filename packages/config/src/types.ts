import { z } from 'zod';
import { ClientRegistryConfigSchema } from './client-registry.js';
import { EncounterIdConfigSchema } from './encounter-id.js';
import { IntegrationStateConfigSchema } from './integration-state.js';
import { ReplicationMonitorConfigSchema } from './replication-monitor.js';

export const DatabaseConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  host: z.string().min(1),
  port: z.number().int().positive().default(3306),
  user: z.string().min(1),
  password: z.string(),
  database: z.string().min(1),
  connectionLimit: z.number().int().positive().default(10),
  connectTimeoutMs: z.number().int().positive().default(10000),
  enabled: z.boolean().default(true),
});

export type DatabaseConfig = z.infer<typeof DatabaseConfigSchema>;

export const RhieAuthConfigSchema = z.object({
  type: z.enum(['basic', 'bearer', 'oauth2']).default('bearer'),
  tokenUrl: z.string().url().optional(),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  token: z.string().optional(),
});

export type RhieAuthConfig = z.infer<typeof RhieAuthConfigSchema>;

export const RhieConfigSchema = z.object({
  baseUrl: z.string().url(),
  auth: RhieAuthConfigSchema,
  timeoutMs: z.number().int().positive().default(30000),
  clientRegistryPath: z.string().default('/client-registry'),
  encounterIdPath: z.string().default('/encounters/id'),
  visitEncounterPath: z.string().default('/encounters/visit'),
  transferEncounterPath: z.string().default('/encounters/transfer'),
  observationPath: z.string().default('/observations'),
});

export type RhieConfig = z.infer<typeof RhieConfigSchema>;

export const RetryConfigSchema = z.object({
  maxAttempts: z.number().int().positive().default(3),
  initialDelayMs: z.number().int().positive().default(1000),
  maxDelayMs: z.number().int().positive().default(30000),
  backoffMultiplier: z.number().positive().default(2),
});

export type RetryConfig = z.infer<typeof RetryConfigSchema>;

export const WorkerConfigSchema = z.object({
  sleepIntervalMs: z.number().int().positive().default(5000),
  batchSize: z.number().int().positive().default(50),
  maxConcurrentWorkers: z.number().int().positive().default(4),
  heartbeatIntervalMs: z.number().int().positive().default(10000),
  healthCheckIntervalMs: z.number().int().positive().default(30000),
});

export type WorkerConfig = z.infer<typeof WorkerConfigSchema>;

export const MonitoringConfigSchema = z.object({
  healthPort: z.number().int().positive().default(9090),
  metricsEnabled: z.boolean().default(true),
});

export type MonitoringConfig = z.infer<typeof MonitoringConfigSchema>;

export const LoggingConfigSchema = z.object({
  level: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  prettyPrint: z.boolean().default(false),
  fileEnabled: z.boolean().default(false),
  filePath: z.string().default('./logs/platform.log'),
  jsonFormat: z.boolean().default(true),
});

export type LoggingConfig = z.infer<typeof LoggingConfigSchema>;

export const WorkerHostConfigSchema = z.object({
  serviceName: z.string().min(1),
  modes: z.array(z.enum(['online', 'local'])).default(['online', 'local']),
  healthPort: z.number().int().positive().optional(),
  metricsPort: z.number().int().positive().optional(),
  workerTypes: z.array(z.string()).default([]),
});

export type WorkerHostConfig = z.infer<typeof WorkerHostConfigSchema>;

export const CoordinatorConfigSchema = z.object({
  syncHealthCheckIntervalMs: z.number().int().positive().default(15000),
  onlineUnavailableThresholdMs: z.number().int().positive().default(60000),
  serviceHeartbeatTimeoutMs: z.number().int().positive().default(45000),
  stateFilePath: z.string().default('./data/coordinator-state.json'),
  workerHostEndpoints: z
    .array(
      z.object({
        name: z.string(),
        healthUrl: z.string().url(),
        metricsUrl: z.string().url().optional(),
      }),
    )
    .default([]),
  autoRestartFailedWorkers: z.boolean().default(true),
  healthPollIntervalMs: z.number().int().positive().default(30000),
  replicationMonitorStatusUrl: z
    .string()
    .url()
    .default('http://127.0.0.1:9088/replication/status'),
  replicationMonitorTimeoutMs: z.number().int().positive().default(5000),
});

export type CoordinatorConfig = z.infer<typeof CoordinatorConfigSchema>;

export const LocalDatabaseConfigSchema = DatabaseConfigSchema.extend({
  role: z.literal('local'),
});

export type LocalDatabaseConfig = z.infer<typeof LocalDatabaseConfigSchema>;

export const OnlineDatabaseConfigSchema = DatabaseConfigSchema.extend({
  role: z.literal('online'),
  facilityCode: z.string().min(1),
});

export type OnlineDatabaseConfig = z.infer<typeof OnlineDatabaseConfigSchema>;

export const PlatformConfigSchema = z.object({
  environment: z.enum(['development', 'staging', 'production']).default('development'),
  logging: LoggingConfigSchema.default({}),
  retry: RetryConfigSchema.default({}),
  worker: WorkerConfigSchema.default({}),
  coordinator: CoordinatorConfigSchema.default({}),
  monitoring: MonitoringConfigSchema.default({}),
  rhie: RhieConfigSchema,
  clientRegistry: ClientRegistryConfigSchema.default({}),
  encounterId: EncounterIdConfigSchema.default({}),
  integrationState: IntegrationStateConfigSchema.default({}),
  replicationMonitor: ReplicationMonitorConfigSchema.default({}),
  localDatabase: LocalDatabaseConfigSchema,
  onlineDatabases: z.array(OnlineDatabaseConfigSchema).default([]),
});

export type PlatformConfig = z.infer<typeof PlatformConfigSchema>;

export type ProcessingMode = 'online' | 'local' | 'standby';

export type { ClientRegistryConfig, ClientRegistryExecutionMode } from './client-registry.js';
export { ClientRegistryConfigSchema } from './client-registry.js';
export type { EncounterIdConfig, EncounterIdExecutionMode } from './encounter-id.js';
export { EncounterIdConfigSchema } from './encounter-id.js';
export type { IntegrationStateConfig } from './integration-state.js';
export { IntegrationStateConfigSchema } from './integration-state.js';
export type { ReplicationMonitorConfig } from './replication-monitor.js';
export { ReplicationMonitorConfigSchema } from './replication-monitor.js';

export type ReplicationHealthStatus =
  | 'healthy'
  | 'degraded'
  | 'unhealthy'
  | 'unknown'
  | 'not_replica';

export interface FacilityProcessingState {
  facilityId: string;
  mode: ProcessingMode;
  onlineAvailable: boolean;
  localAvailable?: boolean;
  replicationHealthy?: boolean;
  replicationLagSeconds?: number | null;
  replicationStatus?: ReplicationHealthStatus;
  lastSyncCheck: string;
  reason?: string;
}

export interface CoordinatorState {
  updatedAt: string;
  globalMode: ProcessingMode;
  facilities: Record<string, FacilityProcessingState>;
  workerHosts?: Record<string, WorkerHostHealthState>;
}

export interface WorkerHostHealthState {
  name: string;
  status: 'healthy' | 'degraded' | 'offline';
  lastPoll: string;
  workerCount?: number;
  failedWorkers?: number;
}
