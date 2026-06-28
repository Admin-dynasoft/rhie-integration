import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  loadConfig,
  type CoordinatorState,
  type FacilityProcessingState,
  type ProcessingMode,
} from '@rhie/config';
import { DatabaseManager, checkDatabaseHealth } from '@rhie/database';
import { createLogger } from '@rhie/logger';
import { createHealthMonitor, startHealthServer, getAllHealthSnapshots } from '@rhie/monitoring';
import { sleep } from '@rhie/shared';

interface SyncHealthResult {
  localOk: boolean;
  onlineStatus: Record<string, boolean>;
}

export class SynchronizationCoordinator {
  private readonly config = loadConfig();
  private readonly logger = createLogger({ service: 'coordinator' }, this.config.logging);
  private readonly dbManager = new DatabaseManager(this.logger);
  private readonly healthMonitor = createHealthMonitor('coordinator', this.logger, {
    heartbeatIntervalMs: this.config.worker.heartbeatIntervalMs,
  });
  private running = false;
  private lastSyncHealth: SyncHealthResult = { localOk: false, onlineStatus: {} };

  async start(): Promise<void> {
    this.logger.info({ event: 'coordinator_start' }, 'Synchronization coordinator starting');

    await this.dbManager.register(this.config.localDatabase);

    for (const db of this.config.onlineDatabases.filter((d) => d.enabled)) {
      try {
        await this.dbManager.register(db);
      } catch (error) {
        this.logger.warn(
          {
            event: 'online_db_register_failed',
            databaseId: db.id,
            error: error instanceof Error ? error.message : String(error),
          },
          `Failed to register online database: ${db.name}`,
        );
      }
    }

    if (this.config.monitoring.metricsEnabled) {
      startHealthServer({
        port: this.config.monitoring.healthPort,
        logger: this.logger,
        serviceName: 'coordinator',
        getAdditionalHealth: () => ({
          coordinatorState: this.readState(),
          syncHealth: this.lastSyncHealth,
        }),
      });
    }

    this.running = true;
    this.healthMonitor.setStatus('running');
    this.setupGracefulShutdown();

    while (this.running) {
      try {
        await this.evaluateAndPersist();
        this.healthMonitor.emitHeartbeat();
        await sleep(this.config.coordinator.syncHealthCheckIntervalMs);
      } catch (error) {
        this.logger.error(
          {
            event: 'coordinator_error',
            error: error instanceof Error ? error.message : String(error),
          },
          'Coordinator evaluation cycle failed',
        );
        this.healthMonitor.setStatus('error');
        await sleep(this.config.coordinator.syncHealthCheckIntervalMs);
        this.healthMonitor.setStatus('running');
      }
    }
  }

  stop(): void {
    this.running = false;
    this.healthMonitor.markStopped();
  }

  private async evaluateAndPersist(): Promise<void> {
    const syncHealth = await this.checkSyncHealth();
    this.lastSyncHealth = syncHealth;

    const serviceSnapshots = getAllHealthSnapshots();
    const staleThreshold = this.config.coordinator.serviceHeartbeatTimeoutMs;
    const now = Date.now();

    const staleServices = serviceSnapshots.filter((s) => {
      const lastBeat = new Date(s.lastHeartbeat).getTime();
      return now - lastBeat > staleThreshold && s.status !== 'stopped';
    });

    if (staleServices.length > 0) {
      this.logger.warn(
        {
          event: 'stale_services_detected',
          services: staleServices.map((s) => s.service),
        },
        'Stale service heartbeats detected',
      );
    }

    const facilities: Record<string, FacilityProcessingState> = {};
    const onlineDbs = this.config.onlineDatabases.filter((d) => d.enabled);

    for (const db of onlineDbs) {
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

    const onlineAvailableCount = Object.values(facilities).filter((f) => f.onlineAvailable).length;
    let globalMode: ProcessingMode = 'standby';

    if (onlineAvailableCount > 0 && syncHealth.localOk) {
      globalMode = 'online';
    } else if (syncHealth.localOk) {
      globalMode = 'local';
    }

    const state: CoordinatorState = {
      updatedAt: new Date().toISOString(),
      globalMode,
      facilities,
    };

    this.persistState(state);

    this.logger.debug(
      {
        event: 'coordinator_state_updated',
        globalMode,
        facilityCount: Object.keys(facilities).length,
      },
      'Coordinator state updated',
    );
  }

  private buildModeReason(
    mode: ProcessingMode,
    onlineAvailable: boolean,
    localOk: boolean,
  ): string {
    switch (mode) {
      case 'online':
        return 'Online database available — online services are primary';
      case 'local':
        return onlineAvailable
          ? 'Fallback unavailable'
          : 'Online database unavailable — local services active';
      case 'standby':
        return localOk
          ? 'Waiting for online recovery'
          : 'Both local and online databases unavailable';
      default:
        return '';
    }
  }

  private async checkSyncHealth(): Promise<SyncHealthResult> {
    const localConn = this.dbManager.get(this.config.localDatabase.id);
    const localHealth = localConn
      ? await checkDatabaseHealth(localConn)
      : { ok: false, latencyMs: 0, message: 'Local DB not registered' };

    const onlineStatus: Record<string, boolean> = {};

    for (const db of this.config.onlineDatabases.filter((d) => d.enabled)) {
      const conn = this.dbManager.get(db.id);
      if (!conn) {
        onlineStatus[db.id] = false;
        continue;
      }
      const health = await checkDatabaseHealth(conn);
      onlineStatus[db.id] = health.ok;
    }

    return { localOk: localHealth.ok, onlineStatus };
  }

  private persistState(state: CoordinatorState): void {
    const statePath = resolve(process.cwd(), this.config.coordinator.stateFilePath);
    const dir = dirname(statePath);

    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf-8');
  }

  private readState(): CoordinatorState | null {
    const statePath = resolve(process.cwd(), this.config.coordinator.stateFilePath);
    if (!existsSync(statePath)) {
      return null;
    }
    try {
      const content = readFileSync(statePath, 'utf-8');
      return JSON.parse(content) as CoordinatorState;
    } catch {
      return null;
    }
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      this.logger.info({ event: 'coordinator_shutdown', signal }, 'Coordinator shutting down');
      this.stop();
      await this.dbManager.disconnectAll();
      process.exit(0);
    };

    process.on('SIGINT', () => void shutdown('SIGINT'));
    process.on('SIGTERM', () => void shutdown('SIGTERM'));
  }
}

async function main(): Promise<void> {
  const coordinator = new SynchronizationCoordinator();
  await coordinator.start();
}

main().catch((error) => {
  console.error('Coordinator failed to start:', error);
  process.exit(1);
});
