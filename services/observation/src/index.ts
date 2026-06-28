import { StubWorker, type WorkerDependencies, type WorkerFactory, type WorkerIdentity } from '@rhie/worker-framework';

class ObservationWorker extends StubWorker {
  get workerType(): string {
    return 'observation';
  }
}

export const observationWorkerFactory: WorkerFactory = {
  workerType: 'observation',
  create(deps: WorkerDependencies, identity: WorkerIdentity) {
    return new ObservationWorker(deps, identity);
  },
};

export { ObservationWorker };
