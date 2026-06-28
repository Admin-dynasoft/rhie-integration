import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { IntegrationStateStore } from './integration-state.store.js';
import type { DatabaseConnection } from '@rhie/database';

describe('IntegrationStateStore', () => {
  it('does not process terminal success records', async () => {
    const findByKey = mock.fn(async () => ({
      id: 1,
      facilityCode: 'HC-A',
      pipelineStage: 'client_registry',
      entityType: 'upid',
      entityKey: '602645-3179-7909',
      idempotencyKey: 'HC-A:client_registry:upid:602645-3179-7909',
      status: 'success' as const,
      retryCount: 0,
      rhieResourceId: '602645-3179-7909',
      rhieResourceType: 'Patient',
      lastErrorMessage: null,
      lastAttemptAt: null,
      lastSuccessAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const store = new IntegrationStateStore({
      db: {} as DatabaseConnection,
      config: { autoMigrate: false, maxRetries: 3, deadLetterAfterRetries: 5 },
    });

    (store as unknown as { repository: { findByIdempotencyKey: typeof findByKey } }).repository = {
      findByIdempotencyKey: findByKey,
    } as never;

    const shouldProcess = await store.shouldProcess('HC-A:client_registry:upid:602645-3179-7909');
    assert.equal(shouldProcess, false);
    assert.equal(store.isTerminalStatus('success'), true);
    assert.equal(store.isTerminalStatus('dead_letter'), true);
    assert.equal(store.isTerminalStatus('pending'), false);
  });

  it('builds idempotency keys via store helper', () => {
    const store = new IntegrationStateStore({
      db: {} as DatabaseConnection,
      config: { autoMigrate: false, maxRetries: 3, deadLetterAfterRetries: 5 },
    });

    const key = store.buildIdempotencyKey({
      facilityCode: 'HC-A',
      pipelineStage: 'visit_encounter',
      entityType: 'encounter_main',
      entityKey: 'uuid-123',
    });

    assert.equal(key, 'HC-A:visit_encounter:encounter_main:uuid-123');
  });
});
