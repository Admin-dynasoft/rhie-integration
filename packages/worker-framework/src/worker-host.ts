import { loadConfig, type PlatformConfig } from '@rhie/config';
import { createLogger, type Logger } from '@rhie/logger';
import { createRhieClient, type RhieClient } from '@rhie/rhie-client';
import { globalMetricsCollector } from '@rhie/metrics';
import { HealthHttpServer, RhieHealthCheck, globalHealthRegistry } from '@rhie/health';
import { MetricsHttpServer } from '@rhie/metrics';
import {
  AbstractWorker,
  type WorkerDependencies,
  type WorkerFactory,
  type WorkerIdentity,
  type WorkerMode,
} from './abstract-worker.js';
import { MultiDatabaseManager } from './multi-database-manager.js';
import { GracefulShutdownManager, stopAllWorkers } from './graceful-shutdown.js';

export interface WorkerHostOptions {
  serviceName: string;
  workerFactories: WorkerFactory[];
  modes?: WorkerMode[];
  healthPort?: number;
  metricsPort?: number;
  platformConfig?: PlatformConfig;
}

export class WorkerHost {
  private config!: PlatformConfig;
  private logger!: Logger;
  private dbManager!: MultiDatabaseManager;
  private rhieClient!: RhieClient;
  private workers: AbstractWorker[] = [];
  private shutdownManager!: GracefulShutdownManager;
  private healthServer: HealthHttpServer | null = null;
  private metricsServer: MetricsHttpServer | null = null;
  private metricsInterval?: ReturnType<typeof setInterval>;

  constructor(private readonly options: WorkerHostOptions) {}

  async start(): Promise<void> {
    this.config = this.options.platformConfig ?? await loadConfig();
    this.logger = createLogger({ service: this.options.serviceName }, this.config.logging);

    this.logger.info({ event: 'worker_host_start' }, `${this.options.serviceName} worker host starting`);

    this.dbManager = new MultiDatabaseManager(this.logger);
    await this.dbManager.initialize(this.config);

    this.rhieClient = createRhieClient({
      config: this.config.rhie,
      retryConfig: this.config.retry,
      logger: this.logger,
    });

    globalHealthRegistry.register(
      new RhieHealthCheck('rhie-api', () => this.rhieClient.ping()),
    );

    await this.spawnWorkers();

    this.startMetricsSync();
    this.startHttpServers();
    this.setupShutdown();

    this.logger.info(
      { event: 'worker_host_ready', workerCount: this.workers.length },
      `${this.options.serviceName} ready with ${this.workers.length} workers`,
    );
  }

  getWorkers(): AbstractWorker[] {
    return [...this.workers];
  }

  async restartFailedWorkers(): Promise<number> {
    let restarted = 0;
    for (const worker of this.workers) {
      const snapshot = worker.getMetricsSnapshot();
      if (snapshot.status === 'error') {
        await worker.restart();
        restarted++;
      }
    }
    return restarted;
  }

  private async spawnWorkers(): Promise<void> {
    const modes = this.options.modes ?? (['online', 'local'] as WorkerMode[]);
    const workerConfig = this.config.worker;

    for (const mode of modes) {
      const targets = this.dbManager.getTargetsForMode(mode, this.config);

      for (const target of targets) {
        const connection = this.dbManager.getConnection(target.config.id);
        if (!connection) {
          this.logger.warn(
            { event: 'worker_spawn_skipped', databaseId: target.config.id },
            'Skipping worker — database not connected',
          );
          continue;
        }

        for (const factory of this.options.workerFactories) {
          const workerId = `${factory.workerType}-${mode}-${target.facilityCode ?? 'local'}`;
          const logger = createLogger(
            {
              service: this.options.serviceName,
              workerId,
              databaseId: target.config.id,
              facilityId: target.facilityId,
            },
            this.config.logging,
          );

          const identity: WorkerIdentity = {
            workerType: factory.workerType,
            workerId,
            mode,
            databaseId: target.config.id,
            facilityId: target.facilityId,
            facilityCode: target.facilityCode,
          };

          const deps: WorkerDependencies = {
            logger,
            database: connection,
            rhieClient: this.rhieClient,
            workerConfig,
            retryConfig: this.config.retry,
          };

          const worker = factory.create(deps, identity);
          this.workers.push(worker);
          globalMetricsCollector.register(worker.getMetricsSnapshot());
          void worker.start();
        }
      }
    }
  }

  private startMetricsSync(): void {
    this.metricsInterval = setInterval(() => {
      for (const worker of this.workers) {
        globalMetricsCollector.update(worker.identity.workerId, worker.getMetricsSnapshot());
      }
    }, this.config.worker.heartbeatIntervalMs);
  }

  private startHttpServers(): void {
    if (!this.config.monitoring.metricsEnabled) {
      return;
    }

    const healthPort = this.options.healthPort ?? this.config.monitoring.healthPort;
    const metricsPort = this.options.metricsPort ?? healthPort + 100;

    this.healthServer = new HealthHttpServer({
      port: healthPort,
      logger: this.logger,
      serviceName: this.options.serviceName,
      registry: globalHealthRegistry,
      getWorkerMetrics: () => globalMetricsCollector.toJSON(),
    });
    this.healthServer.start();

    this.metricsServer = new MetricsHttpServer({
      port: metricsPort,
      logger: this.logger,
      collector: globalMetricsCollector,
    });
    this.metricsServer.start();
  }

  private setupShutdown(): void {
    this.shutdownManager = new GracefulShutdownManager(this.logger);

    this.shutdownManager.register(async () => {
      if (this.metricsInterval) {
        clearInterval(this.metricsInterval);
      }
    });

    this.shutdownManager.register(async () => {
      await stopAllWorkers(this.workers, this.logger);
    });

    this.shutdownManager.register(async () => {
      this.healthServer?.stop();
      this.metricsServer?.stop();
    });

    this.shutdownManager.register(async () => {
      await this.dbManager.disconnectAll();
    });
  }
}

export async function bootstrapWorkerHost(options: WorkerHostOptions): Promise<WorkerHost> {
  const host = new WorkerHost(options);
  await host.start();
  return host;
}
