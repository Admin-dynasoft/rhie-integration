import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import type { Logger } from '@rhie/logger';
import type { RhieConfig, ObservationConfig } from '@rhie/config';
import type { ShrResourceUploadResult } from '@rhie/rhie-client';
import { MedicationEncounterProcessor } from './medication-encounter.processor.js';
import { MedicationPayloadBuilder } from './medication-payload.builder.js';
import type { MedicationEncounterRepository } from '../repository/medication-encounter.repository.js';

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
  observation_encount_id: 'med-1',
  source_id: 10,
  main_display: 'Medication Encounter',
  display: 'Medication_Request' as const,
  div_display: 'Medication',
  duration: 5,
  posologie: '1x daily',
  quantity: 20,
  item: 'prod-1',
  order_time: '2026-06-24 10:00:00',
  practitioner_name: 'Dr',
  full_description: 'Amoxicillin || 1x daily || 5 days || 20',
  code: '999',
};

function stubUpload(success: boolean): ShrResourceUploadResult {
  return {
    success,
    endpoint: '/shr/MedicationRequest',
    resourceType: 'MedicationRequest',
    resourceId: 'med-1',
    httpCode: success ? 201 : 500,
    statusCode: success ? 201 : 500,
    data: success ? {} : { error: 'fail' },
    error: success ? undefined : 'Request failed',
  };
}

function createProcessor(
  repository: Partial<MedicationEncounterRepository>,
  config: ObservationConfig,
  uploadShrResource = mock.fn(async () => stubUpload(true)),
): MedicationEncounterProcessor {
  return new MedicationEncounterProcessor({
    repository: repository as MedicationEncounterRepository,
    payloadBuilder: new MedicationPayloadBuilder(),
    logger: silentLogger,
    config,
    rhieConfig,
    facilityId: '1',
    uploadShrResource,
  });
}

describe('MedicationEncounterProcessor production mode (PHP markObservationUploaded parity)', () => {
  it('marks uploaded only on HTTP 200/201 success', async () => {
    const uploadShrResource = mock.fn(async () => stubUpload(true));
    const markObservationUploaded = mock.fn(async () => undefined);
    const processor = createProcessor(
      {
        getMedicationEncounterData: mock.fn(async () => [sampleRow]),
        markObservationUploaded,
      },
      { executionMode: 'production' },
      uploadShrResource,
    );

    const result = await processor.uploadMedications(1, '2026-06-24');
    assert.equal(result.uploaded, 1);
    assert.equal(markObservationUploaded.mock.callCount(), 1);
    assert.deepEqual(markObservationUploaded.mock.calls[0].arguments, ['med-1']);
    assert.equal(uploadShrResource.mock.calls[0].arguments[2], 'MedicationRequest');
  });

  it('does not mark uploaded on HTTP failure', async () => {
    const uploadShrResource = mock.fn(async () => stubUpload(false));
    const markObservationUploaded = mock.fn(async () => undefined);
    const processor = createProcessor(
      {
        getMedicationEncounterData: mock.fn(async () => [sampleRow]),
        markObservationUploaded,
      },
      { executionMode: 'production' },
      uploadShrResource,
    );

    const result = await processor.uploadMedications(1, '2026-06-24');
    assert.equal(result.uploaded, 0);
    assert.equal(result.attempted, 1);
    assert.equal(markObservationUploaded.mock.callCount(), 0);
  });
});
