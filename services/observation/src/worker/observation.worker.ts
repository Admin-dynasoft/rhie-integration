import { getConfig } from '@rhie/config';
import {
  ModeAwareWorker,
  type WorkerDependencies,
  type WorkerExecutionContext,
  type BatchResult,
  type WorkerFactory,
  type WorkerIdentity,
} from '@rhie/worker-framework';
import { ComplaintEncounterRepository } from '../repository/complaint-encounter.repository.js';
import { ComplaintPayloadBuilder } from '../domain/complaint-payload.builder.js';
import { ComplaintEncounterProcessor } from '../domain/complaint-encounter.processor.js';

export class ObservationWorker extends ModeAwareWorker {
  private processor: ComplaintEncounterProcessor | null = null;

  get workerType(): string {
    return 'observation';
  }

  protected async processBatch(ctx: WorkerExecutionContext): Promise<BatchResult> {
    ctx.setCurrentTask('complaint-encounter batch');

    if (!this.processor) {
      const config = getConfig().observation;
      const repository = new ComplaintEncounterRepository(ctx.database);
      const payloadBuilder = new ComplaintPayloadBuilder();

      this.processor = new ComplaintEncounterProcessor({
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
        executionMode: getConfig().observation.executionMode,
        batchSize: ctx.batchSize,
        mode: ctx.mode,
        facilityId: ctx.facilityId,
      },
      'Starting complaint encounter upload batch',
    );

    if (!ctx.shouldContinue()) {
      return { processed: 0, failed: 0, skipped: 0 };
    }

    return this.processor.processPendingComplaintEncounters(ctx.batchSize);
  }
}

export const observationWorkerFactory: WorkerFactory = {
  workerType: 'observation',
  create(deps: WorkerDependencies, identity: WorkerIdentity) {
    return new ObservationWorker(deps, identity);
  },
};

export { ObservationWorker as default };
