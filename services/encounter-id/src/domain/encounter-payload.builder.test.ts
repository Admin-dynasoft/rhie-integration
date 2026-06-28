import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  EncounterPayloadBuilder,
  serializeEncounterPayload,
} from './encounter-payload.builder.js';

const FIXED_TIME = '2026-06-28 14:00:00';
const FIXED_UUID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

describe('EncounterPayloadBuilder (PHP parity)', () => {
  const builder = new EncounterPayloadBuilder();

  it('builds main encounter with rhie_status 2 like PHP insertMainEncounter', () => {
    const payload = builder.buildMainEncounter({
      encountId: FIXED_UUID,
      type: 'VISIT_ENCOUNTER',
      upid: '602645-3179-7909',
      clientId: 12345,
      date: '2026-06-25',
      time: '09:30:00',
      rhieUploadedAt: FIXED_TIME,
    });

    assert.deepEqual(payload, {
      encountId: FIXED_UUID,
      type: 'VISIT_ENCOUNTER',
      upid: '602645-3179-7909',
      clientId: 12345,
      date: '2026-06-25',
      time: '09:30:00',
      rhieStatus: 2,
      rhieUploadedAt: FIXED_TIME,
    });
  });

  it('builds patient encounter for lab result like PHP insertEncounter', () => {
    const payload = builder.buildPatientEncounter({
      encountId: FIXED_UUID,
      type: 'lab',
      upid: '602645-3179-7909',
      clientId: 12345,
      sourceId: 9876,
      sourceTable: 'lab_results',
      date: '2026-06-25',
      time: '11:00:00',
      rhieUploadedAt: FIXED_TIME,
    });

    assert.deepEqual(payload, {
      encountId: FIXED_UUID,
      type: 'lab',
      upid: '602645-3179-7909',
      clientId: 12345,
      sourceId: 9876,
      sourceTable: 'lab_results',
      date: '2026-06-25',
      time: '11:00:00',
      rhieStatus: 2,
      rhieUploadedAt: FIXED_TIME,
    });
  });

  it('uses referral batch source_table diag_client for referral type', () => {
    const payload = builder.buildPatientEncounter({
      encountId: FIXED_UUID,
      type: 'referral',
      upid: '602645-3179-7909',
      clientId: 12345,
      sourceId: 55,
      sourceTable: 'diag_client',
      date: '2026-06-25',
      time: FIXED_TIME,
      rhieUploadedAt: FIXED_TIME,
    });

    assert.equal(payload.sourceTable, 'diag_client');
    assert.equal(payload.type, 'referral');
  });

  it('serializes payload for shadow logging', () => {
    const payload = builder.buildMainEncounter({
      encountId: FIXED_UUID,
      type: 'E_TRANSFER',
      upid: '602645-3179-7909',
      clientId: 99,
      date: '2026-06-20',
      time: '08:00:00',
      rhieUploadedAt: FIXED_TIME,
    });

    const serialized = serializeEncounterPayload(payload);
    assert.ok(serialized.includes('"type": "E_TRANSFER"'));
    assert.ok(serialized.includes('"rhieStatus": 2'));
  });
});
