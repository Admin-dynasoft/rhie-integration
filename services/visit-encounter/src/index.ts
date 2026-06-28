import { StubWorker, type WorkerDependencies, type WorkerFactory, type WorkerIdentity } from '@rhie/worker-framework';

class VisitEncounterWorker extends StubWorker {
  get workerType(): string {
    return 'visit-encounter';
  }
}

export const visitEncounterWorkerFactory: WorkerFactory = {
  workerType: 'visit-encounter',
  create(deps: WorkerDependencies, identity: WorkerIdentity) {
    return new VisitEncounterWorker(deps, identity);
  },
};

export { VisitEncounterWorker };
