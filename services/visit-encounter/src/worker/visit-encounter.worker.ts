import { getConfig } from '@rhie/config';
import {
  ModeAwareWorker,
  type WorkerDependencies,
  type WorkerExecutionContext,
  type BatchResult,
  type WorkerFactory,
  type WorkerIdentity,
} from '@rhie/worker-framework';
import { VisitEncounterRepository } from '../repository/visit-encounter.repository.js';
import { VisitPayloadBuilder } from '../domain/visit-payload.builder.js';
import { VisitEncounterProcessor } from '../domain/visit-encounter.processor.js';

export class VisitEncounterWorker extends ModeAwareWorker {
  private processor: VisitEncounterProcessor | null = null;

  get workerType(): string {
    return 'visit-encounter';
  }

  protected async processBatch(ctx: WorkerExecutionContext): Promise<BatchResult> {
    ctx.setCurrentTask('visit-encounter batch');

    if (!this.processor) {
      const config = getConfig().visitEncounter;
      const repository = new VisitEncounterRepository(ctx.database);
      const payloadBuilder = new VisitPayloadBuilder();

      this.processor = new VisitEncounterProcessor({
        repository,
        payloadBuilder,
        logger: ctx.logger,
        config,
        rhieConfig: getConfig().rhie,
        facilityId: ctx.facilityId,
        facilityCode: ctx.facilityCode,
      });
    }

    ctx.logger.debug(
      {
        event: 'batch_start',
        executionMode: getConfig().visitEncounter.executionMode,
        batchSize: ctx.batchSize,
        mode: ctx.mode,
        facilityId: ctx.facilityId,
      },
      'Starting visit encounter upload batch',
    );

    if (!ctx.shouldContinue()) {
      return { processed: 0, failed: 0, skipped: 0 };
    }

    return this.processor.processPendingVisitEncounters(ctx.batchSize);
  }
}

export const visitEncounterWorkerFactory: WorkerFactory = {
  workerType: 'visit-encounter',
  create(deps: WorkerDependencies, identity: WorkerIdentity) {
    return new VisitEncounterWorker(deps, identity);
  },
};

export { VisitEncounterWorker as default };
