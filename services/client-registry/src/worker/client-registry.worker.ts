import { getConfig } from '@rhie/config';
import {
  ModeAwareWorker,
  type WorkerDependencies,
  type WorkerExecutionContext,
  type BatchResult,
  type WorkerFactory,
  type WorkerIdentity,
} from '@rhie/worker-framework';
import { ClientRegistryRepository } from '../repository/client-registry.repository.js';
import { PatientPayloadBuilder } from '../domain/patient-payload.builder.js';
import { ClientRegistryProcessor } from '../domain/client-registry.processor.js';

export class ClientRegistryWorker extends ModeAwareWorker {
  private processor: ClientRegistryProcessor | null = null;

  get workerType(): string {
    return 'client-registry';
  }

  protected async processBatch(ctx: WorkerExecutionContext): Promise<BatchResult> {
    ctx.setCurrentTask('client-registry batch');

    if (!this.processor) {
      const config = getConfig().clientRegistry;
      const repository = new ClientRegistryRepository(ctx.database, config);
      const payloadBuilder = new PatientPayloadBuilder();

      this.processor = new ClientRegistryProcessor({
        repository,
        payloadBuilder,
        logger: ctx.logger,
        config,
        rhieConfig: getConfig().rhie,
      });
    }

    const batchSize = Math.min(ctx.batchSize, getConfig().clientRegistry.maxClientsPerBatch);

    ctx.logger.debug(
      {
        event: 'batch_start',
        executionMode: getConfig().clientRegistry.executionMode,
        batchSize,
        mode: ctx.mode,
        facilityId: ctx.facilityId,
      },
      'Starting client registry batch',
    );

    if (!ctx.shouldContinue()) {
      return { processed: 0, failed: 0, skipped: 0 };
    }

    return this.processor.processPendingClients(batchSize);
  }
}

export const clientRegistryWorkerFactory: WorkerFactory = {
  workerType: 'client-registry',
  create(deps: WorkerDependencies, identity: WorkerIdentity) {
    return new ClientRegistryWorker(deps, identity);
  },
};

export { ClientRegistryWorker as default };
