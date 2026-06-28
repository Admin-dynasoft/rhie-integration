import { bootstrapService, createStubProcessResult, type WorkerDefinition } from '@rhie/shared';

const SERVICE_NAME = 'client-service';

const onlineWorker: WorkerDefinition = {
  name: 'client-registry-online',
  databaseRole: 'online',
  async processBatch(ctx) {
    ctx.logger.debug({ event: 'poll_records' }, 'Checking for clients awaiting upload');
    return createStubProcessResult(ctx.database, 'clients', 'rhie_status');
  },
};

const localWorker: WorkerDefinition = {
  name: 'client-registry-local',
  databaseRole: 'local',
  async processBatch(ctx) {
    ctx.logger.debug({ event: 'poll_records' }, 'Checking local DB for clients awaiting upload');
    return createStubProcessResult(ctx.database, 'clients', 'rhie_status');
  },
};

async function main(): Promise<void> {
  await bootstrapService({
    serviceName: SERVICE_NAME,
    workerDefinitions: [onlineWorker, localWorker],
    healthPortOffset: 1,
  });
}

main().catch((error) => {
  console.error(`${SERVICE_NAME} failed to start:`, error);
  process.exit(1);
});
