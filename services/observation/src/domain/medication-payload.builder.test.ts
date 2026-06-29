import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MedicationPayloadBuilder,
  MEDICATION_REQUEST_DISPLAY,
} from './medication-payload.builder.js';
import type { MedicationEncounterDataRow } from './types.js';

const sampleMedication: MedicationEncounterDataRow = {
  reference_encount_id: 'visit-enc-123',
  upid: '1234567890123456',
  client_id: 42,
  main_date: '2026-06-24',
  observation_encount_id: 'med-enc-456',
  source_id: 77,
  main_display: 'Medication Encounter',
  display: 'Medication_Request',
  div_display: 'Medication',
  duration: 7,
  posologie: '2x daily',
  quantity: 10,
  item: 'prod-1',
  order_time: '2026-06-24 14:30:00',
  practitioner_name: 'Dr. Smith',
  full_description: 'Paracetamol 500mg || 2x daily || 7 days || 10',
  code: '123456789',
};

describe('MedicationPayloadBuilder (PHP parity)', () => {
  const builder = new MedicationPayloadBuilder();

  it('builds FHIR MedicationRequest matching buildMedicationRequestObservation()', () => {
    const payload = builder.build(sampleMedication);

    assert.equal(payload.resourceType, 'MedicationRequest');
    assert.equal(payload.id, 'med-enc-456');
    assert.equal(payload.status, 'active');
    assert.equal(payload.intent, 'order');
    assert.equal(payload.medicationCodeableConcept.coding[0].system, 'http://snomed.info/sct');
    assert.equal(payload.medicationCodeableConcept.coding[0].code, '123456789');
    assert.equal(
      payload.medicationCodeableConcept.coding[0].display,
      'Paracetamol 500mg || 2x daily || 7 days || 10',
    );
    assert.equal(payload.subject.reference, 'Patient/1234567890123456');
    assert.equal(payload.encounter.reference, 'Encounter/visit-enc-123');
    assert.equal(payload.authoredOn, '2026-06-24T12:30:00+00:00');
    assert.equal(payload.requester.display, 'Dr. Smith');
    assert.equal(payload.groupIdentifier.value, 'PR-2025-11-20-001');
    assert.equal(payload.dosageInstruction[0].timing.repeat.frequency, 7);
    assert.equal(payload.dosageInstruction[0].doseQuantity.value, 10);
  });

  it('preserves PHP duplicate extension key — final extension uses System fallback display', () => {
    const payload = builder.build({ ...sampleMedication, practitioner_name: null });
    const extension = payload.extension as Array<{ valueReference: { display: string } }>;
    assert.equal(extension[0].valueReference.display, 'System');
  });

  it('preserves PHP numeric "0" key with contactpoint extension', () => {
    const payload = builder.build(sampleMedication);
    const contactpoint = payload['0'] as {
      url: string;
      valueContactPoint: { value: string };
    };
    assert.equal(contactpoint.url, 'http://hl7.org/fhir/StructureDefinition/contactpoint');
    assert.equal(contactpoint.valueContactPoint.value, 'null');
  });

  it('uses unknown code and No description fallbacks', () => {
    const payload = builder.build({
      ...sampleMedication,
      code: null,
      full_description: null,
    });
    assert.equal(payload.medicationCodeableConcept.coding[0].code, 'unknown');
    assert.equal(payload.medicationCodeableConcept.coding[0].display, 'No description');
  });

  it('MEDICATION_REQUEST_DISPLAY matches GetEncounterModel SQL output', () => {
    assert.equal(MEDICATION_REQUEST_DISPLAY, 'Medication_Request');
    assert.notEqual(MEDICATION_REQUEST_DISPLAY, 'Medication_Requestt');
  });
});
