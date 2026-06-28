import type { Server } from 'node:http';
import { loadConfig, type PlatformConfig, type OnlineDatabaseConfig } from '@rhie/config';
import { DatabaseManager } from '@rhie/database';
import { createLogger, type Logger } from '@rhie/logger';
import { createHealthMonitor, startHealthServer } from '@rhie/monitoring';
import { createRhieClient, type RhieClient } from '@rhie/rhie-client';
import { ContinuousWorker, createWorkerContext } from './worker.js';
import type { WorkerDefinition } from './types.js';

export interface ServiceBootstrapOptions {
  serviceName: string;
  workerDefinitions: WorkerDefinition[];
  healthPortOffset?: number;
}

export class ServiceLifecycle {
  private config!: PlatformConfig;
  private logger!: Logger;
  private dbManager!: DatabaseManager;
  private rhieClient!: RhieClient;
  private workers: ContinuousWorker[] = [];
  private healthServer: Server | null = null;
  private shuttingDown = false;

  constructor(private readonly options: ServiceBootstrapOptions) {}

  async start(): Promise<void> {
    this.config = loadConfig();
    this.logger = createLogger(
      { service: this.options.serviceName },
      this.config.logging,
    );

    this.logger.info({ event: 'service_start' }, `${this.options.serviceName} starting`);

    this.dbManager = new DatabaseManager(this.logger);
    this.rhieClient = createRhieClient({
      config: this.config.rhie,
      retryConfig: this.config.retry,
      logger: this.logger,
    });

    await this.registerDatabases();
    await this.spawnWorkers();

    if (this.config.monitoring.metricsEnabled) {
      const port =
        this.config.monitoring.healthPort + (this.options.healthPortOffset ?? 0);
      this.healthServer = startHealthServer({
        port,
        logger: this.logger,
        serviceName: this.options.serviceName,
      });
    }

    this.setupGracefulShutdown();
    this.logger.info({ event: 'service_ready' }, `${this.options.serviceName} ready`);
  }

  private async registerDatabases(): Promise<void> {
    const { localDatabase, onlineDatabases } = this.config;
    const rolesNeeded = new Set(this.options.workerDefinitions.map((w) => w.databaseRole));

    if (rolesNeeded.has('local')) {
      await this.dbManager.register(localDatabase);
    }

    if (rolesNeeded.has('online')) {
      const enabled = onlineDatabases.filter((db) => db.enabled);
      await Promise.all(enabled.map((db) => this.dbManager.register(db)));
    }
  }

  private async spawnWorkers(): Promise<void> {
    for (const definition of this.options.workerDefinitions) {
      if (definition.databaseRole === 'local') {
        await this.spawnSingleWorker(definition, this.config.localDatabase.id);
        continue;
      }

      const onlineDbs = this.config.onlineDatabases.filter((db) => db.enabled);
      for (const db of onlineDbs) {
        await this.spawnOnlineWorker(definition, db);
      }
    }

    for (const worker of this.workers) {
      void worker.start();
    }
  }

  private async spawnSingleWorker(
    definition: WorkerDefinition,
    databaseId: string,
  ): Promise<void> {
    const workerId = `${definition.name}-local`;
    const logger = createLogger(
      {
        service: this.options.serviceName,
        databaseId,
        workerId,
      },
      this.config.logging,
    );

    const healthMonitor = createHealthMonitor(this.options.serviceName, logger, {
      databaseId,
      workerId,
      heartbeatIntervalMs: this.config.worker.heartbeatIntervalMs,
    });

    const database = this.dbManager.getOrThrow(databaseId);

    const context = createWorkerContext({
      serviceName: this.options.serviceName,
      workerId,
      databaseId,
      logger,
      healthMonitor,
      database,
      rhieClient: this.rhieClient,
    });

    this.workers.push(
      new ContinuousWorker({
        definition,
        context,
        options: {
          sleepIntervalMs: this.config.worker.sleepIntervalMs,
          batchSize: this.config.worker.batchSize,
        },
      }),
    );
  }

  private async spawnOnlineWorker(
    definition: WorkerDefinition,
    dbConfig: OnlineDatabaseConfig,
  ): Promise<void> {
    const workerId = `${definition.name}-${dbConfig.facilityCode}`;
    const logger = createLogger(
      {
        service: this.options.serviceName,
        facilityId: dbConfig.facilityCode,
        databaseId: dbConfig.id,
        workerId,
      },
      this.config.logging,
    );

    const healthMonitor = createHealthMonitor(this.options.serviceName, logger, {
      facilityId: dbConfig.facilityCode,
      databaseId: dbConfig.id,
      workerId,
      heartbeatIntervalMs: this.config.worker.heartbeatIntervalMs,
    });

    const database = this.dbManager.getOrThrow(dbConfig.id);

    const context = createWorkerContext({
      serviceName: this.options.serviceName,
      workerId,
      databaseId: dbConfig.id,
      facilityId: dbConfig.facilityCode,
      logger,
      healthMonitor,
      database,
      rhieClient: this.rhieClient,
    });

    const onlineDefinition: WorkerDefinition = {
      ...definition,
      name: `${definition.name}:${dbConfig.facilityCode}`,
    };

    this.workers.push(
      new ContinuousWorker({
        definition: onlineDefinition,
        context,
        options: {
          sleepIntervalMs: this.config.worker.sleepIntervalMs,
          batchSize: this.config.worker.batchSize,
        },
      }),
    );
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      if (this.shuttingDown) {
        return;
      }
      this.shuttingDown = true;

      this.logger.info({ event: 'service_shutdown', signal }, 'Shutting down service');

      for (const worker of this.workers) {
        worker.stop();
      }

      if (this.healthServer) {
        this.healthServer.close();
      }

      await this.dbManager.disconnectAll();
      this.logger.info({ event: 'service_stopped' }, `${this.options.serviceName} stopped`);
      process.exit(0);
    };

    process.on('SIGINT', () => void shutdown('SIGINT'));
    process.on('SIGTERM', () => void shutdown('SIGTERM'));
  }
}

export async function bootstrapService(options: ServiceBootstrapOptions): Promise<void> {
  const lifecycle = new ServiceLifecycle(options);
  await lifecycle.start();
}
