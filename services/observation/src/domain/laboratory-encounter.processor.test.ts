import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import type { Logger } from '@rhie/logger';
import type { RhieConfig, ObservationConfig } from '@rhie/config';
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

function createProcessor(
  repository: Partial<LaboratoryEncounterRepository>,
  config: ObservationConfig,
): LaboratoryEncounterProcessor {
  return new LaboratoryEncounterProcessor({
    repository: repository as LaboratoryEncounterRepository,
    payloadBuilder: new LaboratoryPayloadBuilder(),
    logger: silentLogger,
    config,
    rhieConfig,
    facilityId: '1',
  });
}

describe('LaboratoryEncounterProcessor', () => {
  it('skips UPID-prefixed lab results', async () => {
    const markObservationUploaded = mock.fn(async () => undefined);
    const processor = createProcessor(
      {
        getLabResultEncounterData: mock.fn(async () => [
          { ...sampleLabResult, upid: 'UP123456789012345' },
        ]),
        markObservationUploaded,
      },
      { executionMode: 'production' },
    );

    const result = await processor.uploadLabResults(1, '2026-06-24');
    assert.equal(result.uploaded, 0);
    assert.equal(markObservationUploaded.mock.callCount(), 0);
  });

  it('shadow mode builds lab result payload without upload or DB update', async () => {
    const markObservationUploaded = mock.fn(async () => undefined);
    const processor = createProcessor(
      {
        getLabResultEncounterData: mock.fn(async () => [sampleLabResult]),
        markObservationUploaded,
      },
      { executionMode: 'shadow' },
    );

    const result = await processor.uploadLabResults(1, '2026-06-24');
    assert.equal(result.uploaded, 1);
    assert.equal(markObservationUploaded.mock.callCount(), 0);
  });

  it('shadow mode builds lab request payload without upload or DB update', async () => {
    const markObservationUploaded = mock.fn(async () => undefined);
    const processor = createProcessor(
      {
        getLabRequestEncounterData: mock.fn(async () => [sampleLabRequest]),
        markObservationUploaded,
      },
      { executionMode: 'shadow' },
    );

    const result = await processor.uploadLabRequests(1, '2026-06-24');
    assert.equal(result.uploaded, 1);
    assert.equal(result.results[0].resourceType, 'ServiceRequest');
  });

  it('skips wrong display values for lab results', async () => {
    const processor = createProcessor(
      {
        getLabResultEncounterData: mock.fn(async () => [
          { ...sampleLabResult, display: 'Lab Request' },
        ]),
      },
      { executionMode: 'shadow' },
    );

    const result = await processor.uploadLabResults(1, '2026-06-24');
    assert.equal(result.attempted, 0);
  });

  it('processPendingLabResultEncounters returns zeros for empty batch', async () => {
    const processor = createProcessor(
      {
        findPendingLabResultEncounters: mock.fn(async () => []),
      },
      { executionMode: 'shadow' },
    );

    const batch = await processor.processPendingLabResultEncounters(10);
    assert.deepEqual(batch, { processed: 0, failed: 0, skipped: 0 });
  });

  it('deduplicates lab request batch rows by client_id and date', async () => {
    const getLabRequestEncounterData = mock.fn(async () => []);
    const processor = createProcessor(
      {
        findPendingLabRequestEncounters: mock.fn(async () => [
          { client_id: 1, date: '2026-06-24', upid: '1234567890123456', observation_encount_id: 'a' },
          { client_id: 1, date: '2026-06-24', upid: '1234567890123456', observation_encount_id: 'b' },
        ]),
        getLabRequestEncounterData,
      },
      { executionMode: 'shadow' },
    );

    await processor.processPendingLabRequestEncounters(10);
    assert.equal(getLabRequestEncounterData.mock.callCount(), 1);
  });
});
