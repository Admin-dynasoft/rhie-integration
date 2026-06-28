import type { Logger } from '@rhie/logger';
import type { DatabaseConnection } from '@rhie/database';
import type { RhieClient } from '@rhie/rhie-client';
import type { RetryConfig, WorkerConfig } from '@rhie/config';

export type WorkerMode = 'online' | 'local';

export type WorkerRuntimeStatus =
  | 'starting'
  | 'running'
  | 'idle'
  | 'processing'
  | 'stopping'
  | 'stopped'
  | 'error'
  | 'restarting';

export interface BatchResult {
  processed: number;
  failed: number;
  skipped: number;
}

export interface WorkerIdentity {
  workerType: string;
  workerId: string;
  mode: WorkerMode;
  databaseId: string;
  facilityId?: string;
  facilityCode?: string;
}

export interface WorkerDependencies {
  logger: Logger;
  database: DatabaseConnection;
  rhieClient: RhieClient;
  workerConfig: WorkerConfig;
  retryConfig: RetryConfig;
}

export interface WorkerExecutionContext extends WorkerDependencies, WorkerIdentity {
  correlationId: string;
  batchSize: number;
  setCurrentTask: (task: string | undefined) => void;
  shouldContinue: () => boolean;
}

export interface WorkerFactory {
  readonly workerType: string;
  create(deps: WorkerDependencies, identity: WorkerIdentity): AbstractWorker;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export abstract class AbstractWorker {
  readonly identity: WorkerIdentity;
  protected readonly deps: WorkerDependencies;
  protected status: WorkerRuntimeStatus = 'starting';
  protected currentTask?: string;
  protected recordsProcessed = 0;
  protected recordsFailed = 0;
  protected retryCount = 0;
  protected lastError?: string;
  protected readonly startedAt: Date;
  protected lastHeartbeat: Date;
  private running = false;
  private stopping = false;
  private inFlight = false;
  private loopPromise: Promise<void> | null = null;
  private heartbeatTimer?: ReturnType<typeof setInterval>;

  constructor(deps: WorkerDependencies, identity: WorkerIdentity) {
    this.deps = deps;
    this.identity = identity;
    this.startedAt = new Date();
    this.lastHeartbeat = new Date();
  }

  abstract get workerType(): string;

  protected abstract processBatch(ctx: WorkerExecutionContext): Promise<BatchResult>;

  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;
    this.stopping = false;
    this.status = 'running';

    this.deps.logger.info(
      {
        event: 'worker_start',
        workerType: this.workerType,
        workerId: this.identity.workerId,
        mode: this.identity.mode,
        databaseId: this.identity.databaseId,
        facilityId: this.identity.facilityId,
      },
      `Worker started: ${this.identity.workerId}`,
    );

    this.startHeartbeat();
    this.loopPromise = this.runLoop();
  }

  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    this.stopping = true;
    this.status = 'stopping';
    this.deps.logger.info(
      { event: 'worker_stop_requested', workerId: this.identity.workerId },
      'Worker stop requested — waiting for in-flight batch',
    );

    this.running = false;
    this.stopHeartbeat();

    if (this.loopPromise) {
      await this.loopPromise;
    }

    this.status = 'stopped';
    this.deps.logger.info(
      { event: 'worker_stopped', workerId: this.identity.workerId },
      `Worker stopped: ${this.identity.workerId}`,
    );
  }

  async restart(): Promise<void> {
    this.status = 'restarting';
    this.deps.logger.info(
      { event: 'worker_restart', workerId: this.identity.workerId },
      'Restarting worker',
    );
    await this.stop();
    this.recordsProcessed = 0;
    this.recordsFailed = 0;
    this.retryCount = 0;
    this.lastError = undefined;
    await this.start();
  }

  getMetricsSnapshot(): import('@rhie/metrics').WorkerMetricsSnapshot {
    const healthStatus =
      this.status === 'error' ? 'offline' : this.status === 'stopping' ? 'degraded' : 'healthy';

    return {
      workerId: this.identity.workerId,
      workerType: this.workerType,
      mode: this.identity.mode,
      facilityId: this.identity.facilityId,
      databaseId: this.identity.databaseId,
      status: this.status,
      currentTask: this.currentTask,
      lastHeartbeat: this.lastHeartbeat.toISOString(),
      startedAt: this.startedAt.toISOString(),
      uptimeMs: Date.now() - this.startedAt.getTime(),
      recordsProcessed: this.recordsProcessed,
      recordsFailed: this.recordsFailed,
      retryCount: this.retryCount,
      lastError: this.lastError,
      healthStatus,
    };
  }

  isRunning(): boolean {
    return this.running;
  }

  private async runLoop(): Promise<void> {
    const { sleepIntervalMs, batchSize } = this.deps.workerConfig;

    while (this.running) {
      try {
        if (!this.shouldRun()) {
          this.status = 'idle';
          this.currentTask = 'standby — waiting for execution mode';
          this.touchHeartbeat();
          await sleep(sleepIntervalMs);
          continue;
        }

        this.status = 'processing';
        this.inFlight = true;
        this.currentTask = 'processing batch';

        const ctx = this.buildContext(batchSize);
        const result = await this.processBatch(ctx);

        this.recordsProcessed += result.processed;
        this.recordsFailed += result.failed;

        if (result.processed > 0) {
          this.deps.logger.info(
            {
              event: 'batch_complete',
              workerId: this.identity.workerId,
              processed: result.processed,
              failed: result.failed,
              skipped: result.skipped,
            },
            `Batch complete: ${result.processed} processed`,
          );
        }

        this.inFlight = false;
        this.currentTask = undefined;

        if (result.processed === 0 && result.failed === 0) {
          this.status = 'idle';
          await sleep(sleepIntervalMs);
        }

        this.touchHeartbeat();
      } catch (error) {
        this.inFlight = false;
        this.status = 'error';
        this.lastError = error instanceof Error ? error.message : String(error);

        this.deps.logger.error(
          {
            event: 'worker_error',
            workerId: this.identity.workerId,
            error: this.lastError,
          },
          'Worker iteration failed',
        );

        this.recordsFailed += 1;
        this.touchHeartbeat();
        await sleep(sleepIntervalMs);

        if (this.running) {
          this.status = 'running';
        }
      }
    }

    if (this.inFlight) {
      await sleep(100);
    }
  }

  protected shouldRun(): boolean {
    return !this.stopping;
  }

  protected buildContext(batchSize: number): WorkerExecutionContext {
    return {
      ...this.deps,
      ...this.identity,
      batchSize,
      correlationId: generateCorrelationId(),
      setCurrentTask: (task) => {
        this.currentTask = task;
      },
      shouldContinue: () => this.running && !this.stopping,
    };
  }

  private startHeartbeat(): void {
    const interval = this.deps.workerConfig.heartbeatIntervalMs;
    this.heartbeatTimer = setInterval(() => this.touchHeartbeat(), interval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  private touchHeartbeat(): void {
    this.lastHeartbeat = new Date();
  }
}

export function generateCorrelationId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}
