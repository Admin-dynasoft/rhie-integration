import { StubWorker, type WorkerDependencies, type WorkerFactory, type WorkerIdentity } from '@rhie/worker-framework';

class EncounterIdWorker extends StubWorker {
  get workerType(): string {
    return 'encounter-id';
  }
}

export const encounterIdWorkerFactory: WorkerFactory = {
  workerType: 'encounter-id',
  create(deps: WorkerDependencies, identity: WorkerIdentity) {
    return new EncounterIdWorker(deps, identity);
  },
};

export { EncounterIdWorker };
