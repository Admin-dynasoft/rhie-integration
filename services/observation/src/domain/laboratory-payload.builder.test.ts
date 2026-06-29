import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  LaboratoryPayloadBuilder,
  LABORATORY_DISPLAY,
  LAB_REQUEST_DISPLAY,
} from './laboratory-payload.builder.js';
import type { LabRequestEncounterDataRow, LabResultEncounterDataRow } from './types.js';

const sampleLabResult: LabResultEncounterDataRow = {
  reference_encount_id: 'visit-enc-123',
  upid: '1234567890123456',
  client_id: 42,
  main_date: '2026-06-24',
  observation_encount_id: 'lab-enc-456',
  source_id: 55,
  main_display: 'Laboratory',
  display: 'Laboratory',
  div_display: 'Laboratory',
  full_description: 'Malaria RDT',
  result: 'Negatif',
  order_time: '2026-06-24 14:30:00',
  practitioner_name: 'Lab Tech',
  code: 'Lab-000',
};

const sampleLabRequest: LabRequestEncounterDataRow = {
  reference_encount_id: 'visit-enc-123',
  upid: '1234567890123456',
  client_id: 42,
  main_date: '2026-06-24',
  observation_encount_id: 'lab-req-789',
  source_id: 66,
  main_display: 'Laboratory procedure',
  display: 'Lab Request',
  div_display: 'Lab Request',
  full_description: 'Full Blood Count',
  order_time: '2026-06-24 09:00:00',
  practitioner_name: 'Dr. Smith',
  code: 'Lab-000',
};

describe('LaboratoryPayloadBuilder (PHP parity)', () => {
  const builder = new LaboratoryPayloadBuilder();

  it('buildLabResult matches buildLabObservation()', () => {
    const payload = builder.buildLabResult(sampleLabResult);

    assert.equal(payload.resourceType, 'Observation');
    assert.equal(payload.id, 'lab-enc-456');
    assert.equal(payload.status, 'final');
    assert.equal(payload.code.coding[0].code, '33747-0');
    assert.equal(payload.code.coding[0].display, 'Malaria RDT');
    assert.equal(payload.category[0].coding[0].code, 'laboratory');
    assert.equal(payload.category[0].coding[0].display, 'Laboratory');
    assert.equal(payload.subject.reference, 'Patient/1234567890123456');
    assert.equal(payload.encounter.reference, 'Encounter/visit-enc-123');
    assert.equal(payload.valueQuantity.value, null);
    assert.equal(payload.valueQuantity.unit, 'Negatif');
    assert.equal(payload.effectiveDateTime, '2026-06-24T12:30:00+00:00');
  });

  it('buildLabRequest matches buildLabRequestObservation()', () => {
    const payload = builder.buildLabRequest(sampleLabRequest);

    assert.equal(payload.resourceType, 'ServiceRequest');
    assert.equal(payload.id, 'lab-req-789');
    assert.equal(payload.status, 'active');
    assert.equal(payload.intent, 'order');
    assert.equal(payload.category.coding.code, '108252007');
    assert.equal(payload.category.coding.display, 'Laboratory procedure');
    assert.equal(payload.code.coding[0].code, 'unknown');
    assert.equal(payload.code.coding[0].display, 'Full Blood Count');
    assert.equal(payload.occurrenceDateTime, '2026-06-24T07:00:00+00:00');
    assert.equal(payload.locationReference.reference, 'Location/1');
  });

  it('lab result Positif mapping from pos_neg_result = 1', () => {
    const payload = builder.buildLabResult({ ...sampleLabResult, result: 'Positif' });
    assert.equal(payload.valueQuantity.unit, 'Positif');
  });

  it('display constants match GetEncounterModel SQL output', () => {
    assert.equal(LABORATORY_DISPLAY, 'Laboratory');
    assert.notEqual(LABORATORY_DISPLAY, 'Laboratoryy');
    assert.equal(LAB_REQUEST_DISPLAY, 'Lab Request');
    assert.notEqual(LAB_REQUEST_DISPLAY, 'Lab Requestt');
  });
});
