import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import type { Logger } from '@rhie/logger';
import type { RhieConfig, ObservationConfig } from '@rhie/config';
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

function createProcessor(
  repository: Partial<MedicationEncounterRepository>,
  config: ObservationConfig,
): MedicationEncounterProcessor {
  return new MedicationEncounterProcessor({
    repository: repository as MedicationEncounterRepository,
    payloadBuilder: new MedicationPayloadBuilder(),
    logger: silentLogger,
    config,
    rhieConfig,
    facilityId: '1',
  });
}

describe('MedicationEncounterProcessor', () => {
  it('skips UPID-prefixed medication requests', async () => {
    const markObservationUploaded = mock.fn(async () => undefined);
    const processor = createProcessor(
      {
        getMedicationEncounterData: mock.fn(async () => [
          { ...sampleRow, upid: 'UP123456789012345' },
        ]),
        markObservationUploaded,
      },
      { executionMode: 'production' },
    );

    const result = await processor.uploadMedications(1, '2026-06-24');
    assert.equal(result.uploaded, 0);
    assert.equal(markObservationUploaded.mock.callCount(), 0);
  });

  it('shadow mode builds payload without upload or DB update', async () => {
    const markObservationUploaded = mock.fn(async () => undefined);
    const processor = createProcessor(
      {
        getMedicationEncounterData: mock.fn(async () => [sampleRow]),
        markObservationUploaded,
      },
      { executionMode: 'shadow' },
    );

    const result = await processor.uploadMedications(1, '2026-06-24');
    assert.equal(result.uploaded, 1);
    assert.equal(markObservationUploaded.mock.callCount(), 0);
  });

  it('skips non-Medication_Request display values (e.g. Medication_Admit)', async () => {
    const processor = createProcessor(
      {
        getMedicationEncounterData: mock.fn(async () => [
          { ...sampleRow, display: 'Medication_Admit' },
        ]),
      },
      { executionMode: 'shadow' },
    );

    const result = await processor.uploadMedications(1, '2026-06-24');
    assert.equal(result.attempted, 0);
  });

  it('returns empty results when no medication rows exist', async () => {
    const processor = createProcessor(
      {
        getMedicationEncounterData: mock.fn(async () => []),
      },
      { executionMode: 'production' },
    );

    const result = await processor.uploadMedications(1, '2026-06-24');
    assert.equal(result.uploaded, 0);
    assert.equal(result.attempted, 0);
  });

  it('processPendingMedicationEncounters returns zeros for empty batch', async () => {
    const processor = createProcessor(
      {
        findPendingMedicationEncounters: mock.fn(async () => []),
      },
      { executionMode: 'shadow' },
    );

    const batch = await processor.processPendingMedicationEncounters(10);
    assert.deepEqual(batch, { processed: 0, failed: 0, skipped: 0 });
  });

  it('deduplicates batch rows by client_id and date', async () => {
    const getMedicationEncounterData = mock.fn(async () => []);
    const processor = createProcessor(
      {
        findPendingMedicationEncounters: mock.fn(async () => [
          { client_id: 1, date: '2026-06-24', upid: '1234567890123456', observation_encount_id: 'a' },
          { client_id: 1, date: '2026-06-24', upid: '1234567890123456', observation_encount_id: 'b' },
        ]),
        getMedicationEncounterData,
      },
      { executionMode: 'shadow' },
    );

    await processor.processPendingMedicationEncounters(10);
    assert.equal(getMedicationEncounterData.mock.callCount(), 1);
  });
});
