import type { WorkerFactory } from '@rhie/worker-framework';
import { clientRegistryWorkerFactory } from '@rhie/service-client-registry';
import { encounterIdWorkerFactory } from '@rhie/service-encounter-id';
import { visitEncounterWorkerFactory } from '@rhie/service-visit-encounter';
import { transferEncounterWorkerFactory } from '@rhie/service-transfer-encounter';
import { observationWorkerFactory } from '@rhie/service-observation';

export const ALL_WORKER_FACTORIES: WorkerFactory[] = [
  clientRegistryWorkerFactory,
  encounterIdWorkerFactory,
  visitEncounterWorkerFactory,
  transferEncounterWorkerFactory,
  observationWorkerFactory,
];

const factoryMap = new Map<string, WorkerFactory>(
  ALL_WORKER_FACTORIES.map((f) => [f.workerType, f]),
);

export function getWorkerFactories(types?: string[]): WorkerFactory[] {
  if (!types || types.length === 0) {
    return ALL_WORKER_FACTORIES;
  }
  return types
    .map((t) => factoryMap.get(t))
    .filter((f): f is WorkerFactory => f !== undefined);
}

export function getAvailableWorkerTypes(): string[] {
  return ALL_WORKER_FACTORIES.map((f) => f.workerType);
}
