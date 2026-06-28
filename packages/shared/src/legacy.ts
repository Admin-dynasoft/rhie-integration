/**
 * Legacy Phase 1 worker API — wraps new worker-framework for backward compatibility.
 * New code should use @rhie/worker-framework and @rhie/worker-host directly.
 */
import type { Logger } from '@rhie/logger';
import type { HealthMonitor } from '@rhie/monitoring';
import type { DatabaseConnection } from '@rhie/database';
import type { RhieClient } from '@rhie/rhie-client';
import {
  ModeAwareWorker,
  type BatchResult,
  type WorkerDependencies,
  type WorkerIdentity,
  type WorkerExecutionContext,
  shouldWorkerRun,
  isStandby,
} from '@rhie/worker-framework';
import { loadConfig, getConfig } from '@rhie/config';
import { DatabaseManager } from '@rhie/database';
import { createLogger } from '@rhie/logger';
import { createHealthMonitor, startHealthServer } from '@rhie/monitoring';
import { createRhieClient } from '@rhie/rhie-client';

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

class LegacyWorkerAdapter extends ModeAwareWorker {
  constructor(
    deps: WorkerDependencies,
    identity: WorkerIdentity,
    private readonly definition: WorkerDefinition,
    private readonly legacyContext: WorkerContext,
  ) {
    super(deps, identity);
  }

  get workerType(): string {
    return this.definition.name;
  }

  protected async processBatch(_ctx: WorkerExecutionContext): Promise<BatchResult> {
    return this.definition.processBatch(this.legacyContext);
  }

  protected override shouldRun(): boolean {
    const facility = this.identity.facilityId;
    if (isStandby(facility)) return false;

    const mode = this.definition.databaseRole;
    if (mode === 'local') {
      return shouldWorkerRun('local', facility);
    }
    return shouldWorkerRun('online', facility);
  }
}

export class ContinuousWorker {
  private adapter: LegacyWorkerAdapter;

  constructor(opts: {
    definition: WorkerDefinition;
    context: WorkerContext;
    options: WorkerOptions;
  }) {
    const identity: WorkerIdentity = {
      workerType: opts.definition.name,
      workerId: opts.context.workerId,
      mode: opts.definition.databaseRole,
      databaseId: opts.context.databaseId,
      facilityId: opts.context.facilityId,
    };

    const deps: WorkerDependencies = {
      logger: opts.context.logger,
      database: opts.context.database,
      rhieClient: opts.context.rhieClient,
      workerConfig: {
        ...getConfig().worker,
        sleepIntervalMs: opts.options.sleepIntervalMs,
        batchSize: opts.options.batchSize,
      },
      retryConfig: getConfig().retry,
    };

    this.adapter = new LegacyWorkerAdapter(deps, identity, opts.definition, opts.context);
  }

  start(): Promise<void> {
    return this.adapter.start();
  }

  stop(): Promise<void> {
    return this.adapter.stop();
  }
}

export function createWorkerContext(params: WorkerContext): WorkerContext {
  return { ...params };
}

export async function createStubProcessResult(
  ..._args: unknown[]
): Promise<WorkerProcessResult> {
  return { processed: 0, failed: 0, skipped: 0 };
}

export interface ServiceBootstrapOptions {
  serviceName: string;
  workerDefinitions: WorkerDefinition[];
  healthPortOffset?: number;
}

export class ServiceLifecycle {
  private workers: ContinuousWorker[] = [];
  private healthServer: ReturnType<typeof startHealthServer> | null = null;

  constructor(private readonly options: ServiceBootstrapOptions) {}

  async start(): Promise<void> {
    const config = await loadConfig();
    const logger = createLogger({ service: this.options.serviceName }, config.logging);
    const dbManager = new DatabaseManager(logger);
    const rhieClient = createRhieClient({ config: config.rhie, retryConfig: config.retry, logger });

    await dbManager.register(config.localDatabase);
    for (const db of config.onlineDatabases.filter((d) => d.enabled)) {
      await dbManager.register(db);
    }

    for (const definition of this.options.workerDefinitions) {
      if (definition.databaseRole === 'local') {
        this.spawnWorker(definition, config.localDatabase.id, undefined, dbManager, rhieClient, config);
      } else {
        for (const db of config.onlineDatabases.filter((d) => d.enabled)) {
          this.spawnWorker(definition, db.id, db.facilityCode, dbManager, rhieClient, config);
        }
      }
    }

    for (const w of this.workers) {
      void w.start();
    }

    if (config.monitoring.metricsEnabled) {
      const port = config.monitoring.healthPort + (this.options.healthPortOffset ?? 0);
      this.healthServer = startHealthServer({ port, logger, serviceName: this.options.serviceName });
    }

    const shutdown = () => {
      this.healthServer?.close();
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  }

  private spawnWorker(
    definition: WorkerDefinition,
    databaseId: string,
    facilityId: string | undefined,
    dbManager: DatabaseManager,
    rhieClient: RhieClient,
    config: Awaited<ReturnType<typeof loadConfig>>,
  ): void {
    const workerId = `${definition.name}-${facilityId ?? 'local'}`;
    const logger = createLogger(
      { service: this.options.serviceName, workerId, databaseId, facilityId },
      config.logging,
    );
    const healthMonitor = createHealthMonitor(this.options.serviceName, logger, {
      databaseId,
      workerId,
      facilityId,
      heartbeatIntervalMs: config.worker.heartbeatIntervalMs,
    });

    const context: WorkerContext = {
      serviceName: this.options.serviceName,
      workerId,
      databaseId,
      facilityId,
      logger,
      healthMonitor,
      database: dbManager.getOrThrow(databaseId),
      rhieClient,
    };

    this.workers.push(
      new ContinuousWorker({
        definition,
        context,
        options: {
          sleepIntervalMs: config.worker.sleepIntervalMs,
          batchSize: config.worker.batchSize,
        },
      }),
    );
  }
}

export async function bootstrapService(options: ServiceBootstrapOptions): Promise<void> {
  const lifecycle = new ServiceLifecycle(options);
  await lifecycle.start();
}
