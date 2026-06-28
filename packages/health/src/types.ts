export type HealthStatus = 'healthy' | 'degraded' | 'offline';

export type ComponentType = 'database' | 'worker' | 'rhie' | 'coordinator' | 'worker-host';

export interface ComponentHealth {
  component: ComponentType;
  id: string;
  status: HealthStatus;
  message?: string;
  latencyMs?: number;
  lastChecked: string;
  metadata?: Record<string, unknown>;
}

export interface AggregatedHealth {
  status: HealthStatus;
  timestamp: string;
  components: ComponentHealth[];
}

export interface HealthCheck {
  readonly component: ComponentType;
  readonly id: string;
  check(): Promise<ComponentHealth>;
}

export function aggregateHealth(components: ComponentHealth[]): AggregatedHealth {
  const timestamp = new Date().toISOString();

  if (components.length === 0) {
    return { status: 'offline', timestamp, components: [] };
  }

  const hasOffline = components.some((c) => c.status === 'offline');
  const hasDegraded = components.some((c) => c.status === 'degraded');

  let status: HealthStatus = 'healthy';
  if (hasOffline) {
    status = 'offline';
  } else if (hasDegraded) {
    status = 'degraded';
  }

  return { status, timestamp, components };
}

export function worstStatus(a: HealthStatus, b: HealthStatus): HealthStatus {
  const order: Record<HealthStatus, number> = { healthy: 0, degraded: 1, offline: 2 };
  return order[a] >= order[b] ? a : b;
}
