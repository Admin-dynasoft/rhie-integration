import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import type { Logger } from '@rhie/logger';
import type { RhieConfig, VisitEncounterConfig } from '@rhie/config';
import { VisitEncounterProcessor } from './visit-encounter.processor.js';
import { VisitPayloadBuilder } from './visit-payload.builder.js';
import type { VisitEncounterRepository } from '../repository/visit-encounter.repository.js';

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
  observationPath: '/observations',
};

function createProcessor(
  repository: Partial<VisitEncounterRepository>,
  config: VisitEncounterConfig,
): VisitEncounterProcessor {
  return new VisitEncounterProcessor({
    repository: {
      getVisitBatchSelectionDiagnostics: mock.fn(async () => ({
        encounterType: 'VISIT_ENCOUNTER' as const,
        rhieStatus2Count: 0,
        batchEligibleCount: 0,
        blockedByUpidStatus: 0,
        blockedByUpidPrefix: 0,
        blockedByAge: 0,
        blockedByDocumentNumber: 0,
      })),
      getETransferBatchSelectionDiagnostics: mock.fn(async () => ({
        encounterType: 'E_TRANSFER' as const,
        rhieStatus2Count: 0,
        batchEligibleCount: 0,
        blockedByUpidStatus: 0,
        blockedByUpidPrefix: 0,
        blockedByAge: 0,
        blockedByDocumentNumber: 0,
      })),
      ...repository,
    } as VisitEncounterRepository,
    payloadBuilder: new VisitPayloadBuilder(),
    logger: silentLogger,
    config,
    rhieConfig,
    facilityId: '1',
  });
}

describe('VisitEncounterProcessor', () => {
  it('skips UPID-prefixed encounters', async () => {
    const markVisitUploaded = mock.fn(async () => undefined);
    const processor = createProcessor(
      {
        getVisitEncounterData: mock.fn(async () => [
          {
            resource_encount_id: 'enc-1',
            upid: 'UP123456789012345',
            client_id: 1,
            visit_date: '2026-06-24',
            patient_name: 'Test',
            type_display: 'VISIT_ENCOUNTER',
            display: 'Visit',
            div_display: 'Visit Encounter',
            order_time: '2026-06-24 10:00:00',
            practitioner_name: 'Dr',
            practitioner_id: 'MS-PRAC-0025-001',
            facility_name: 'HC',
            location_id: 'F001',
          },
        ]),
        markVisitUploaded,
      },
      { executionMode: 'production' },
    );

    const results = await processor.upload(1, '2026-06-24', 'VISIT_ENCOUNTER');
    assert.equal(results.length, 0);
    assert.equal(markVisitUploaded.mock.callCount(), 0);
  });

  it('shadow mode builds payload without upload or DB update', async () => {
    const markVisitUploaded = mock.fn(async () => undefined);
    const processor = createProcessor(
      {
        getVisitEncounterData: mock.fn(async () => [
          {
            resource_encount_id: 'enc-1',
            upid: '1234567890123456',
            client_id: 1,
            visit_date: '2026-06-24',
            patient_name: 'Test',
            type_display: 'VISIT_ENCOUNTER',
            display: 'Visit',
            div_display: 'Visit Encounter',
            order_time: '2026-06-24 10:00:00',
            practitioner_name: 'Dr',
            practitioner_id: 'MS-PRAC-0025-001',
            facility_name: 'HC',
            location_id: 'F001',
          },
        ]),
        markVisitUploaded,
      },
      { executionMode: 'shadow' },
    );

    const results = await processor.upload(1, '2026-06-24', 'VISIT_ENCOUNTER');
    assert.equal(results.length, 1);
    assert.equal(results[0].kind, 'visit');
    assert.equal(markVisitUploaded.mock.callCount(), 0);
  });

  it('throws for unsupported encounter types', async () => {
    const processor = createProcessor({}, { executionMode: 'production' });
    await assert.rejects(
      () => processor.upload(1, '2026-06-24', 'CONSULTATION_ENCOUNTER'),
      /Unsupported encounter type/,
    );
  });

  it('E_TRANSFER with no parent visit rows skips upload and does not mark (PHP parity)', async () => {
    const markVisitUploaded = mock.fn(async () => undefined);
    const processor = createProcessor(
      {
        getETransferEncounterData: mock.fn(async () => []),
        markVisitUploaded,
      },
      { executionMode: 'production' },
    );

    const results = await processor.upload(1, '2026-06-24', 'E_TRANSFER');
    assert.equal(results.length, 0);
    assert.equal(markVisitUploaded.mock.callCount(), 0);
  });

  it('E_TRANSFER shadow mode includes reference_encount_id when parent visit uploaded', async () => {
    const markVisitUploaded = mock.fn(async () => undefined);
    const processor = createProcessor(
      {
        getETransferEncounterData: mock.fn(async () => [
          {
            resource_encount_id: 'etrans-1',
            reference_encount_id: 'visit-parent-1',
            upid: '1234567890123456',
            client_id: 1,
            visit_date: '2026-06-24',
            patient_name: 'Test',
            type_display: 'TRANSFER_ENCOUNTER',
            display: 'Transfer',
            div_display: 'Transfer Encounter',
            order_time: '2026-06-24 10:00:00',
            practitioner_name: 'Dr',
            practitioner_id: 'MS-PRAC-0025-001',
            origin_facility_name: 'Origin HC',
            destination_facility_name: 'Dest Hospital',
            origin_location_id: 'F001',
          },
        ]),
        markVisitUploaded,
      },
      { executionMode: 'shadow' },
    );

    const results = await processor.upload(1, '2026-06-24', 'E_TRANSFER');
    assert.equal(results.length, 1);
    assert.equal(results[0].kind, 'referral');
    assert.equal(markVisitUploaded.mock.callCount(), 0);
  });

  it('processPendingETransferEncounters counts skipped when parent visit not uploaded', async () => {
    const processor = createProcessor(
      {
        findPendingETransferEncounters: mock.fn(async () => [
          {
            client_id: 1,
            upid: '1234567890123456',
            date: '2026-06-24',
            age: '1990-01-01',
            resource_encount_id: 'etrans-1',
          },
        ]),
        getETransferEncounterData: mock.fn(async () => []),
      },
      { executionMode: 'shadow' },
    );

    const result = await processor.processPendingETransferEncounters(50);
    assert.equal(result.skipped, 1);
    assert.equal(result.processed, 0);
  });

  it('processPendingVisitEncounters counts skipped when no visit rows returned', async () => {
    const processor = createProcessor(
      {
        findPendingVisitEncounters: mock.fn(async () => [
          {
            client_id: 1,
            upid: '1234567890123456',
            date: '2026-06-24',
            age: '1990-01-01',
            resource_encount_id: 'enc-1',
          },
        ]),
        getVisitEncounterData: mock.fn(async () => []),
      },
      { executionMode: 'shadow' },
    );

    const result = await processor.processPendingVisitEncounters(50);
    assert.equal(result.skipped, 1);
    assert.equal(result.processed, 0);
  });
});
