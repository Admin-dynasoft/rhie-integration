import {
  AbstractWorker,
  type BatchResult,
  type WorkerDependencies,
  type WorkerExecutionContext,
  type WorkerIdentity,
} from './abstract-worker.js';
import { ExecutionModeGate } from './execution-mode.js';

export abstract class ModeAwareWorker extends AbstractWorker {
  private readonly modeGate: ExecutionModeGate;

  constructor(deps: WorkerDependencies, identity: WorkerIdentity) {
    super(deps, identity);
    this.modeGate = new ExecutionModeGate(identity.mode, identity.facilityId);
  }

  protected override shouldRun(): boolean {
    if (!super.shouldRun()) {
      return false;
    }
    return this.modeGate.shouldRun();
  }

  protected getStandbyReason(): string {
    return this.modeGate.getReason();
  }
}

export abstract class StubWorker extends ModeAwareWorker {
  protected async processBatch(ctx: WorkerExecutionContext): Promise<BatchResult> {
    ctx.setCurrentTask('polling for work');
    ctx.logger.debug(
      {
        event: 'poll_records',
        workerType: this.workerType,
        mode: ctx.mode,
        facilityId: ctx.facilityId,
      },
      'Polling for pending records (stub — no business logic)',
    );

    if (!ctx.shouldContinue()) {
      return { processed: 0, failed: 0, skipped: 0 };
    }

    return { processed: 0, failed: 0, skipped: 0 };
  }
}
