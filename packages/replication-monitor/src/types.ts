export type ReplicationThreadStatus = 'yes' | 'no' | 'unknown';

export type ReplicationHealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown' | 'not_replica';

export interface ReplicaStatusRow {
  ioRunning: ReplicationThreadStatus;
  sqlRunning: ReplicationThreadStatus;
  lagSeconds: number | null;
  lastError: string | null;
  sourceHost: string | null;
  sourcePort: number | null;
  isReplica: boolean;
}

export interface FacilityReplicationHealth {
  facilityCode: string;
  onlineDatabaseId: string;
  onlineDatabaseName: string;
  localDatabaseId: string;
  localReachable: boolean;
  onlineReachable: boolean;
  status: ReplicationHealthStatus;
  ioRunning: ReplicationThreadStatus;
  sqlRunning: ReplicationThreadStatus;
  lagSeconds: number | null;
  healthy: boolean;
  lastCheck: string;
  error?: string;
}

export interface ReplicationMonitorSnapshot {
  updatedAt: string;
  globalHealthy: boolean;
  globalStatus: ReplicationHealthStatus;
  maxLagSeconds: number;
  facilities: Record<string, FacilityReplicationHealth>;
}

export function evaluateReplicationHealth(
  replica: ReplicaStatusRow,
  options: { maxLagSeconds: number; treatNonReplicaAsHealthy: boolean },
): { status: ReplicationHealthStatus; healthy: boolean } {
  if (!replica.isReplica) {
    if (options.treatNonReplicaAsHealthy) {
      return { status: 'not_replica', healthy: true };
    }
    return { status: 'unknown', healthy: false };
  }

  if (replica.ioRunning === 'no' || replica.sqlRunning === 'no') {
    return { status: 'unhealthy', healthy: false };
  }

  if (replica.lagSeconds != null && replica.lagSeconds > options.maxLagSeconds) {
    return { status: 'degraded', healthy: false };
  }

  if (replica.lastError) {
    return { status: 'degraded', healthy: false };
  }

  return { status: 'healthy', healthy: true };
}

export function buildSnapshot(
  facilities: FacilityReplicationHealth[],
  maxLagSeconds: number,
): ReplicationMonitorSnapshot {
  const facilityMap = Object.fromEntries(facilities.map((f) => [f.facilityCode, f]));
  const allHealthy = facilities.every((f) => f.healthy);
  const worstStatus = facilities.reduce<ReplicationHealthStatus>((worst, f) => {
    const order: ReplicationHealthStatus[] = [
      'healthy',
      'not_replica',
      'unknown',
      'degraded',
      'unhealthy',
    ];
    return order.indexOf(f.status) > order.indexOf(worst) ? f.status : worst;
  }, 'healthy');

  return {
    updatedAt: new Date().toISOString(),
    globalHealthy: allHealthy,
    globalStatus: allHealthy ? 'healthy' : worstStatus,
    maxLagSeconds,
    facilities: facilityMap,
  };
}
