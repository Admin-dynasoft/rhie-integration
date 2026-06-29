import { phpEffectiveDateTimeUtc } from './complaint-payload.builder.js';
import type {
  FhirLabRequestServiceRequestPayload,
  FhirLabResultObservationPayload,
  LabRequestEncounterDataRow,
  LabResultEncounterDataRow,
} from './types.js';

/**
 * Builds FHIR payloads for laboratory uploads — port of UploadEncounterController
 * buildLabObservation() and buildLabRequestObservation() (traches)
 */
export class LaboratoryPayloadBuilder {
  /** Port of buildLabObservation() */
  buildLabResult(observation: LabResultEncounterDataRow): FhirLabResultObservationPayload {
    return {
      resourceType: 'Observation',
      id: observation.observation_encount_id,
      status: 'final',
      code: {
        coding: [
          {
            system: 'http://loinc.org',
            code: '33747-0',
            display: observation.full_description ?? 'No description',
          },
        ],
      },
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/observation-category',
              code: 'laboratory',
              display: observation.display ?? 'Laboratory',
            },
          ],
        },
      ],
      subject: {
        reference: `Patient/${observation.upid}`,
      },
      encounter: {
        reference: `Encounter/${observation.reference_encount_id}`,
      },
      performer: [
        {
          reference: 'Practitioner/f830114a-bc0b-410e-b8c7-79e61c0df653',
          display: observation.practitioner_name ?? 'System',
        },
      ],
      valueQuantity: {
        value: null,
        unit: observation.result ?? '',
        system: 'http://unitsofmeasure.org',
      },
      effectiveDateTime: phpEffectiveDateTimeUtc(observation.order_time),
    };
  }

  /** Port of buildLabRequestObservation() */
  buildLabRequest(observation: LabRequestEncounterDataRow): FhirLabRequestServiceRequestPayload {
    const practitionerDisplay = observation.practitioner_name ?? 'System';

    return {
      resourceType: 'ServiceRequest',
      id: observation.observation_encount_id,
      status: 'active',
      intent: 'order',
      category: {
        coding: {
          system: 'http://snomed.info/sct',
          code: '108252007',
          display: observation.main_display ?? 'Laboratory procedure',
        },
      },
      code: {
        coding: [
          {
            system: 'http://loinc.org',
            code: 'unknown',
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
      occurrenceDateTime: phpEffectiveDateTimeUtc(observation.order_time),
      requester: {
        reference: 'Practitioner/f830114a-bc0b-410e-b8c7-79e61c0df653',
        display: practitionerDisplay,
      },
      performer: [
        {
          reference: 'Practitioner/f830114a-bc0b-410e-b8c7-79e61c0df653',
          display: practitionerDisplay,
        },
      ],
      locationReference: {
        reference: 'Location/1',
        display: practitionerDisplay,
      },
    };
  }
}

export function serializeLabResultPayload(
  payload: FhirLabResultObservationPayload,
): FhirLabResultObservationPayload {
  return structuredClone(payload);
}

export function serializeLabRequestPayload(
  payload: FhirLabRequestServiceRequestPayload,
): FhirLabRequestServiceRequestPayload {
  return structuredClone(payload);
}

/** Row display from GetEncounterModel SQL — never 'Laboratoryy' (legacy dead-code typo) */
export const LABORATORY_DISPLAY = 'Laboratory';

/** Row display from GetEncounterModel SQL — never 'Lab Requestt' (legacy dead-code typo) */
export const LAB_REQUEST_DISPLAY = 'Lab Request';
