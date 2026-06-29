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

describe('VisitPayloadBuilder E_TRANSFER (buildRefFHIRPayload)', () => {
  const builder = new VisitPayloadBuilder();
  const fixedNow = () => new Date('2026-06-24T15:00:00+02:00');

  it('partOf references parent visit when fetch SQL returns reference_encount_id', () => {
    const payload = builder.buildRef(
      {
        resource_encount_id: 'etrans-1',
        reference_encount_id: 'visit-parent-uuid',
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
        origin_location_id: 'FOSA001',
      },
      fixedNow,
    );

    assert.equal(payload.status, 'planned');
    assert.equal(payload.partOf.reference, 'Encounter/visit-parent-uuid');
    assert.equal(payload.hospitalization.destination.reference, 'Location/');
  });

  it('differs from VISIT payload: planned status, hospitalization, partOf, period.end', () => {
    const visitPayload = builder.build({
      resource_encount_id: 'visit-1',
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
      facility_name: 'Origin HC',
      location_id: 'FOSA001',
    });

    const transferPayload = builder.buildRef(
      {
        resource_encount_id: 'etrans-1',
        reference_encount_id: 'visit-parent-uuid',
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
        origin_location_id: 'FOSA001',
      },
      fixedNow,
    );

    assert.equal(visitPayload.status, 'finished');
    assert.equal(transferPayload.status, 'planned');
    assert.equal(visitPayload.type[0].coding[0].display, 'VISIT_ENCOUNTER');
    assert.equal(transferPayload.type[0].coding[0].display, 'TRANSFER_ENCOUNTER');
    assert.ok('partOf' in transferPayload);
    assert.ok(!('partOf' in visitPayload));
    assert.ok(transferPayload.hospitalization);
    assert.ok(!('hospitalization' in visitPayload));
    assert.equal(transferPayload.period.end, '2026-06-24T15:00:00+02:00');
    assert.equal(visitPayload.period.start, transferPayload.period.start);
    assert.equal(transferPayload.location[0].location.reference, 'Location/FOSA001');
    assert.equal(transferPayload.hospitalization.origin.reference, 'Location/FOSA001');
    assert.equal(transferPayload.hospitalization.origin.display, 'Origin HC HC');
    assert.equal(transferPayload.hospitalization.destination.display, 'Dest Hospital');
    assert.equal(transferPayload.participant[0].individual.display, 'Dr');
  });
});
