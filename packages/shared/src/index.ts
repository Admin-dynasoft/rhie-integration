// Re-exports from @rhie/worker-framework for backward compatibility with Phase 1 apps.
export {
  AbstractWorker,
  ModeAwareWorker,
  StubWorker,
  WorkerHost,
  bootstrapWorkerHost,
  MultiDatabaseManager,
  ExecutionModeGate,
  GracefulShutdownManager,
  stopAllWorkers,
  readCoordinatorState,
  invalidateCoordinatorStateCache,
  getProcessingModeForFacility,
  shouldWorkerRun,
  isStandby,
  generateCorrelationId,
  sleep,
} from '@rhie/worker-framework';

export type {
  WorkerMode,
  WorkerRuntimeStatus,
  BatchResult,
  WorkerIdentity,
  WorkerDependencies,
  WorkerExecutionContext,
  WorkerFactory,
  WorkerHostOptions,
  DatabaseTarget,
} from '@rhie/worker-framework';

export {
  RhieIntegrationError,
  DatabaseError,
  ApiError,
  ConfigurationError,
  ProcessingModeError,
  wrapError,
} from './errors.js';

import {
  shouldWorkerRun as shouldWorkerRunFn,
  isStandby,
} from '@rhie/worker-framework';

export function shouldProcessOnline(facilityId: string): boolean {
  return shouldWorkerRunFn('online', facilityId);
}

export function shouldProcessLocally(facilityId?: string): boolean {
  return shouldWorkerRunFn('local', facilityId);
}

export { isStandby as isInStandby };

export {
  ContinuousWorker,
  createWorkerContext,
  createStubProcessResult,
  ServiceLifecycle,
  bootstrapService,
} from './legacy.js';

export { rhieSanitizeUpid, rhieUpidIsExcluded, rhieUpidSqlExclude } from './upid/index.js';

export type {
  WorkerContext,
  WorkerProcessResult,
  WorkerOptions,
  WorkerDefinition,
  ServiceBootstrapOptions,
} from './legacy.js';
