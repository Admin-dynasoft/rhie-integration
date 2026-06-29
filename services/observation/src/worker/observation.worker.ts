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
import { DiagnosisEncounterRepository } from '../repository/diagnosis-encounter.repository.js';
import { ComplaintPayloadBuilder } from '../domain/complaint-payload.builder.js';
import { ComplaintEncounterProcessor } from '../domain/complaint-encounter.processor.js';
import { DiagnosisPayloadBuilder } from '../domain/diagnosis-payload.builder.js';
import { DiagnosisEncounterProcessor } from '../domain/diagnosis-encounter.processor.js';

export class ObservationWorker extends ModeAwareWorker {
  private complaintProcessor: ComplaintEncounterProcessor | null = null;
  private diagnosisProcessor: DiagnosisEncounterProcessor | null = null;

  get workerType(): string {
    return 'observation';
  }

  protected async processBatch(ctx: WorkerExecutionContext): Promise<BatchResult> {
    ctx.setCurrentTask('observation batch');

    const config = getConfig().observation;
    const rhieConfig = getConfig().rhie;

    if (!this.complaintProcessor) {
      this.complaintProcessor = new ComplaintEncounterProcessor({
        repository: new ComplaintEncounterRepository(ctx.database),
        payloadBuilder: new ComplaintPayloadBuilder(),
        logger: ctx.logger,
        config,
        rhieConfig,
        facilityId: ctx.facilityId,
        facilityCode: ctx.facilityCode,
      });
    }

    if (!this.diagnosisProcessor) {
      this.diagnosisProcessor = new DiagnosisEncounterProcessor({
        repository: new DiagnosisEncounterRepository(ctx.database),
        payloadBuilder: new DiagnosisPayloadBuilder(),
        logger: ctx.logger,
        config,
        rhieConfig,
        facilityId: ctx.facilityId,
        facilityCode: ctx.facilityCode,
      });
    }

    ctx.logger.debug(
      {
        event: 'batch_start',
        executionMode: config.executionMode,
        batchSize: ctx.batchSize,
        mode: ctx.mode,
        facilityId: ctx.facilityId,
      },
      'Starting observation upload batch (complaint + diagnosis)',
    );

    if (!ctx.shouldContinue()) {
      return { processed: 0, failed: 0, skipped: 0 };
    }

    const complaintResult = await this.complaintProcessor.processPendingComplaintEncounters(
      ctx.batchSize,
    );

    if (!ctx.shouldContinue()) {
      return complaintResult;
    }

    const diagnosisResult = await this.diagnosisProcessor.processPendingDiagnosisEncounters(
      ctx.batchSize,
    );

    return {
      processed: complaintResult.processed + diagnosisResult.processed,
      failed: complaintResult.failed + diagnosisResult.failed,
      skipped: complaintResult.skipped + diagnosisResult.skipped,
    };
  }
}

export const observationWorkerFactory: WorkerFactory = {
  workerType: 'observation',
  create(deps: WorkerDependencies, identity: WorkerIdentity) {
    return new ObservationWorker(deps, identity);
  },
};

export { ObservationWorker as default };
