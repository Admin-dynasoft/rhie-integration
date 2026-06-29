import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import type { Logger } from '@rhie/logger';
import type { RhieConfig, VisitEncounterConfig } from '@rhie/config';
import type { VisitEncounterUploadResult } from '@rhie/rhie-client';
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

function stubUpload(kind: 'visit' | 'referral', success: boolean): VisitEncounterUploadResult {
  return {
    success,
    endpoint: '/shr/Encounter',
    kind,
    encounterId: kind === 'visit' ? 'visit-enc-1' : 'etrans-1',
    upid: '1234567890123456',
    httpCode: success ? 200 : 500,
    statusCode: success ? 200 : 500,
    data: success ? {} : { error: 'fail' },
    error: success ? undefined : 'Request failed',
  };
}

function createProcessor(
  repository: Partial<VisitEncounterRepository>,
  config: VisitEncounterConfig,
  uploadVisitEncounter = mock.fn(async (_http, _auth, _config, _payload, kind: 'visit' | 'referral') =>
    stubUpload(kind, kind === 'referral'),
  ),
): VisitEncounterProcessor {
  return new VisitEncounterProcessor({
    repository: repository as VisitEncounterRepository,
    payloadBuilder: new VisitPayloadBuilder(),
    logger: silentLogger,
    config,
    rhieConfig,
    facilityId: '1',
    uploadVisitEncounter,
  });
}

describe('VisitEncounterProcessor production mode (PHP markVisitUploaded parity)', () => {
  it('VISIT_ENCOUNTER marks uploaded after sendToHIE even on HTTP failure path', async () => {
    const uploadVisitEncounter = mock.fn(async () => stubUpload('visit', false));
    const markVisitUploaded = mock.fn(async () => undefined);
    const processor = createProcessor(
      {
        getVisitEncounterData: mock.fn(async () => [
          {
            resource_encount_id: 'visit-enc-1',
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
      { executionMode: 'production' },
      uploadVisitEncounter,
    );

    const results = await processor.upload(1, '2026-06-24', 'VISIT_ENCOUNTER');
    assert.equal(results.length, 1);
    assert.equal(results[0].kind, 'visit');
    assert.equal(markVisitUploaded.mock.callCount(), 1);
    assert.deepEqual(markVisitUploaded.mock.calls[0].arguments, ['visit-enc-1']);
    assert.equal(uploadVisitEncounter.mock.calls[0].arguments[4], 'visit');
  });

  it('E_TRANSFER marks uploaded after sendToHIE with kind=referral', async () => {
    const uploadVisitEncounter = mock.fn(async () => stubUpload('referral', true));
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
      { executionMode: 'production' },
      uploadVisitEncounter,
    );

    const results = await processor.upload(1, '2026-06-24', 'E_TRANSFER');
    assert.equal(results.length, 1);
    assert.equal(results[0].kind, 'referral');
    assert.equal(markVisitUploaded.mock.callCount(), 1);
    assert.deepEqual(markVisitUploaded.mock.calls[0].arguments, ['etrans-1']);
    assert.equal(uploadVisitEncounter.mock.calls[0].arguments[4], 'referral');
  });
});

describe('processAllPendingEncounters ordering', () => {
  it('runs VISIT_ENCOUNTER batch before E_TRANSFER batch', async () => {
    const callOrder: string[] = [];
    const processor = createProcessor(
      {
        findPendingVisitEncounters: mock.fn(async () => {
          callOrder.push('findVisit');
          return [
            {
              client_id: 1,
              date: '2026-06-24',
              upid: 'x',
              age: '1990-01-01',
              resource_encount_id: 'v1',
            },
          ];
        }),
        findPendingETransferEncounters: mock.fn(async () => {
          callOrder.push('findETransfer');
          return [];
        }),
        getVisitEncounterData: mock.fn(async () => {
          callOrder.push('uploadVisit');
          return [];
        }),
      },
      { executionMode: 'shadow' },
    );

    await processor.processAllPendingEncounters(10);
    assert.deepEqual(callOrder, ['findVisit', 'uploadVisit', 'findETransfer']);
  });
});
