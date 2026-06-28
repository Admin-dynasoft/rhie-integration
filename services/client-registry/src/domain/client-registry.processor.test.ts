import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import type { Logger } from '@rhie/logger';
import type { ClientRegistryConfig } from '@rhie/config';
import { ClientRegistryProcessor } from './client-registry.processor.js';
import { PatientPayloadBuilder } from './patient-payload.builder.js';
import type { PatientDataRow } from './types.js';
import type { ClientRegistryRepository } from '../repository/client-registry.repository.js';

const SAMPLE_DATA: PatientDataRow = {
  UPID: '602645-3179-7909',
  nida: '1199887766554433',
  full_names: 'Mukamana Jean',
  last_name: 'Mukamana',
  first_name: 'Jean',
  gender: 'F',
  marital_status: '1',
  phone: '0781234567',
  birthdate: '1990-05-15',
  rhie_status: 0,
  state: 'Kigali',
  state_id: 1,
  district: 'Gasabo',
  sector: 'Kimironko',
  cell: 'Kibagabaga',
  line: 'Gasabo, Kimironko, Kibagabaga',
  referral: true,
};

function createMockLogger(): Logger {
  return {
    debug: mock.fn(),
    info: mock.fn(),
    warn: mock.fn(),
    error: mock.fn(),
    fatal: mock.fn(),
    trace: mock.fn(),
    child: () => createMockLogger(),
    level: 'info',
    silent: mock.fn(),
  } as unknown as Logger;
}

function createMockRepository(overrides: Partial<ClientRegistryRepository> = {}): ClientRegistryRepository {
  return {
    findPendingClientIds: mock.fn(async () => [100]),
    getUpidsByClient: mock.fn(async () => ['602645-3179-7909']),
    getClientDataByUpid: mock.fn(async () => SAMPLE_DATA),
    updateUpidStatus: mock.fn(async () => undefined),
    markClientAsFailed: mock.fn(async () => undefined),
    ...overrides,
  } as unknown as ClientRegistryRepository;
}

const MOCK_RHIE_CONFIG = {
  baseUrl: 'https://devhie.moh.gov.rw:5000',
  auth: { type: 'basic' as const, username: 'test', password: 'test' },
  timeoutMs: 30000,
  clientRegistryPath: '/clientregistry/Patient',
  encounterIdPath: '/encounters/id',
  visitEncounterPath: '/encounters/visit',
  transferEncounterPath: '/encounters/transfer',
  observationPath: '/observations',
};

describe('ClientRegistryProcessor', () => {
  const shadowConfig: ClientRegistryConfig = {
    executionMode: 'shadow',
    requireReferral: true,
    excludeTemporaryDocuments: true,
    maxClientsPerBatch: 15,
  };

  it('shadow mode builds payload but does not update database', async () => {
    const repository = createMockRepository();
    const logger = createMockLogger();

    const processor = new ClientRegistryProcessor({
      repository,
      payloadBuilder: new PatientPayloadBuilder(),
      logger,
      config: shadowConfig,
      rhieConfig: MOCK_RHIE_CONFIG,
    });

    const result = await processor.processPendingClients(15);

    assert.equal(result.processed, 1);
    assert.equal(result.failed, 0);
    assert.equal((repository.updateUpidStatus as unknown as { mock: { calls: unknown[] } }).mock.calls.length, 0);
  });

  it('shadow mode marks failed when no local data but does not update DB', async () => {
    const repository = createMockRepository({
      getClientDataByUpid: mock.fn(async () => null),
    });
    const logger = createMockLogger();

    const processor = new ClientRegistryProcessor({
      repository,
      payloadBuilder: new PatientPayloadBuilder(),
      logger,
      config: shadowConfig,
      rhieConfig: MOCK_RHIE_CONFIG,
    });

    const result = await processor.processPendingClients(15);

    assert.equal(result.failed, 1);
    assert.equal((repository.updateUpidStatus as unknown as { mock: { calls: unknown[] } }).mock.calls.length, 0);
  });

  it('skips excluded UPIDs silently like PHP', async () => {
    const repository = createMockRepository({
      getUpidsByClient: mock.fn(async () => ['UP-12345', '602645-3179-7909']),
    });
    const logger = createMockLogger();

    const processor = new ClientRegistryProcessor({
      repository,
      payloadBuilder: new PatientPayloadBuilder(),
      logger,
      config: shadowConfig,
      rhieConfig: MOCK_RHIE_CONFIG,
    });

    const result = await processor.processPendingClients(15);

    assert.equal(result.processed, 1);
    assert.equal(result.skipped, 1);
  });

  it('marks all client UPIDs failed on unhandled exception like PHP batch', async () => {
    const repository = createMockRepository({
      getUpidsByClient: mock.fn(async () => {
        throw new Error('DB connection lost');
      }),
    });
    const logger = createMockLogger();

    const processor = new ClientRegistryProcessor({
      repository,
      payloadBuilder: new PatientPayloadBuilder(),
      logger,
      config: shadowConfig,
      rhieConfig: MOCK_RHIE_CONFIG,
    });

    const result = await processor.processPendingClients(15);

    assert.equal(result.failed, 1);
    const markFailed = repository.markClientAsFailed as unknown as {
      mock: { calls: Array<{ arguments: unknown[] }> };
    };
    assert.equal(markFailed.mock.calls.length, 1);
    assert.deepEqual(markFailed.mock.calls[0].arguments, [100]);
  });
});
