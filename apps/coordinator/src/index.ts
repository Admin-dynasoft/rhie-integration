import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import axios from 'axios';
import {
  loadConfig,
  resolveRepositoryRoot,
  type CoordinatorState,
  type FacilityProcessingState,
  type ProcessingMode,
  type WorkerHostHealthState,
} from '@rhie/config';
import type { ReplicationMonitorSnapshot } from '@rhie/replication-monitor';
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
  private lastReplicationSnapshot: ReplicationMonitorSnapshot | null = null;
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
          replication: this.lastReplicationSnapshot,
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
    this.lastReplicationSnapshot = await this.pollReplicationMonitor();
    this.lastWorkerHostHealth = await this.pollWorkerHosts();

    const facilities = this.computeFacilityModes(
      this.lastSyncHealth,
      this.lastReplicationSnapshot,
    );
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
        replicationHealthy: this.lastReplicationSnapshot?.globalHealthy,
      },
      'Coordinator state updated',
    );
  }

  private computeFacilityModes(
    syncHealth: SyncHealthResult,
    replication: ReplicationMonitorSnapshot | null,
  ): Record<string, FacilityProcessingState> {
    const facilities: Record<string, FacilityProcessingState> = {};
    const preferLocalOnLag = this.config.replicationMonitor.preferLocalOnLag;

    for (const db of this.config.onlineDatabases.filter((d) => d.enabled)) {
      const replFacility = replication?.facilities[db.facilityCode];
      const localOk = replFacility?.localReachable ?? syncHealth.localOk;
      const onlineOk = replFacility?.onlineReachable ?? (syncHealth.onlineStatus[db.id] ?? false);
      const replicationHealthy = replFacility?.healthy ?? (replication == null ? true : false);
      const replicationLag = replFacility?.lagSeconds ?? null;
      const replicationStatus = replFacility?.status;

      let mode: ProcessingMode;

      if (!localOk && !onlineOk) {
        mode = 'standby';
      } else if (!localOk && onlineOk) {
        mode = 'standby';
      } else if (localOk && onlineOk && replicationHealthy) {
        mode = 'online';
      } else if (localOk && (!onlineOk || (preferLocalOnLag && !replicationHealthy))) {
        mode = 'local';
      } else if (onlineOk) {
        mode = 'online';
      } else {
        mode = 'standby';
      }

      facilities[db.facilityCode] = {
        facilityId: db.facilityCode,
        mode,
        onlineAvailable: onlineOk,
        localAvailable: localOk,
        replicationHealthy,
        replicationLagSeconds: replicationLag,
        replicationStatus,
        lastSyncCheck: new Date().toISOString(),
        reason: this.buildModeReason(mode, {
          onlineOk,
          localOk,
          replicationHealthy,
          replicationLag,
          replicationStatus,
        }),
      };
    }

    return facilities;
  }

  private computeGlobalMode(
    facilities: Record<string, FacilityProcessingState>,
    localOk: boolean,
  ): ProcessingMode {
    const modes = Object.values(facilities).map((f) => f.mode);
    if (modes.includes('online')) return 'online';
    if (modes.includes('local') && localOk) return 'local';
    return 'standby';
  }

  private buildModeReason(
    mode: ProcessingMode,
    ctx: {
      onlineOk: boolean;
      localOk: boolean;
      replicationHealthy: boolean;
      replicationLag: number | null;
      replicationStatus?: string;
    },
  ): string {
    switch (mode) {
      case 'online':
        return 'Online DB available with healthy replication — online workers active';
      case 'local':
        if (!ctx.onlineOk) {
          return 'Online unavailable — local workers active';
        }
        if (!ctx.replicationHealthy) {
          return `Replication ${ctx.replicationStatus ?? 'unhealthy'} (lag ${ctx.replicationLag ?? 'unknown'}s) — local workers active`;
        }
        return 'Local workers active';
      case 'standby':
        if (!ctx.localOk && !ctx.onlineOk) {
          return 'All databases unavailable';
        }
        if (!ctx.localOk) {
          return 'Local database unavailable — cannot verify clinical source';
        }
        return 'Waiting for database or replication recovery';
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

  private async pollReplicationMonitor(): Promise<ReplicationMonitorSnapshot | null> {
    const url = this.config.coordinator.replicationMonitorStatusUrl;

    try {
      const response = await axios.get<ReplicationMonitorSnapshot>(url, {
        timeout: this.config.coordinator.replicationMonitorTimeoutMs,
      });
      return response.data;
    } catch (error) {
      this.logger.warn(
        {
          event: 'replication_monitor_unreachable',
          url,
          error: error instanceof Error ? error.message : String(error),
        },
        'Replication monitor unreachable — falling back to connectivity-only mode decisions',
      );
      return null;
    }
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
    const statePath = resolve(resolveRepositoryRoot(), this.config.coordinator.stateFilePath);
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
