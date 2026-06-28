import {
  StubWorker,
  type WorkerDependencies,
  type WorkerFactory,
  type WorkerIdentity,
} from '@rhie/worker-framework';

class ClientRegistryWorker extends StubWorker {
  get workerType(): string {
    return 'client-registry';
  }
}

export const clientRegistryWorkerFactory: WorkerFactory = {
  workerType: 'client-registry',
  create(deps: WorkerDependencies, identity: WorkerIdentity) {
    return new ClientRegistryWorker(deps, identity);
  },
};

export { ClientRegistryWorker };
