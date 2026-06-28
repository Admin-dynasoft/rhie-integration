import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import axios from 'axios';
import {
  loadConfig,
  type CoordinatorState,
  type FacilityProcessingState,
  type ProcessingMode,
  type WorkerHostHealthState,
} from '@rhie/config';
import { createLogger } from '@rhie/logger';
import { MultiDatabaseManager } from '@rhie/worker-framework';
import { HealthHttpServer, globalHealthRegistry } from '@rhie/health';
import { GracefulShutdownManager } from '@rhie/worker-framework';

interface SyncHealthResult {
  localOk: boolean;
  onlineStatus: Record<string, boolean>;
}

export class PlatformCoordinator {
  private readonly config = loadConfig();
  private readonly logger = createLogger({ service: 'coordinator' }, this.config.logging);
  private readonly dbManager = new MultiDatabaseManager(this.logger);
  private readonly shutdownManager = new GracefulShutdownManager(this.logger);
  private running = false;
  private lastSyncHealth: SyncHealthResult = { localOk: false, onlineStatus: {} };
  private lastWorkerHostHealth: Record<string, WorkerHostHealthState> = {};
  private healthServer: HealthHttpServer | null = null;

  async start(): Promise<void> {
    this.logger.info({ event: 'coordinator_start' }, 'Platform coordinator starting');

    await this.dbManager.initialize(this.config);

    if (this.config.monitoring.metricsEnabled) {
      this.healthServer = new HealthHttpServer({
        port: this.config.monitoring.healthPort,
        logger: this.logger,
        serviceName: 'coordinator',
        registry: globalHealthRegistry,
        getWorkerMetrics: () => ({
          syncHealth: this.lastSyncHealth,
          workerHosts: this.lastWorkerHostHealth,
        }),
      });
      this.healthServer.start();
    }

    this.setupShutdown();
    this.running = true;

    while (this.running) {
      try {
        await this.evaluateAndPersist();
        await sleep(this.config.coordinator.syncHealthCheckIntervalMs);
      } catch (error) {
        this.logger.error(
          { event: 'coordinator_error', error: error instanceof Error ? error.message : String(error) },
          'Coordinator cycle failed',
        );
        await sleep(this.config.coordinator.syncHealthCheckIntervalMs);
      }
    }
  }

  stop(): void {
    this.running = false;
  }

  private async evaluateAndPersist(): Promise<void> {
    this.lastSyncHealth = await this.checkSyncHealth();
    this.lastWorkerHostHealth = await this.pollWorkerHosts();

    const facilities = this.computeFacilityModes(this.lastSyncHealth);
    const globalMode = this.computeGlobalMode(facilities, this.lastSyncHealth.localOk);

    const state: CoordinatorState = {
      updatedAt: new Date().toISOString(),
      globalMode,
      facilities,
      workerHosts: this.lastWorkerHostHealth,
    };

    this.persistState(state);

    this.logger.debug(
      {
        event: 'coordinator_state_updated',
        globalMode,
        facilityCount: Object.keys(facilities).length,
        workerHosts: Object.keys(this.lastWorkerHostHealth).length,
      },
      'Coordinator state updated',
    );
  }

  private computeFacilityModes(syncHealth: SyncHealthResult): Record<string, FacilityProcessingState> {
    const facilities: Record<string, FacilityProcessingState> = {};

    for (const db of this.config.onlineDatabases.filter((d) => d.enabled)) {
      const onlineAvailable = syncHealth.onlineStatus[db.id] ?? false;
      let mode: ProcessingMode;

      if (onlineAvailable && syncHealth.localOk) {
        mode = 'online';
      } else if (!onlineAvailable && syncHealth.localOk) {
        mode = 'local';
      } else if (onlineAvailable) {
        mode = 'online';
      } else {
        mode = 'standby';
      }

      facilities[db.facilityCode] = {
        facilityId: db.facilityCode,
        mode,
        onlineAvailable,
        lastSyncCheck: new Date().toISOString(),
        reason: this.buildModeReason(mode, onlineAvailable, syncHealth.localOk),
      };
    }

    return facilities;
  }

  private computeGlobalMode(
    facilities: Record<string, FacilityProcessingState>,
    localOk: boolean,
  ): ProcessingMode {
    const onlineAvailableCount = Object.values(facilities).filter((f) => f.onlineAvailable).length;
    if (onlineAvailableCount > 0 && localOk) return 'online';
    if (localOk) return 'local';
    return 'standby';
  }

  private buildModeReason(mode: ProcessingMode, onlineAvailable: boolean, localOk: boolean): string {
    switch (mode) {
      case 'online':
        return 'Online database available — online workers active';
      case 'local':
        return onlineAvailable ? 'Fallback' : 'Online unavailable — local workers active';
      case 'standby':
        return localOk ? 'Waiting for online recovery' : 'All databases unavailable';
      default:
        return '';
    }
  }

  private async checkSyncHealth(): Promise<SyncHealthResult> {
    const pingResults = await this.dbManager.pingAll();
    const localOk = pingResults[this.config.localDatabase.id] ?? false;
    const onlineStatus: Record<string, boolean> = {};

    for (const db of this.config.onlineDatabases.filter((d) => d.enabled)) {
      onlineStatus[db.id] = pingResults[db.id] ?? false;

      if (!onlineStatus[db.id]) {
        try {
          await this.dbManager.reconnect(db.id);
          onlineStatus[db.id] = await this.dbManager.getConnectionOrThrow(db.id).ping();
        } catch {
          onlineStatus[db.id] = false;
        }
      }
    }

    if (!localOk) {
      try {
        await this.dbManager.reconnect(this.config.localDatabase.id);
      } catch {
        // logged by db manager
      }
    }

    return { localOk: pingResults[this.config.localDatabase.id] ?? localOk, onlineStatus };
  }

  private async pollWorkerHosts(): Promise<Record<string, WorkerHostHealthState>> {
    const results: Record<string, WorkerHostHealthState> = {};
    const endpoints = this.config.coordinator.workerHostEndpoints;
    const staleThreshold = this.config.coordinator.serviceHeartbeatTimeoutMs;
    const now = Date.now();

    for (const endpoint of endpoints) {
      try {
        const response = await axios.get(endpoint.healthUrl, { timeout: 5000 });
        const data = response.data as {
          status?: string;
          workers?: Record<string, { status: string; lastHeartbeat?: string; healthStatus?: string }>;
        };

        const workers = data.workers ?? {};
        const workerEntries = Object.values(workers);
        const failedWorkers = workerEntries.filter(
          (w) => w.status === 'error' || w.healthStatus === 'offline',
        ).length;

        const staleWorkers = workerEntries.filter((w) => {
          if (!w.lastHeartbeat) return false;
          return now - new Date(w.lastHeartbeat).getTime() > staleThreshold;
        });

        let status: 'healthy' | 'degraded' | 'offline' = 'healthy';
        if (failedWorkers > 0 || staleWorkers.length > 0) {
          status = 'degraded';
        }
        if (response.status >= 500 || data.status === 'offline') {
          status = 'offline';
        }

        results[endpoint.name] = {
          name: endpoint.name,
          status,
          lastPoll: new Date().toISOString(),
          workerCount: workerEntries.length,
          failedWorkers,
        };

        if (failedWorkers > 0) {
          this.logger.warn(
            { event: 'failed_workers_detected', host: endpoint.name, failedWorkers },
            `Failed workers detected on ${endpoint.name}`,
          );
        }
      } catch (error) {
        results[endpoint.name] = {
          name: endpoint.name,
          status: 'offline',
          lastPoll: new Date().toISOString(),
        };
        this.logger.warn(
          {
            event: 'worker_host_unreachable',
            host: endpoint.name,
            error: error instanceof Error ? error.message : String(error),
          },
          `Worker host unreachable: ${endpoint.name}`,
        );
      }
    }

    return results;
  }

  private persistState(state: CoordinatorState): void {
    const statePath = resolve(process.cwd(), this.config.coordinator.stateFilePath);
    const dir = dirname(statePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf-8');
  }

  private setupShutdown(): void {
    this.shutdownManager.register(async () => {
      this.stop();
      this.healthServer?.stop();
      await this.dbManager.disconnectAll();
    });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const coordinator = new PlatformCoordinator();
  await coordinator.start();
}

main().catch((error) => {
  console.error('Coordinator failed:', error);
  process.exit(1);
});
