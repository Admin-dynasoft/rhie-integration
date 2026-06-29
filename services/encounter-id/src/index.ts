export { EncounterIdWorker, encounterIdWorkerFactory } from './worker/encounter-id.worker.js';
export {
  EncounterProcessor,
  type EncounterIdService,
  type EncounterIdServiceDeps,
} from './domain/encounter.processor.js';
export { EncounterPayloadBuilder } from './domain/encounter-payload.builder.js';
export { EncounterRepository } from './repository/encounter.repository.js';
