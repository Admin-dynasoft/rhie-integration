import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildIdempotencyKey, parseIdempotencyKey } from './idempotency.js';

describe('buildIdempotencyKey', () => {
  it('builds deterministic colon-separated keys', () => {
    const key = buildIdempotencyKey({
      facilityCode: 'HC-A',
      pipelineStage: 'client_registry',
      entityType: 'upid',
      entityKey: '602645-3179-7909',
    });

    assert.equal(key, 'HC-A:client_registry:upid:602645-3179-7909');
  });

  it('sanitizes whitespace and colons in parts', () => {
    const key = buildIdempotencyKey({
      facilityCode: 'HC A',
      pipelineStage: 'visit:encounter',
      entityType: 'order',
      entityKey: '12345',
    });

    assert.equal(key, 'HC_A:visit-encounter:order:12345');
  });

  it('round-trips via parseIdempotencyKey', () => {
    const key = buildIdempotencyKey({
      facilityCode: 'HC-B',
      pipelineStage: 'encounter_id',
      entityType: 'clientts',
      entityKey: '99_2026-06-25',
    });

    const parsed = parseIdempotencyKey(key);
    assert.deepEqual(parsed, {
      facilityCode: 'HC-B',
      pipelineStage: 'encounter_id',
      entityType: 'clientts',
      entityKey: '99_2026-06-25',
    });
  });
});
