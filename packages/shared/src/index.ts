export {
  RhieIntegrationError,
  DatabaseError,
  ApiError,
  ConfigurationError,
  ProcessingModeError,
  wrapError,
} from './errors.js';

export {
  readCoordinatorState,
  getProcessingModeForFacility,
  shouldProcessLocally,
  shouldProcessOnline,
  isInStandby,
  invalidateCoordinatorStateCache,
} from './coordinator-state.js';

export type {
  WorkerContext,
  WorkerProcessResult,
  WorkerOptions,
  WorkerDefinition,
} from './types.js';

export { sleep } from './types.js';

export {
  ContinuousWorker,
  createWorkerContext,
  createStubProcessResult,
} from './worker.js';

export {
  ServiceLifecycle,
  bootstrapService,
} from './service-lifecycle.js';
export type { ServiceBootstrapOptions } from './service-lifecycle.js';
