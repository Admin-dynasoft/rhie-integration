import { bootstrapService, createStubProcessResult, type WorkerDefinition } from '@rhie/shared';

const SERVICE_NAME = 'visit-service';

const onlineWorker: WorkerDefinition = {
  name: 'visit-encounter-online',
  databaseRole: 'online',
  async processBatch(ctx) {
    ctx.logger.debug({ event: 'poll_records' }, 'Checking for encounters ready for visit upload');
    return createStubProcessResult(ctx.database, 'encounters', 'rhie_visit_status');
  },
};

const localWorker: WorkerDefinition = {
  name: 'visit-encounter-local',
  databaseRole: 'local',
  async processBatch(ctx) {
    ctx.logger.debug({ event: 'poll_records' }, 'Checking local DB for visit encounters');
    return createStubProcessResult(ctx.database, 'encounters', 'rhie_visit_status');
  },
};

async function main(): Promise<void> {
  await bootstrapService({
    serviceName: SERVICE_NAME,
    workerDefinitions: [onlineWorker, localWorker],
    healthPortOffset: 3,
  });
}

main().catch((error) => {
  console.error(`${SERVICE_NAME} failed to start:`, error);
  process.exit(1);
});
