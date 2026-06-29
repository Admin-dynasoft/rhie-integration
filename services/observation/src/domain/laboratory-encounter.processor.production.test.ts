import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import type { Logger } from '@rhie/logger';
import type { RhieConfig, ObservationConfig } from '@rhie/config';
import type { ShrResourceUploadResult } from '@rhie/rhie-client';
import { LaboratoryEncounterProcessor } from './laboratory-encounter.processor.js';
import { LaboratoryPayloadBuilder } from './laboratory-payload.builder.js';
import type { LaboratoryEncounterRepository } from '../repository/laboratory-encounter.repository.js';

const silentLogger = {
  debug: mock.fn(),
  info: mock.fn(),
  warn: mock.fn(),
  error: mock.fn(),
  fatal: mock.fn(),
  trace: mock.fn(),
  child: () => silentLogger,
} as unknown as Logger;

const rhieConfig: RhieConfig = {
  baseUrl: 'https://devhie.moh.gov.rw:5000',
  timeoutMs: 30000,
  auth: { type: 'basic', username: 'test', password: 'test' },
  clientRegistryPath: '/clientregistry/Patient',
  encounterIdPath: '/encounters/id',
  visitEncounterPath: '/shr/Encounter',
  transferEncounterPath: '/encounters/transfer',
  observationPath: '/shr/Observation',
};

const sampleLabResult = {
  reference_encount_id: 'visit-1',
  upid: '1234567890123456',
  client_id: 1,
  main_date: '2026-06-24',
  observation_encount_id: 'lab-1',
  source_id: 10,
  main_display: 'Laboratory',
  display: 'Laboratory' as const,
  div_display: 'Laboratory',
  full_description: 'RDT',
  result: 'Negatif',
  order_time: '2026-06-24 10:00:00',
  practitioner_name: 'Tech',
  code: 'Lab-000',
};

const sampleLabRequest = {
  reference_encount_id: 'visit-1',
  upid: '1234567890123456',
  client_id: 1,
  main_date: '2026-06-24',
  observation_encount_id: 'lab-req-1',
  source_id: 11,
  main_display: 'Laboratory procedure',
  display: 'Lab Request' as const,
  div_display: 'Lab Request',
  full_description: 'FBC',
  order_time: '2026-06-24 10:00:00',
  practitioner_name: 'Dr',
  code: 'Lab-000',
};

function stubUpload(resourceType: string, success: boolean): ShrResourceUploadResult {
  return {
    success,
    endpoint: `/shr/${resourceType}`,
    resourceType,
    resourceId: 'x',
    httpCode: success ? 200 : 500,
    statusCode: success ? 200 : 500,
    data: success ? {} : { error: 'fail' },
    error: success ? undefined : 'Request failed',
  };
}

function createProcessor(
  repository: Partial<LaboratoryEncounterRepository>,
  config: ObservationConfig,
  uploadShrResource = mock.fn(async (_h, _a, resourceType: string) =>
    stubUpload(resourceType, true),
  ),
): LaboratoryEncounterProcessor {
  return new LaboratoryEncounterProcessor({
    repository: repository as LaboratoryEncounterRepository,
    payloadBuilder: new LaboratoryPayloadBuilder(),
    logger: silentLogger,
    config,
    rhieConfig,
    facilityId: '1',
    uploadShrResource,
  });
}

describe('LaboratoryEncounterProcessor production mode', () => {
  it('marks lab result uploaded only on HTTP success', async () => {
    const uploadShrResource = mock.fn(async (_h, _a, resourceType: string) =>
      stubUpload(resourceType, true),
    );
    const markObservationUploaded = mock.fn(async () => undefined);
    const processor = createProcessor(
      {
        getLabResultEncounterData: mock.fn(async () => [sampleLabResult]),
        markObservationUploaded,
      },
      { executionMode: 'production' },
      uploadShrResource,
    );

    const result = await processor.uploadLabResults(1, '2026-06-24');
    assert.equal(result.uploaded, 1);
    assert.equal(markObservationUploaded.mock.callCount(), 1);
    assert.equal(uploadShrResource.mock.calls[0].arguments[2], 'Observation');
  });

  it('does not mark lab result on HTTP failure', async () => {
    const uploadShrResource = mock.fn(async (_h, _a, resourceType: string) =>
      stubUpload(resourceType, false),
    );
    const markObservationUploaded = mock.fn(async () => undefined);
    const processor = createProcessor(
      {
        getLabResultEncounterData: mock.fn(async () => [sampleLabResult]),
        markObservationUploaded,
      },
      { executionMode: 'production' },
      uploadShrResource,
    );

    const result = await processor.uploadLabResults(1, '2026-06-24');
    assert.equal(result.uploaded, 0);
    assert.equal(markObservationUploaded.mock.callCount(), 0);
  });

  it('marks lab request uploaded only on HTTP success', async () => {
    const uploadShrResource = mock.fn(async (_h, _a, resourceType: string) =>
      stubUpload(resourceType, true),
    );
    const markObservationUploaded = mock.fn(async () => undefined);
    const processor = createProcessor(
      {
        getLabRequestEncounterData: mock.fn(async () => [sampleLabRequest]),
        markObservationUploaded,
      },
      { executionMode: 'production' },
      uploadShrResource,
    );

    const result = await processor.uploadLabRequests(1, '2026-06-24');
    assert.equal(result.uploaded, 1);
    assert.equal(uploadShrResource.mock.calls[0].arguments[2], 'ServiceRequest');
  });
});
