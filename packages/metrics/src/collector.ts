import type { HealthStatus } from '@rhie/health';

export type WorkerRuntimeStatus =
  | 'starting'
  | 'running'
  | 'idle'
  | 'processing'
  | 'stopping'
  | 'stopped'
  | 'error'
  | 'restarting';

export interface WorkerMetricsSnapshot {
  workerId: string;
  workerType: string;
  mode: 'online' | 'local';
  facilityId?: string;
  databaseId: string;
  status: WorkerRuntimeStatus;
  currentTask?: string;
  lastHeartbeat: string;
  startedAt: string;
  uptimeMs: number;
  recordsProcessed: number;
  recordsFailed: number;
  retryCount: number;
  lastError?: string;
  healthStatus: HealthStatus;
}

export class WorkerMetricsCollector {
  private readonly snapshots = new Map<string, WorkerMetricsSnapshot>();

  register(snapshot: WorkerMetricsSnapshot): void {
    this.snapshots.set(snapshot.workerId, snapshot);
  }

  update(workerId: string, partial: Partial<WorkerMetricsSnapshot>): void {
    const existing = this.snapshots.get(workerId);
    if (existing) {
      this.snapshots.set(workerId, { ...existing, ...partial });
    }
  }

  get(workerId: string): WorkerMetricsSnapshot | undefined {
    return this.snapshots.get(workerId);
  }

  getAll(): WorkerMetricsSnapshot[] {
    return Array.from(this.snapshots.values());
  }

  remove(workerId: string): void {
    this.snapshots.delete(workerId);
  }

  toJSON(): Record<string, WorkerMetricsSnapshot> {
    const result: Record<string, WorkerMetricsSnapshot> = {};
    for (const [id, snapshot] of this.snapshots) {
      result[id] = snapshot;
    }
    return result;
  }
}

export const globalMetricsCollector = new WorkerMetricsCollector();

export class MetricsStore {
  private readonly counters = new Map<string, number>();

  increment(key: string, amount = 1): void {
    this.counters.set(key, (this.counters.get(key) ?? 0) + amount);
  }

  get(key: string): number {
    return this.counters.get(key) ?? 0;
  }

  getAll(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [key, value] of this.counters) {
      result[key] = value;
    }
    return result;
  }

  reset(key?: string): void {
    if (key) {
      this.counters.delete(key);
    } else {
      this.counters.clear();
    }
  }
}

export const globalMetricsStore = new MetricsStore();
