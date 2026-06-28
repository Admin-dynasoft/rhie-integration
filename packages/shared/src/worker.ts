import type { Logger } from '@rhie/logger';
import type { HealthMonitor } from '@rhie/monitoring';
import type { DatabaseConnection } from '@rhie/database';
import { isInStandby, shouldProcessLocally, shouldProcessOnline } from './coordinator-state.js';
import { wrapError } from './errors.js';
import type { WorkerContext, WorkerDefinition, WorkerOptions, WorkerProcessResult } from './types.js';
import { sleep } from './types.js';

export interface ContinuousWorkerOptions {
  definition: WorkerDefinition;
  context: WorkerContext;
  options: WorkerOptions;
}

export class ContinuousWorker {
  private running = false;
  private readonly definition: WorkerDefinition;
  private readonly context: WorkerContext;
  private readonly options: WorkerOptions;
  private readonly logger: Logger;
  private readonly healthMonitor: HealthMonitor;

  constructor(opts: ContinuousWorkerOptions) {
    this.definition = opts.definition;
    this.context = opts.context;
    this.options = opts.options;
    this.logger = opts.context.logger;
    this.healthMonitor = opts.context.healthMonitor;
  }

  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;
    this.healthMonitor.setStatus('running');

    this.logger.info(
      {
        event: 'worker_start',
        worker: this.definition.name,
        workerId: this.context.workerId,
        databaseId: this.context.databaseId,
      },
      `Worker started: ${this.definition.name}`,
    );

    while (this.running) {
      try {
        if (!this.shouldRun()) {
          this.healthMonitor.setStatus('idle');
          await sleep(this.options.sleepIntervalMs);
          continue;
        }

        this.healthMonitor.setStatus('processing');
        const result = await this.definition.processBatch(this.context);

        if (result.processed > 0) {
          this.logger.info(
            {
              event: 'records_processed',
              worker: this.definition.name,
              processed: result.processed,
              failed: result.failed,
              skipped: result.skipped,
            },
            `Processed ${result.processed} records`,
          );
          this.healthMonitor.incrementProcessed(result.processed);
        }

        if (result.failed > 0) {
          this.healthMonitor.incrementFailed(result.failed);
        }

        if (result.processed === 0 && result.failed === 0) {
          this.healthMonitor.setStatus('idle');
          await sleep(this.options.sleepIntervalMs);
        }
      } catch (error) {
        const wrapped = wrapError(error, this.definition.name);
        this.logger.error(
          {
            event: 'worker_error',
            worker: this.definition.name,
            error: wrapped.message,
            code: wrapped.code,
          },
          'Worker iteration failed',
        );
        this.healthMonitor.setStatus('error');
        this.healthMonitor.incrementFailed(1, wrapped.message);
        await sleep(this.options.sleepIntervalMs);
        this.healthMonitor.setStatus('running');
      }
    }
  }

  stop(): void {
    this.running = false;
    this.healthMonitor.markStopped();
    this.logger.info(
      { event: 'worker_stop', worker: this.definition.name },
      `Worker stopped: ${this.definition.name}`,
    );
  }

  private shouldRun(): boolean {
    const { databaseRole } = this.definition;
    const facility = this.context.facilityId;

    if (isInStandby(facility)) {
      return false;
    }

    if (databaseRole === 'local') {
      return shouldProcessLocally(facility);
    }

    if (databaseRole === 'online' && facility) {
      return shouldProcessOnline(facility);
    }

    return databaseRole === 'online';
  }
}

export function createWorkerContext(
  params: Omit<WorkerContext, 'logger' | 'healthMonitor'> & {
    logger: Logger;
    healthMonitor: HealthMonitor;
  },
): WorkerContext {
  return { ...params };
}

export async function createStubProcessResult(
  db: DatabaseConnection,
  table: string,
  statusColumn: string,
): Promise<WorkerProcessResult> {
  // Placeholder: returns zero until business logic is implemented
  void db;
  void table;
  void statusColumn;
  return { processed: 0, failed: 0, skipped: 0 };
}
