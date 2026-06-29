export { RhieClient, createRhieClient } from './client.js';
export type { RhieClientOptions, RhieApiResponse, RhieRequestOptions } from './client.js';

export { uploadClientRegistryOnce } from './client-registry-upload.js';
export { uploadVisitEncounterOnce } from './visit-encounter-upload.js';
export { uploadShrResourceOnce } from './shr-resource-upload.js';
export type { ShrResourceUploadResult } from './shr-resource-upload.js';
export type { VisitEncounterUploadResult } from './visit-encounter-upload.js';

export { RhieAuthProvider, isAxiosError, formatApiError } from './auth.js';
export type { AxiosRequestConfig, AxiosError } from './auth.js';
