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
});
