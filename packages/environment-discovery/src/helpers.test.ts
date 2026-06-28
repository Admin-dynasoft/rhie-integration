import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  filterCandidateDatabases,
  isSystemDatabase,
  sanitizeFacilityCode,
  buildOnlineDatabaseId,
} from './helpers.js';
import { selectLocalDatabase } from './selection.js';
import type { ValidatedMedisoftDatabase } from './types.js';

const sampleCandidates: ValidatedMedisoftDatabase[] = [
  {
    database: 'medisoft_testing',
    facilityCode: 'FOSA-001',
    facilityName: 'Test Health Center',
    validatedTables: ['patients', 'upid_patients', 'address'],
  },
  {
    database: 'medisoft_backup',
    facilityCode: 'FOSA-002',
    facilityName: 'Backup Health Center',
    validatedTables: ['patients', 'upid_patients', 'address'],
  },
];

describe('environment discovery helpers', () => {
  it('ignores MySQL system databases', () => {
    assert.equal(isSystemDatabase('mysql'), true);
    assert.equal(isSystemDatabase('information_schema'), true);
    assert.equal(isSystemDatabase('medisoft_testing'), false);
  });

  it('filters system and central registry databases', () => {
    const filtered = filterCandidateDatabases([
      'information_schema',
      'mysql',
      'medisoft_hie',
      'medisoft_testing',
    ]);

    assert.deepEqual(filtered, ['medisoft_testing']);
  });

  it('falls back to database name for facility code', () => {
    assert.equal(sanitizeFacilityCode('', 'medisoft_testing'), 'medisoft_testing');
    assert.equal(sanitizeFacilityCode('FOSA-123', 'medisoft_testing'), 'FOSA-123');
  });

  it('builds stable online database ids', () => {
    assert.equal(buildOnlineDatabaseId(42, 'FOSA-123'), 'online-42-FOSA-123');
  });
});

describe('local database selection', () => {
  it('auto-selects when only one candidate exists', () => {
    const selected = selectLocalDatabase([sampleCandidates[0]!], {});
    assert.equal(selected.database, 'medisoft_testing');
  });

  it('honors MEDISOFT_DATABASE when provided', () => {
    const selected = selectLocalDatabase(sampleCandidates, {
      selectedDatabase: 'medisoft_backup',
    });
    assert.equal(selected.database, 'medisoft_backup');
  });

  it('fails with candidate list when multiple databases exist', () => {
    assert.throws(
      () => selectLocalDatabase(sampleCandidates, {}),
      /Multiple Medisoft databases were found/,
    );
  });
});
