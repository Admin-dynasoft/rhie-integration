import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateEncounterUuid, phpTimestamp } from './uuid.js';

describe('generateEncounterUuid', () => {
  it('produces RFC-4122-like format with 8-4-4-4-12 hex segments', () => {
    const uuid = generateEncounterUuid();
    assert.match(
      uuid,
      /^[0-9a-f]{4}[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}[0-9a-f]{4}[0-9a-f]{4}$/,
    );
  });

  it('sets version nibble to 4 and variant bits like PHP', () => {
    for (let i = 0; i < 20; i += 1) {
      const uuid = generateEncounterUuid();
      const parts = uuid.split('-');
      assert.equal(parts[2].charAt(0), '4');
      assert.match(parts[3].charAt(0), /[89ab]/);
    }
  });
});

describe('phpTimestamp', () => {
  it('formats like PHP date(Y-m-d H:i:s)', () => {
    assert.equal(
      phpTimestamp(new Date('2026-06-28T14:05:09')),
      '2026-06-28 14:05:09',
    );
  });
});
