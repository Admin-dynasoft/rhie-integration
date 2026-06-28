import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import type { Logger } from '@rhie/logger';
import type { EncounterIdConfig } from '@rhie/config';
import { EncounterProcessor } from './encounter.processor.js';
import { EncounterPayloadBuilder } from './encounter-payload.builder.js';
import type { EncounterRepository } from '../repository/encounter.repository.js';

const FIXED_UUID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

function createMockLogger(): Logger {
  return {
    debug: mock.fn(),
    info: mock.fn(),
    warn: mock.fn(),
    error: mock.fn(),
    fatal: mock.fn(),
    trace: mock.fn(),
    child: () => createMockLogger(),
  } as unknown as Logger;
}

function createShadowConfig(): EncounterIdConfig {
  return {
    executionMode: 'shadow',
    generateFromDate: '2026-06-24',
    transferGenerateFromDate: '2026-06-20',
  };
}

describe('EncounterProcessor shadow mode', () => {
  it('generates visit encounter payload without DB writes', async () => {
    const insertMain = mock.fn(async () => undefined);
    const markVisit = mock.fn(async () => undefined);

    const repository = {
      fetchVisitEncounters: mock.fn(async () => [
        {
          date: '2026-06-25',
          time: '09:30:00',
          client_id: 12345,
          upid: '602645-3179-7909',
          referral: true,
        },
      ]),
      fetchTransferEncounters: mock.fn(async () => []),
      fetchOrdersEncounters: mock.fn(async () => []),
      fetchLabResults: mock.fn(async () => []),
      fetchLabRequests: mock.fn(async () => []),
      fetchDiagEncounters: mock.fn(async () => []),
      fetchComplaintEncounters: mock.fn(async () => []),
      fetchVitalSignEncounters: mock.fn(async () => []),
      fetchNcdVitalEncounters: mock.fn(async () => []),
      fetchNcdPlaintesEncounters: mock.fn(async () => []),
      fetchNcdDiagnosticEncounters: mock.fn(async () => []),
      fetchReferralEncounters: mock.fn(async () => []),
      mainEncounterExists: mock.fn(async () => false),
      insertMainEncounter: insertMain,
      insertPatientEncounter: mock.fn(async () => undefined),
      markVisitAsUploaded: markVisit,
      markOrderAsUploaded: mock.fn(async () => undefined),
      markLabAsUploaded: mock.fn(async () => undefined),
      markDiagAsUploaded: mock.fn(async () => undefined),
      markComplaintAsUploaded: mock.fn(async () => undefined),
      markVitalSignAsUploaded: mock.fn(async () => undefined),
      markNcdAsUploaded: mock.fn(async () => undefined),
    } as unknown as EncounterRepository;

    const logger = createMockLogger();
    const processor = new EncounterProcessor({
      repository,
      payloadBuilder: new EncounterPayloadBuilder(),
      logger,
      config: createShadowConfig(),
      uuidFactory: () => FIXED_UUID,
      now: () => new Date('2026-06-28T14:00:00Z'),
    });

    const result = await processor.generateVisitEncounters('2026-06-24');

    assert.equal(result.processed, 1);
    assert.equal(insertMain.mock.callCount(), 0);
    assert.equal(markVisit.mock.callCount(), 0);
    assert.equal((logger.info as unknown as ReturnType<typeof mock.fn>).mock.callCount(), 1);
  });

  it('skips excluded UPID prefixes like PHP', async () => {
    const repository = {
      fetchVisitEncounters: mock.fn(async () => [
        {
          date: '2026-06-25',
          time: '09:30:00',
          client_id: 12345,
          upid: 'UP-EXCLUDED',
          referral: false,
        },
      ]),
      mainEncounterExists: mock.fn(async () => false),
      insertMainEncounter: mock.fn(async () => undefined),
      markVisitAsUploaded: mock.fn(async () => undefined),
    } as unknown as EncounterRepository;

    const processor = new EncounterProcessor({
      repository,
      payloadBuilder: new EncounterPayloadBuilder(),
      logger: createMockLogger(),
      config: createShadowConfig(),
      uuidFactory: () => FIXED_UUID,
      now: () => new Date('2026-06-28T14:00:00Z'),
    });

    const result = await processor.generateVisitEncounters('2026-06-24');

    assert.equal(result.processed, 0);
    assert.equal(result.skipped, 1);
  });

  it('preserves vital main check type encountervital vs insert encounter_vital', async () => {
    const mainExists = mock.fn(async (_upid, _clientId, _date, type: string) => {
      assert.equal(type, 'encountervital');
      return false;
    });
    const insertMain = mock.fn(async (payload: { type: string }) => {
      assert.equal(payload.type, 'encounter_vital');
    });

    const repository = {
      fetchVitalSignEncounters: mock.fn(async () => [
        {
          upid: '602645-3179-7909',
          patient_id: 12345,
          source_id: 100,
          source_date: '2026-06-25',
          referral: false,
        },
      ]),
      mainEncounterExists: mainExists,
      insertMainEncounter: insertMain,
      insertPatientEncounter: mock.fn(async () => undefined),
      markVitalSignAsUploaded: mock.fn(async () => undefined),
    } as unknown as EncounterRepository;

    const processor = new EncounterProcessor({
      repository,
      payloadBuilder: new EncounterPayloadBuilder(),
      logger: createMockLogger(),
      config: { ...createShadowConfig(), executionMode: 'production' },
      uuidFactory: () => FIXED_UUID,
      now: () => new Date('2026-06-28T14:00:00Z'),
    });

    await processor.generateVitalSignEncounters('2026-06-24');

    assert.equal(mainExists.mock.callCount(), 1);
    assert.equal(insertMain.mock.callCount(), 1);
  });
});

describe('EncounterProcessor phpTimestamp', () => {
  it('processAllGenerators runs all generators and isolates errors', async () => {
    const repository = {
      fetchVisitEncounters: mock.fn(async () => {
        throw new Error('visit failed');
      }),
      fetchTransferEncounters: mock.fn(async () => []),
      fetchOrdersEncounters: mock.fn(async () => []),
      fetchLabResults: mock.fn(async () => []),
      fetchLabRequests: mock.fn(async () => []),
      fetchDiagEncounters: mock.fn(async () => []),
      fetchComplaintEncounters: mock.fn(async () => []),
      fetchVitalSignEncounters: mock.fn(async () => []),
      fetchNcdVitalEncounters: mock.fn(async () => []),
      fetchNcdPlaintesEncounters: mock.fn(async () => []),
      fetchNcdDiagnosticEncounters: mock.fn(async () => []),
      fetchReferralEncounters: mock.fn(async () => []),
      mainEncounterExists: mock.fn(async () => false),
      insertMainEncounter: mock.fn(async () => undefined),
      insertPatientEncounter: mock.fn(async () => undefined),
      markVisitAsUploaded: mock.fn(async () => undefined),
      markOrderAsUploaded: mock.fn(async () => undefined),
      markLabAsUploaded: mock.fn(async () => undefined),
      markDiagAsUploaded: mock.fn(async () => undefined),
      markComplaintAsUploaded: mock.fn(async () => undefined),
      markVitalSignAsUploaded: mock.fn(async () => undefined),
      markNcdAsUploaded: mock.fn(async () => undefined),
    } as unknown as EncounterRepository;

    const processor = new EncounterProcessor({
      repository,
      payloadBuilder: new EncounterPayloadBuilder(),
      logger: createMockLogger(),
      config: createShadowConfig(),
      uuidFactory: () => FIXED_UUID,
      now: () => new Date('2026-06-28T14:00:00Z'),
    });

    const result = await processor.processAllGenerators();

    assert.equal(result.failed, 1);
    assert.equal(
      (repository.fetchTransferEncounters as unknown as ReturnType<typeof mock.fn>).mock.callCount(),
      1,
    );
  });
});
