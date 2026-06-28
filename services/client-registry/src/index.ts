export { clientRegistryWorkerFactory, ClientRegistryWorker } from './worker/client-registry.worker.js';
export { ClientRegistryProcessor } from './domain/client-registry.processor.js';
export { PatientPayloadBuilder, buildPatientPayload, serializePatientPayload } from './domain/patient-payload.builder.js';
export { ClientRegistryRepository } from './repository/client-registry.repository.js';
export type { PatientDataRow, FhirPatientPayload, UpidStatus } from './domain/types.js';
