import { phpEffectiveDateTimeUtc } from './complaint-payload.builder.js';
import type { FhirMedicationRequestPayload, MedicationEncounterDataRow } from './types.js';

/**
 * Builds FHIR MedicationRequest payload — port of UploadEncounterController::buildMedicationRequestObservation()
 * (rhie/controllers/traches/UploadEncounterController.php)
 *
 * Preserves PHP array quirks:
 * - duplicate "extension" key (last assignment wins — System fallback display)
 * - numeric key "0" holding contactpoint extension (orphaned from malformed array literal)
 */
export class MedicationPayloadBuilder {
  build(observation: MedicationEncounterDataRow): FhirMedicationRequestPayload {
    const authoredOn = phpEffectiveDateTimeUtc(observation.order_time);
    const practitionerDisplay = observation.practitioner_name ?? 'System';

    const payload: FhirMedicationRequestPayload = {
      resourceType: 'MedicationRequest',
      id: observation.observation_encount_id,
      status: 'active',
      intent: 'order',
      medicationCodeableConcept: {
        coding: [
          {
            system: 'http://snomed.info/sct',
            code: observation.code ?? 'unknown',
            display: observation.full_description ?? 'No description',
          },
        ],
      },
      subject: {
        reference: `Patient/${observation.upid}`,
      },
      encounter: {
        reference: `Encounter/${observation.reference_encount_id}`,
      },
      authoredOn,
      requester: {
        reference: 'Practitioner/f830114a-bc0b-410e-b8c7-79e61c0df653',
        display: practitionerDisplay,
      },
      extension: [
        {
          url: 'http://hl7.org/fhir/StructureDefinition/location',
          valueReference: {
            reference: 'Location/1',
            display: observation.practitioner_name ?? 'null',
          },
        },
      ],
    };

    // PHP numeric-key array element (lines 400–407) — not nested under extension
    payload['0'] = {
      url: 'http://hl7.org/fhir/StructureDefinition/contactpoint',
      valueContactPoint: {
        system: 'phone',
        value: observation.practitioner_phone ?? 'null',
        use: 'work',
      },
    };

    payload.groupIdentifier = {
      system: 'http://moh.gov.rw/prescription-code',
      value: 'PR-2025-11-20-001',
    };

    payload.insurance = [
      {
        reference: 'Coverage/cov-mituelle-230321',
        display: 'Mituelle de Santé - Community Based Health Insurance',
      },
    ];

    payload.dosageInstruction = [
      {
        text: 'Take as directed',
        timing: {
          repeat: {
            frequency: observation.duration ?? 1,
            period: 1,
            periodUnit: 'd',
          },
        },
        route: {
          coding: [
            {
              system: 'http://snomed.info/sct',
              code: '26643006',
              display: 'Oral route',
              text: 'oral',
            },
          ],
        },
        doseQuantity: {
          type: {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/dose-rate-type',
                code: 'ordered',
                display: 'Ordered',
              },
            ],
          },
          value: observation.quantity ?? null,
          unit: 'mg',
          system: 'http://unitsofmeasure.org',
          code: 'Mg',
        },
        method: {
          coding: [
            {
              system: 'http://snomed.info/sct',
              code: '738995006',
              display: 'Swallow',
              text: 'Swallow',
            },
          ],
        },
        doseAndRate: {
          type: {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/dose-rate-type',
                code: 'ordered',
                display: 'Ordered',
              },
            ],
          },
        },
      },
    ];

    // PHP duplicate "extension" key — overwrites first assignment (lines 487–495)
    payload.extension = [
      {
        url: 'http://hl7.org/fhir/StructureDefinition/location',
        valueReference: {
          reference: 'Location/1',
          display: practitionerDisplay,
        },
      },
    ];

    return payload;
  }
}

export function serializeMedicationPayload(
  payload: FhirMedicationRequestPayload,
): FhirMedicationRequestPayload {
  return structuredClone(payload);
}

/** Row display from GetEncounterModel SQL — never 'Medication_Requestt' (legacy dead-code typo) */
export const MEDICATION_REQUEST_DISPLAY = 'Medication_Request';
