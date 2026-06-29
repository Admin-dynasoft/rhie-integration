import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { VisitPayloadBuilder, phpDateC } from './visit-payload.builder.js';
import type { VisitEncounterDataRow } from './types.js';

const sampleVisit: VisitEncounterDataRow = {
  resource_encount_id: 'abc-123-def',
  upid: '1234567890123456',
  client_id: 42,
  visit_date: '2026-06-24',
  patient_name: 'John Doe',
  type_display: 'VISIT_ENCOUNTER',
  display: 'Visit',
  div_display: 'Visit Encounter',
  order_time: '2026-06-24 14:30:00',
  practitioner_name: 'Dr. Smith',
  practitioner_id: 'MS-PRAC-0025-001',
  facility_name: 'Test HC',
  location_id: 'FOSA001',
};

describe('VisitPayloadBuilder (PHP parity)', () => {
  const builder = new VisitPayloadBuilder();

  it('builds FHIR Encounter matching UploadVisitEncounterController::buildFHIRPayload', () => {
    const payload = builder.build(sampleVisit);

    assert.equal(payload.resourceType, 'Encounter');
    assert.equal(payload.id, 'abc-123-def');
    assert.equal(payload.status, 'finished');
    assert.equal(payload.class.code, 'AMB');
    assert.equal(payload.class.display, 'Ambulatory');
    assert.equal(payload.type[0].coding[0].display, 'VISIT_ENCOUNTER');
    assert.equal(payload.serviceType.coding[0].display, 'Outpatients');
    assert.equal(payload.subject.reference, 'Patient/1234567890123456');
    assert.equal(payload.subject.identifier.value, '1234567890123456');
    assert.equal(payload.subject.display, 'John Doe');
    assert.equal(payload.participant[0].individual.reference, 'Practitioner/MS-PRAC-0025-001');
    assert.equal(payload.participant[0].individual.display, 'Dr. Smith');
    assert.equal(payload.period.start, '2026-06-24T14:30:00+02:00');
    assert.equal(payload.location[0].location.reference, 'Location/FOSA001');
    assert.equal(payload.location[0].location.display, 'Test HC HC');
  });

  it('meta tag matches PHP encounter-tag extension', () => {
    const payload = builder.build(sampleVisit);
    assert.deepEqual(payload.meta.tag[0], {
      system: 'http://fhir.openmrs.org/ext/encounter-tag',
      code: 'encounter',
      display: 'Encounter',
    });
  });
});

describe('phpDateC', () => {
  it('formats MySQL datetime as ISO 8601 with +02:00 offset', () => {
    assert.equal(phpDateC('2026-06-24 14:30:00'), '2026-06-24T14:30:00+02:00');
  });

  it('returns current ISO when input is empty', () => {
    const result = phpDateC('');
    assert.match(result, /^\d{4}-\d{2}-\d{2}T/);
  });
});
