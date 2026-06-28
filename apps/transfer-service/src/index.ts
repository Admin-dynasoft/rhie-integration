import { bootstrapService, createStubProcessResult, type WorkerDefinition } from '@rhie/shared';

const SERVICE_NAME = 'transfer-service';

const onlineWorker: WorkerDefinition = {
  name: 'transfer-encounter-online',
  databaseRole: 'online',
  async processBatch(ctx) {
    ctx.logger.debug({ event: 'poll_records' }, 'Checking for completed visits requiring transfer');
    return createStubProcessResult(ctx.database, 'encounters', 'rhie_transfer_status');
  },
};

const localWorker: WorkerDefinition = {
  name: 'transfer-encounter-local',
  databaseRole: 'local',
  async processBatch(ctx) {
    ctx.logger.debug({ event: 'poll_records' }, 'Checking local DB for transfer encounters');
    return createStubProcessResult(ctx.database, 'encounters', 'rhie_transfer_status');
  },
};

async function main(): Promise<void> {
  await bootstrapService({
    serviceName: SERVICE_NAME,
    workerDefinitions: [onlineWorker, localWorker],
    healthPortOffset: 4,
  });
}

main().catch((error) => {
  console.error(`${SERVICE_NAME} failed to start:`, error);
  process.exit(1);
});
