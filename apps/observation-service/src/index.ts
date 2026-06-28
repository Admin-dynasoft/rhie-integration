import { bootstrapService, createStubProcessResult, type WorkerDefinition } from '@rhie/shared';

const SERVICE_NAME = 'observation-service';

const onlineWorker: WorkerDefinition = {
  name: 'observation-online',
  databaseRole: 'online',
  async processBatch(ctx) {
    ctx.logger.debug({ event: 'poll_records' }, 'Checking for encounters requiring observations');
    return createStubProcessResult(ctx.database, 'observations', 'rhie_observation_status');
  },
};

const localWorker: WorkerDefinition = {
  name: 'observation-local',
  databaseRole: 'local',
  async processBatch(ctx) {
    ctx.logger.debug({ event: 'poll_records' }, 'Checking local DB for observations');
    return createStubProcessResult(ctx.database, 'observations', 'rhie_observation_status');
  },
};

async function main(): Promise<void> {
  await bootstrapService({
    serviceName: SERVICE_NAME,
    workerDefinitions: [onlineWorker, localWorker],
    healthPortOffset: 5,
  });
}

main().catch((error) => {
  console.error(`${SERVICE_NAME} failed to start:`, error);
  process.exit(1);
});
