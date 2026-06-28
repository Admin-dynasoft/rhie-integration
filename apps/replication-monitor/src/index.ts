import {
  getConfig,
  getEnabledOnlineDatabases,
  type ReplicationMonitorConfig,
} from '@rhie/config';
import { DatabaseManager } from '@rhie/database';
import { createLogger } from '@rhie/logger';
import {
  probeReplicaStatus,
  evaluateReplicationHealth,
  buildSnapshot,
  type FacilityReplicationHealth,
  type ReplicationMonitorSnapshot,
  type ReplicaStatusRow,
} from '@rhie/replication-monitor';
import { aggregateHealth, DatabaseHealthCheck, globalHealthRegistry } from '@rhie/health';
import { GracefulShutdownManager } from '@rhie/worker-framework';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

export class ReplicationMonitorService {
  private readonly config = getConfig();
  private readonly monitorConfig: ReplicationMonitorConfig = this.config.replicationMonitor;
  private readonly logger = createLogger({ service: 'replication-monitor' }, this.config.logging);
  private readonly dbManager = new DatabaseManager(this.logger);
  private readonly shutdownManager = new GracefulShutdownManager(this.logger);
  private running = false;
  private lastSnapshot: ReplicationMonitorSnapshot = buildSnapshot([], this.monitorConfig.maxLagSeconds);
  private httpServer: ReturnType<typeof createServer> | null = null;

  async start(): Promise<void> {
    this.logger.info({ event: 'replication_monitor_start' }, 'Replication monitor starting');

    await this.dbManager.register(this.config.localDatabase);
    globalHealthRegistry.register(
      new DatabaseHealthCheck(
        this.config.localDatabase.id,
        this.dbManager.getOrThrow(this.config.localDatabase.id),
      ),
    );

    for (const db of getEnabledOnlineDatabases(this.config)) {
      try {
        await this.dbManager.register(db);
        globalHealthRegistry.register(
          new DatabaseHealthCheck(db.id, this.dbManager.getOrThrow(db.id)),
        );
      } catch (error) {
        this.logger.warn(
          {
            event: 'online_db_register_failed',
            databaseId: db.id,
            error: error instanceof Error ? error.message : String(error),
          },
          `Failed to register online database ${db.name}`,
        );
      }
    }

    await this.evaluateAll();
    this.startHttpServer();
    this.setupShutdown();

    this.running = true;

    while (this.running) {
      try {
        await this.evaluateAll();
      } catch (error) {
        this.logger.error(
          {
            event: 'replication_monitor_error',
            error: error instanceof Error ? error.message : String(error),
          },
          'Replication evaluation failed',
        );
      }

      await sleep(this.monitorConfig.pollIntervalMs);
    }
  }

  stop(): void {
    this.running = false;
  }

  getSnapshot(): ReplicationMonitorSnapshot {
    return this.lastSnapshot;
  }

  private async evaluateAll(): Promise<void> {
    const localId = this.config.localDatabase.id;
    const localConn = this.dbManager.get(localId);
    let localReachable = false;

    if (localConn) {
      try {
        localReachable = await localConn.ping();
      } catch {
        localReachable = false;
      }
    }

    const facilities: FacilityReplicationHealth[] = [];

    for (const onlineDb of getEnabledOnlineDatabases(this.config)) {
      const onlineConn = this.dbManager.get(onlineDb.id);
      let onlineReachable = false;
      let replica: ReplicaStatusRow = {
        isReplica: false,
        ioRunning: 'unknown',
        sqlRunning: 'unknown',
        lagSeconds: null,
        lastError: null,
        sourceHost: null,
        sourcePort: null,
      };
      let probeError: string | undefined;

      if (onlineConn) {
        try {
          onlineReachable = await onlineConn.ping();
          if (onlineReachable) {
            replica = await probeReplicaStatus(onlineConn);
          }
        } catch (error) {
          probeError = error instanceof Error ? error.message : String(error);
          onlineReachable = false;
        }
      }

      const evaluation = evaluateReplicationHealth(replica, {
        maxLagSeconds: this.monitorConfig.maxLagSeconds,
        treatNonReplicaAsHealthy: this.monitorConfig.treatNonReplicaAsHealthy,
      });

      const healthy = localReachable && onlineReachable && evaluation.healthy;

      facilities.push({
        facilityCode: onlineDb.facilityCode,
        onlineDatabaseId: onlineDb.id,
        onlineDatabaseName: onlineDb.name,
        localDatabaseId: localId,
        localReachable,
        onlineReachable,
        status: !onlineReachable ? 'unhealthy' : evaluation.status,
        ioRunning: replica.ioRunning,
        sqlRunning: replica.sqlRunning,
        lagSeconds: replica.lagSeconds,
        healthy,
        lastCheck: new Date().toISOString(),
        error: probeError,
      });
    }

    this.lastSnapshot = buildSnapshot(facilities, this.monitorConfig.maxLagSeconds);

    this.logger.debug(
      {
        event: 'replication_snapshot_updated',
        globalHealthy: this.lastSnapshot.globalHealthy,
        globalStatus: this.lastSnapshot.globalStatus,
        facilityCount: facilities.length,
      },
      'Replication snapshot updated',
    );
  }

  private startHttpServer(): void {
    const port = this.monitorConfig.healthPort;

    this.httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      if (req.url === '/replication/status') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(this.lastSnapshot, null, 2));
        return;
      }

      if (req.url === '/health' || req.url === '/healthz') {
        const components = await globalHealthRegistry.runAll();
        const aggregated = aggregateHealth(components);
        const httpStatus = aggregated.status === 'offline' ? 503 : 200;

        res.writeHead(httpStatus, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            service: 'replication-monitor',
            ...aggregated,
            replication: this.lastSnapshot,
          }),
        );
        return;
      }

      if (req.url === '/ready') {
        const ready = this.lastSnapshot.facilities &&
          Object.keys(this.lastSnapshot.facilities).length >= 0;
        res.writeHead(ready ? 200 : 503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ready, status: this.lastSnapshot.globalStatus }));
        return;
      }

      res.writeHead(404);
      res.end('Not Found');
    });

    this.httpServer.listen(port, () => {
      this.logger.info(
        {
          event: 'replication_monitor_http_ready',
          port,
          endpoints: ['/health', '/replication/status'],
        },
        `Replication monitor listening on :${port}`,
      );
    });
  }

  private setupShutdown(): void {
    this.shutdownManager.register(async () => {
      this.stop();
      this.httpServer?.close();
      await this.dbManager.disconnectAll();
    });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const service = new ReplicationMonitorService();
  await service.start();
}

main().catch((error) => {
  console.error('Replication monitor failed:', error);
  process.exit(1);
});
