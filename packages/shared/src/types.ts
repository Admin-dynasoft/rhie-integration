import type { Logger } from '@rhie/logger';
import type { HealthMonitor } from '@rhie/monitoring';
import type { DatabaseConnection } from '@rhie/database';
import type { RhieClient } from '@rhie/rhie-client';

export interface WorkerContext {
  serviceName: string;
  workerId: string;
  databaseId: string;
  facilityId?: string;
  logger: Logger;
  healthMonitor: HealthMonitor;
  database: DatabaseConnection;
  rhieClient: RhieClient;
}

export interface WorkerProcessResult {
  processed: number;
  failed: number;
  skipped: number;
}

export interface WorkerOptions {
  sleepIntervalMs: number;
  batchSize: number;
}

export interface WorkerDefinition {
  readonly name: string;
  readonly databaseRole: 'local' | 'online';
  processBatch(context: WorkerContext): Promise<WorkerProcessResult>;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
