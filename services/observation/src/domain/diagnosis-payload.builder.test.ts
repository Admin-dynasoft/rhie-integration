import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DiagnosisPayloadBuilder,
  DIAGNOSIS_DISPLAY,
} from './diagnosis-payload.builder.js';
import type { DiagnosisEncounterDataRow } from './types.js';

const sampleDiagnosis: DiagnosisEncounterDataRow = {
  reference_encount_id: 'visit-enc-123',
  upid: '1234567890123456',
  client_id: 42,
  main_date: '2026-06-24',
  observation_encount_id: 'diag-enc-456',
  source_id: 88,
  main_display: 'Consultation Encounter',
  display: 'Diagnostic',
  div_display: 'Diagnostic',
  full_description: 'Malaria',
  order_time: '2026-06-24 14:30:00',
  practitioner_name: 'Dr. Smith',
  code: 'Diag-000',
};

describe('DiagnosisPayloadBuilder (PHP parity)', () => {
  const builder = new DiagnosisPayloadBuilder();

  it('builds FHIR Condition matching buildDiagnosticObservation()', () => {
    const payload = builder.build(sampleDiagnosis);

    assert.equal(payload.resourceType, 'Condition');
    assert.equal(payload.id, 'diag-enc-456');
    assert.equal(payload.clinicalStatus.coding[0].code, 'active');
    assert.equal(payload.verificationStatus.coding[0].code, 'confirmed');
    assert.equal(payload.code.coding[0].system, 'https://icd.who.int');
    assert.equal(payload.code.coding[0].code, '1F42');
    assert.equal(payload.code.coding[0].display, 'Malaria');
    assert.equal(payload.subject.reference, 'Patient/1234567890123456');
    assert.equal(payload.encounter.reference, 'Encounter/visit-enc-123');
    assert.equal(
      payload.asserter.reference,
      'Practitioner/f830114a-bc0b-410e-b8c7-79e61c0df653',
    );
    assert.equal(payload.asserter.display, 'Dr. Smith');
    assert.equal(payload.onsetDateTime, '2026-06-24T12:30:00+00:00');
  });

  it('uses fallback display when full_description is null', () => {
    const payload = builder.build({ ...sampleDiagnosis, full_description: null });
    assert.equal(payload.code.coding[0].display, 'No description');
  });

  it('DIAGNOSIS_DISPLAY matches GetEncounterModel SQL output', () => {
    assert.equal(DIAGNOSIS_DISPLAY, 'Diagnostic');
    assert.notEqual(DIAGNOSIS_DISPLAY, 'Diagnosticc');
  });
});
