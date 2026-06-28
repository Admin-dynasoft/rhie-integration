import { bootstrapService, createStubProcessResult, type WorkerDefinition } from '@rhie/shared';

const SERVICE_NAME = 'encounter-id-service';

const onlineWorker: WorkerDefinition = {
  name: 'encounter-id-online',
  databaseRole: 'online',
  async processBatch(ctx) {
    ctx.logger.debug({ event: 'poll_records' }, 'Checking for encounters missing RHIE IDs');
    return createStubProcessResult(ctx.database, 'encounters', 'rhie_encounter_id');
  },
};

const localWorker: WorkerDefinition = {
  name: 'encounter-id-local',
  databaseRole: 'local',
  async processBatch(ctx) {
    ctx.logger.debug({ event: 'poll_records' }, 'Checking local DB for encounters missing RHIE IDs');
    return createStubProcessResult(ctx.database, 'encounters', 'rhie_encounter_id');
  },
};

async function main(): Promise<void> {
  await bootstrapService({
    serviceName: SERVICE_NAME,
    workerDefinitions: [onlineWorker, localWorker],
    healthPortOffset: 2,
  });
}

main().catch((error) => {
  console.error(`${SERVICE_NAME} failed to start:`, error);
  process.exit(1);
});
