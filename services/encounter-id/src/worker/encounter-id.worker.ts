import { getConfig } from '@rhie/config';
import {
  ModeAwareWorker,
  type WorkerDependencies,
  type WorkerExecutionContext,
  type BatchResult,
  type WorkerFactory,
  type WorkerIdentity,
} from '@rhie/worker-framework';
import { EncounterRepository } from '../repository/encounter.repository.js';
import { EncounterPayloadBuilder } from '../domain/encounter-payload.builder.js';
import { EncounterProcessor } from '../domain/encounter.processor.js';

export class EncounterIdWorker extends ModeAwareWorker {
  private processor: EncounterProcessor | null = null;

  get workerType(): string {
    return 'encounter-id';
  }

  protected async processBatch(ctx: WorkerExecutionContext): Promise<BatchResult> {
    ctx.setCurrentTask('encounter-id batch');

    if (!this.processor) {
      const config = getConfig().encounterId;
      const repository = new EncounterRepository(ctx.database);
      const payloadBuilder = new EncounterPayloadBuilder();

      this.processor = new EncounterProcessor({
        repository,
        payloadBuilder,
        logger: ctx.logger,
        config,
        facilityId: ctx.facilityId,
        facilityCode: ctx.facilityCode,
      });
    }

    ctx.logger.debug(
      {
        event: 'batch_start',
        executionMode: getConfig().encounterId.executionMode,
        generateFromDate: getConfig().encounterId.generateFromDate,
        transferGenerateFromDate: getConfig().encounterId.transferGenerateFromDate,
        mode: ctx.mode,
        facilityId: ctx.facilityId,
      },
      'Starting encounter ID batch',
    );

    if (!ctx.shouldContinue()) {
      return { processed: 0, failed: 0, skipped: 0 };
    }

    return this.processor.processAllGenerators();
  }
}

export const encounterIdWorkerFactory: WorkerFactory = {
  workerType: 'encounter-id',
  create(deps: WorkerDependencies, identity: WorkerIdentity) {
    return new EncounterIdWorker(deps, identity);
  },
};

export { EncounterIdWorker as default };
