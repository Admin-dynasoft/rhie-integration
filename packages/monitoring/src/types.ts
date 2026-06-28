export type ServiceStatus = 'starting' | 'running' | 'idle' | 'processing' | 'stopped' | 'error';

export interface ServiceHealthSnapshot {
  service: string;
  status: ServiceStatus;
  lastHeartbeat: string;
  startedAt: string;
  uptimeMs: number;
  recordsProcessed: number;
  recordsFailed: number;
  lastError?: string;
  facilityId?: string;
  databaseId?: string;
  workerId?: string;
  metadata?: Record<string, unknown>;
}

export interface HealthCheckResult {
  healthy: boolean;
  checks: Record<string, { ok: boolean; message?: string; latencyMs?: number }>;
}

export interface HeartbeatPayload {
  service: string;
  status: ServiceStatus;
  recordsProcessed: number;
  recordsFailed: number;
  facilityId?: string;
  databaseId?: string;
  workerId?: string;
  metadata?: Record<string, unknown>;
}
