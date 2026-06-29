import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import type { Logger } from '@rhie/logger';
import type { RhieConfig, ObservationConfig } from '@rhie/config';
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

function createProcessor(
  repository: Partial<ComplaintEncounterRepository>,
  config: ObservationConfig,
): ComplaintEncounterProcessor {
  return new ComplaintEncounterProcessor({
    repository: repository as ComplaintEncounterRepository,
    payloadBuilder: new ComplaintPayloadBuilder(),
    logger: silentLogger,
    config,
    rhieConfig,
    facilityId: '1',
  });
}

describe('ComplaintEncounterProcessor', () => {
  it('skips UPID-prefixed complaints', async () => {
    const markObservationUploaded = mock.fn(async () => undefined);
    const processor = createProcessor(
      {
        getComplaintEncounterData: mock.fn(async () => [
          { ...sampleRow, upid: 'UP123456789012345' },
        ]),
        markObservationUploaded,
      },
      { executionMode: 'production' },
    );

    const result = await processor.uploadComplaints(1, '2026-06-24');
    assert.equal(result.uploaded, 0);
    assert.equal(markObservationUploaded.mock.callCount(), 0);
  });

  it('shadow mode builds payload without upload or DB update', async () => {
    const markObservationUploaded = mock.fn(async () => undefined);
    const processor = createProcessor(
      {
        getComplaintEncounterData: mock.fn(async () => [sampleRow]),
        markObservationUploaded,
      },
      { executionMode: 'shadow' },
    );

    const result = await processor.uploadComplaints(1, '2026-06-24');
    assert.equal(result.uploaded, 1);
    assert.equal(markObservationUploaded.mock.callCount(), 0);
  });

  it('skips non-Chief Complaint display values', async () => {
    const processor = createProcessor(
      {
        getComplaintEncounterData: mock.fn(async () => [
          { ...sampleRow, display: 'Diagnostic' },
        ]),
      },
      { executionMode: 'shadow' },
    );

    const result = await processor.uploadComplaints(1, '2026-06-24');
    assert.equal(result.attempted, 0);
  });

  it('returns empty results when no complaint rows exist', async () => {
    const processor = createProcessor(
      {
        getComplaintEncounterData: mock.fn(async () => []),
      },
      { executionMode: 'production' },
    );

    const result = await processor.uploadComplaints(1, '2026-06-24');
    assert.equal(result.uploaded, 0);
    assert.equal(result.attempted, 0);
    assert.deepEqual(result.results, []);
  });

  it('processPendingComplaintEncounters returns zeros for empty batch', async () => {
    const processor = createProcessor(
      {
        findPendingComplaintEncounters: mock.fn(async () => []),
      },
      { executionMode: 'shadow' },
    );

    const batch = await processor.processPendingComplaintEncounters(10);
    assert.deepEqual(batch, { processed: 0, failed: 0, skipped: 0 });
  });

  it('deduplicates batch rows by client_id and date', async () => {
    const getComplaintEncounterData = mock.fn(async () => []);
    const processor = createProcessor(
      {
        findPendingComplaintEncounters: mock.fn(async () => [
          { client_id: 1, date: '2026-06-24', upid: '1234567890123456', observation_encount_id: 'a' },
          { client_id: 1, date: '2026-06-24', upid: '1234567890123456', observation_encount_id: 'b' },
        ]),
        getComplaintEncounterData,
      },
      { executionMode: 'shadow' },
    );

    await processor.processPendingComplaintEncounters(10);
    assert.equal(getComplaintEncounterData.mock.callCount(), 1);
  });

  it('counts batch row as skipped when no upload attempted', async () => {
    const processor = createProcessor(
      {
        findPendingComplaintEncounters: mock.fn(async () => [
          { client_id: 1, date: '2026-06-24', upid: '1234567890123456', observation_encount_id: 'a' },
        ]),
        getComplaintEncounterData: mock.fn(async () => []),
      },
      { executionMode: 'shadow' },
    );

    const batch = await processor.processPendingComplaintEncounters(10);
    assert.equal(batch.skipped, 1);
    assert.equal(batch.processed, 0);
  });
});
