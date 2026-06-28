import type { DatabaseConnection } from '@rhie/database';
import type { ComponentHealth, HealthCheck } from './types.js';

export class DatabaseHealthCheck implements HealthCheck {
  readonly component = 'database' as const;

  constructor(
    readonly id: string,
    private readonly connection: DatabaseConnection,
  ) {}

  async check(): Promise<ComponentHealth> {
    const start = Date.now();
    try {
      const ok = await this.connection.ping();
      const latencyMs = Date.now() - start;

      return {
        component: 'database',
        id: this.id,
        status: ok ? 'healthy' : 'offline',
        message: ok ? 'Database reachable' : 'Database ping failed',
        latencyMs,
        lastChecked: new Date().toISOString(),
        metadata: { databaseName: this.connection.name },
      };
    } catch (error) {
      return {
        component: 'database',
        id: this.id,
        status: 'offline',
        message: error instanceof Error ? error.message : String(error),
        latencyMs: Date.now() - start,
        lastChecked: new Date().toISOString(),
      };
    }
  }
}

export class RhieHealthCheck implements HealthCheck {
  readonly component = 'rhie' as const;

  constructor(
    readonly id: string,
    private readonly pingFn: () => Promise<boolean>,
  ) {}

  async check(): Promise<ComponentHealth> {
    const start = Date.now();
    try {
      const ok = await this.pingFn();
      return {
        component: 'rhie',
        id: this.id,
        status: ok ? 'healthy' : 'degraded',
        message: ok ? 'RHIE API reachable' : 'RHIE API unreachable',
        latencyMs: Date.now() - start,
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      return {
        component: 'rhie',
        id: this.id,
        status: 'offline',
        message: error instanceof Error ? error.message : String(error),
        latencyMs: Date.now() - start,
        lastChecked: new Date().toISOString(),
      };
    }
  }
}

export class HealthRegistry {
  private readonly checks = new Map<string, HealthCheck>();

  register(check: HealthCheck): void {
    this.checks.set(`${check.component}:${check.id}`, check);
  }

  unregister(component: string, id: string): void {
    this.checks.delete(`${component}:${id}`);
  }

  async runAll(): Promise<ComponentHealth[]> {
    const results: ComponentHealth[] = [];
    for (const check of this.checks.values()) {
      results.push(await check.check());
    }
    return results;
  }

  async runCheck(component: string, id: string): Promise<ComponentHealth | null> {
    const check = this.checks.get(`${component}:${id}`);
    if (!check) {
      return null;
    }
    return check.check();
  }

  getRegisteredIds(): string[] {
    return Array.from(this.checks.keys());
  }
}

export const globalHealthRegistry = new HealthRegistry();
