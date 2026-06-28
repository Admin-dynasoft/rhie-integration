import { loadConfig } from '@rhie/config';
import { bootstrapWorkerHost, type WorkerMode } from '@rhie/worker-framework';
import { getWorkerFactories } from '@rhie/services-registry';

function parseModes(): WorkerMode[] {
  const envModes = process.env.WORKER_MODES;
  if (envModes) {
    return envModes.split(',').map((m) => m.trim() as WorkerMode);
  }
  return ['online', 'local'];
}

function parseWorkerTypes(): string[] | undefined {
  const envTypes = process.env.WORKER_TYPES;
  if (envTypes) {
    return envTypes.split(',').map((t) => t.trim());
  }
  return undefined;
}

async function main(): Promise<void> {
  const config = loadConfig();
  const serviceName = process.env.SERVICE_NAME ?? 'worker-host';
  const workerTypes = parseWorkerTypes();
  const factories = getWorkerFactories(workerTypes);

  if (factories.length === 0) {
    console.error('No worker factories found. Set WORKER_TYPES or check service registry.');
    process.exit(1);
  }

  const healthPort = process.env.HEALTH_PORT
    ? parseInt(process.env.HEALTH_PORT, 10)
    : config.monitoring.healthPort;

  await bootstrapWorkerHost({
    serviceName,
    workerFactories: factories,
    modes: parseModes(),
    healthPort,
    metricsPort: healthPort + 100,
    platformConfig: config,
  });
}

main().catch((error) => {
  console.error('Worker host failed to start:', error);
  process.exit(1);
});
