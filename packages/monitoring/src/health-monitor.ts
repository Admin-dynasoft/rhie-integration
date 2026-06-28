import type { Logger } from '@rhie/logger';
import type { ServiceHealthSnapshot, ServiceStatus, HeartbeatPayload } from './types.js';

export class HealthMonitor {
  private readonly service: string;
  private readonly logger: Logger;
  private readonly startedAt: Date;
  private status: ServiceStatus = 'starting';
  private lastHeartbeat: Date;
  private recordsProcessed = 0;
  private recordsFailed = 0;
  private lastError?: string;
  private facilityId?: string;
  private databaseId?: string;
  private workerId?: string;
  private metadata: Record<string, unknown> = {};
  private heartbeatTimer?: ReturnType<typeof setInterval>;

  constructor(
    service: string,
    logger: Logger,
    options?: {
      facilityId?: string;
      databaseId?: string;
      workerId?: string;
      heartbeatIntervalMs?: number;
    },
  ) {
    this.service = service;
    this.logger = logger;
    this.startedAt = new Date();
    this.lastHeartbeat = new Date();
    this.facilityId = options?.facilityId;
    this.databaseId = options?.databaseId;
    this.workerId = options?.workerId;

    if (options?.heartbeatIntervalMs) {
      this.startHeartbeat(options.heartbeatIntervalMs);
    }
  }

  startHeartbeat(intervalMs: number): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.emitHeartbeat();
    }, intervalMs);
  }

  stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  setStatus(status: ServiceStatus): void {
    this.status = status;
    this.touch();
  }

  incrementProcessed(count = 1): void {
    this.recordsProcessed += count;
    this.touch();
  }

  incrementFailed(count = 1, error?: string): void {
    this.recordsFailed += count;
    if (error) {
      this.lastError = error;
    }
    this.touch();
  }

  setMetadata(key: string, value: unknown): void {
    this.metadata[key] = value;
  }

  getSnapshot(): ServiceHealthSnapshot {
    return {
      service: this.service,
      status: this.status,
      lastHeartbeat: this.lastHeartbeat.toISOString(),
      startedAt: this.startedAt.toISOString(),
      uptimeMs: Date.now() - this.startedAt.getTime(),
      recordsProcessed: this.recordsProcessed,
      recordsFailed: this.recordsFailed,
      lastError: this.lastError,
      facilityId: this.facilityId,
      databaseId: this.databaseId,
      workerId: this.workerId,
      metadata: { ...this.metadata },
    };
  }

  emitHeartbeat(): HeartbeatPayload {
    this.touch();
    const payload: HeartbeatPayload = {
      service: this.service,
      status: this.status,
      recordsProcessed: this.recordsProcessed,
      recordsFailed: this.recordsFailed,
      facilityId: this.facilityId,
      databaseId: this.databaseId,
      workerId: this.workerId,
      metadata: { ...this.metadata },
    };

    this.logger.debug({ event: 'heartbeat', ...payload }, 'Service heartbeat');
    return payload;
  }

  markStopped(): void {
    this.status = 'stopped';
    this.stopHeartbeat();
    this.touch();
    this.logger.info({ event: 'service_stop' }, 'Service stopped');
  }

  private touch(): void {
    this.lastHeartbeat = new Date();
  }
}

const registry = new Map<string, HealthMonitor>();

function buildRegistryKey(service: string, facilityId?: string, workerId?: string): string {
  return [service, facilityId, workerId].filter(Boolean).join(':');
}

export function registerHealthMonitor(monitor: HealthMonitor, key: string): void {
  registry.set(key, monitor);
}

export function getHealthMonitor(key: string): HealthMonitor | undefined {
  return registry.get(key);
}

export function getAllHealthSnapshots(): ServiceHealthSnapshot[] {
  return Array.from(registry.values()).map((m) => m.getSnapshot());
}

export function createHealthMonitor(
  service: string,
  logger: Logger,
  options?: {
    facilityId?: string;
    databaseId?: string;
    workerId?: string;
    heartbeatIntervalMs?: number;
  },
): HealthMonitor {
  const monitor = new HealthMonitor(service, logger, options);
  const key = buildRegistryKey(service, options?.facilityId, options?.workerId);
  registerHealthMonitor(monitor, key);
  return monitor;
}
