import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ComplaintPayloadBuilder,
  phpEffectiveDateTimeUtc,
  COMPLAINT_DISPLAY,
} from './complaint-payload.builder.js';
import type { ComplaintEncounterDataRow } from './types.js';

const sampleComplaint: ComplaintEncounterDataRow = {
  reference_encount_id: 'visit-enc-123',
  upid: '1234567890123456',
  client_id: 42,
  main_date: '2026-06-24',
  observation_encount_id: 'obs-enc-456',
  source_id: 99,
  main_display: 'Consultation Encounter',
  display: 'Chief Complaint',
  div_display: 'Chief Complaint',
  full_description: 'Headache for 3 days',
  order_time: '2026-06-24 14:30:00',
  practitioner_name: 'Dr. Smith',
  code: 'Complaint-001',
};

describe('ComplaintPayloadBuilder (PHP parity)', () => {
  const builder = new ComplaintPayloadBuilder();

  it('builds FHIR Observation matching buildComplaintObservation()', () => {
    const payload = builder.build(sampleComplaint);

    assert.equal(payload.resourceType, 'Observation');
    assert.equal(payload.id, 'obs-enc-456');
    assert.equal(payload.status, 'final');
    assert.equal(payload.code.coding[0].code, '33747-0');
    assert.equal(payload.code.coding[0].display, 'Chief Complaints');
    assert.equal(payload.category[0].coding[0].code, 'survey');
    assert.equal(payload.subject.reference, 'Patient/1234567890123456');
    assert.equal(payload.encounter.reference, 'Encounter/visit-enc-123');
    assert.equal(
      payload.performer[0].reference,
      'Practitioner/f830114a-bc0b-410e-b8c7-79e61c0df653',
    );
    assert.equal(payload.performer[0].display, 'Dr. Smith');
    assert.equal(payload.valueString, 'Headache for 3 days');
    assert.equal(payload.effectiveDateTime, '2026-06-24T12:30:00+00:00');
  });

  it('uses fallback valueString when full_description is null', () => {
    const payload = builder.build({ ...sampleComplaint, full_description: null });
    assert.equal(payload.valueString, 'No complaint details');
  });

  it('COMPLAINT_DISPLAY matches GetEncounterModel SQL output', () => {
    assert.equal(COMPLAINT_DISPLAY, 'Chief Complaint');
    assert.notEqual(COMPLAINT_DISPLAY, 'Chief Complaintt');
  });
});

describe('phpEffectiveDateTimeUtc', () => {
  it('converts Africa/Kigali local time to UTC atom format', () => {
    assert.equal(phpEffectiveDateTimeUtc('2026-06-24 14:30:00'), '2026-06-24T12:30:00+00:00');
  });
});
