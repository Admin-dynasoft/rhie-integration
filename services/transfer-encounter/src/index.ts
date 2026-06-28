import { StubWorker, type WorkerDependencies, type WorkerFactory, type WorkerIdentity } from '@rhie/worker-framework';

class TransferEncounterWorker extends StubWorker {
  get workerType(): string {
    return 'transfer-encounter';
  }
}

export const transferEncounterWorkerFactory: WorkerFactory = {
  workerType: 'transfer-encounter',
  create(deps: WorkerDependencies, identity: WorkerIdentity) {
    return new TransferEncounterWorker(deps, identity);
  },
};

export { TransferEncounterWorker };
