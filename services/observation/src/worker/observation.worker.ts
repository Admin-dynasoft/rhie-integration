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
import { MedicationEncounterRepository } from '../repository/medication-encounter.repository.js';
import { LaboratoryEncounterRepository } from '../repository/laboratory-encounter.repository.js';
import { ComplaintPayloadBuilder } from '../domain/complaint-payload.builder.js';
import { ComplaintEncounterProcessor } from '../domain/complaint-encounter.processor.js';
import { DiagnosisPayloadBuilder } from '../domain/diagnosis-payload.builder.js';
import { DiagnosisEncounterProcessor } from '../domain/diagnosis-encounter.processor.js';
import { MedicationPayloadBuilder } from '../domain/medication-payload.builder.js';
import { MedicationEncounterProcessor } from '../domain/medication-encounter.processor.js';
import { LaboratoryPayloadBuilder } from '../domain/laboratory-payload.builder.js';
import { LaboratoryEncounterProcessor } from '../domain/laboratory-encounter.processor.js';

function sumBatchResults(...results: BatchResult[]): BatchResult {
  return results.reduce(
    (acc, r) => ({
      processed: acc.processed + r.processed,
      failed: acc.failed + r.failed,
      skipped: acc.skipped + r.skipped,
    }),
    { processed: 0, failed: 0, skipped: 0 },
  );
}

export class ObservationWorker extends ModeAwareWorker {
  private complaintProcessor: ComplaintEncounterProcessor | null = null;
  private diagnosisProcessor: DiagnosisEncounterProcessor | null = null;
  private medicationProcessor: MedicationEncounterProcessor | null = null;
  private laboratoryProcessor: LaboratoryEncounterProcessor | null = null;

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

    if (!this.laboratoryProcessor) {
      this.laboratoryProcessor = new LaboratoryEncounterProcessor({
        repository: new LaboratoryEncounterRepository(ctx.database),
        payloadBuilder: new LaboratoryPayloadBuilder(),
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

    if (!this.medicationProcessor) {
      this.medicationProcessor = new MedicationEncounterProcessor({
        repository: new MedicationEncounterRepository(ctx.database),
        payloadBuilder: new MedicationPayloadBuilder(),
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
      'Starting observation upload batch (complaint → lab results → diagnosis → lab requests → medication)',
    );

    if (!ctx.shouldContinue()) {
      return { processed: 0, failed: 0, skipped: 0 };
    }

    const results: BatchResult[] = [];

    results.push(
      await this.complaintProcessor.processPendingComplaintEncounters(ctx.batchSize),
    );
    if (!ctx.shouldContinue()) {
      return sumBatchResults(...results);
    }

    results.push(
      await this.laboratoryProcessor.processPendingLabResultEncounters(ctx.batchSize),
    );
    if (!ctx.shouldContinue()) {
      return sumBatchResults(...results);
    }

    results.push(
      await this.diagnosisProcessor.processPendingDiagnosisEncounters(ctx.batchSize),
    );
    if (!ctx.shouldContinue()) {
      return sumBatchResults(...results);
    }

    results.push(
      await this.laboratoryProcessor.processPendingLabRequestEncounters(ctx.batchSize),
    );
    if (!ctx.shouldContinue()) {
      return sumBatchResults(...results);
    }

    results.push(
      await this.medicationProcessor.processPendingMedicationEncounters(ctx.batchSize),
    );

    return sumBatchResults(...results);
  }
}

export const observationWorkerFactory: WorkerFactory = {
  workerType: 'observation',
  create(deps: WorkerDependencies, identity: WorkerIdentity) {
    return new ObservationWorker(deps, identity);
  },
};

export { ObservationWorker as default };
