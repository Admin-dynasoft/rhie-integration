import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import type { Logger } from '@rhie/logger';
import type { RhieConfig, ObservationConfig } from '@rhie/config';
import type { ShrResourceUploadResult } from '@rhie/rhie-client';
import { ComplaintEncounterProcessor } from './complaint-encounter.processor.js';
import { ComplaintPayloadBuilder } from './complaint-payload.builder.js';
import type { ComplaintEncounterRepository } from '../repository/complaint-encounter.repository.js';

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

const sampleRow = {
  reference_encount_id: 'visit-1',
  upid: '1234567890123456',
  client_id: 1,
  main_date: '2026-06-24',
  observation_encount_id: 'obs-1',
  source_id: 10,
  main_display: 'Consultation Encounter',
  display: 'Chief Complaint' as const,
  div_display: 'Chief Complaint',
  full_description: 'Fever',
  order_time: '2026-06-24 10:00:00',
  practitioner_name: 'Dr',
  code: 'Complaint-001',
};

function stubUpload(success: boolean): ShrResourceUploadResult {
  return {
    success,
    endpoint: '/shr/Observation',
    resourceType: 'Observation',
    resourceId: 'obs-1',
    httpCode: success ? 200 : 500,
    statusCode: success ? 200 : 500,
    data: success ? {} : { error: 'fail' },
    error: success ? undefined : 'Request failed',
  };
}

function createProcessor(
  repository: Partial<ComplaintEncounterRepository>,
  config: ObservationConfig,
  uploadShrResource = mock.fn(async () => stubUpload(true)),
): ComplaintEncounterProcessor {
  return new ComplaintEncounterProcessor({
    repository: repository as ComplaintEncounterRepository,
    payloadBuilder: new ComplaintPayloadBuilder(),
    logger: silentLogger,
    config,
    rhieConfig,
    facilityId: '1',
    uploadShrResource,
  });
}

describe('ComplaintEncounterProcessor production mode (PHP markObservationUploaded parity)', () => {
  it('marks uploaded only on HTTP 200/201 success', async () => {
    const uploadShrResource = mock.fn(async () => stubUpload(true));
    const markObservationUploaded = mock.fn(async () => undefined);
    const processor = createProcessor(
      {
        getComplaintEncounterData: mock.fn(async () => [sampleRow]),
        markObservationUploaded,
      },
      { executionMode: 'production' },
      uploadShrResource,
    );

    const result = await processor.uploadComplaints(1, '2026-06-24');
    assert.equal(result.uploaded, 1);
    assert.equal(markObservationUploaded.mock.callCount(), 1);
    assert.deepEqual(markObservationUploaded.mock.calls[0].arguments, ['obs-1']);
    assert.equal(uploadShrResource.mock.calls[0].arguments[2], 'Observation');
  });

  it('does not mark uploaded on HTTP failure (PHP parity — unlike visit encounter)', async () => {
    const uploadShrResource = mock.fn(async () => stubUpload(false));
    const markObservationUploaded = mock.fn(async () => undefined);
    const processor = createProcessor(
      {
        getComplaintEncounterData: mock.fn(async () => [sampleRow]),
        markObservationUploaded,
      },
      { executionMode: 'production' },
      uploadShrResource,
    );

    const result = await processor.uploadComplaints(1, '2026-06-24');
    assert.equal(result.uploaded, 0);
    assert.equal(result.attempted, 1);
    assert.equal(markObservationUploaded.mock.callCount(), 0);
  });
});
