import type { ComplaintEncounterDataRow, FhirComplaintObservationPayload } from './types.js';

/** PHP: DateTime order_time → setTimezone(UTC) → format(DateTimeInterface::ATOM) */
export function phpEffectiveDateTimeUtc(orderTime: string | null | undefined): string {
  if (!orderTime || orderTime.trim() === '') {
    return new Date().toISOString().replace(/\.\d{3}Z$/, '+00:00');
  }

  const trimmed = orderTime.trim();
  const [datePart, timePart = '00:00:00'] = trimmed.includes('T')
    ? trimmed.split('T')
    : trimmed.split(' ');

  // order_time is stored in facility local time (Africa/Kigali, UTC+2)
  const localIso = `${datePart}T${timePart}+02:00`;
  const parsed = new Date(localIso);

  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString().replace(/\.\d{3}Z$/, '+00:00');
  }

  return parsed
    .toISOString()
    .replace(/\.\d{3}Z$/, '+00:00');
}

/**
 * Builds FHIR Observation payload — port of UploadEncounterController::buildComplaintObservation()
 * (rhie/controllers/traches/UploadEncounterController.php)
 */
export class ComplaintPayloadBuilder {
  build(observation: ComplaintEncounterDataRow): FhirComplaintObservationPayload {
    return {
      resourceType: 'Observation',
      id: observation.observation_encount_id,
      status: 'final',
      code: {
        coding: [
          {
            system: 'http://loinc.org',
            code: '33747-0',
            display: 'Chief Complaints',
          },
        ],
      },
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/observation-category',
              code: 'survey',
              display: 'survey',
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
      valueString: observation.full_description ?? 'No complaint details',
      effectiveDateTime: phpEffectiveDateTimeUtc(observation.order_time),
    };
  }
}

export function serializeComplaintPayload(
  payload: FhirComplaintObservationPayload,
): FhirComplaintObservationPayload {
  return structuredClone(payload);
}

/** Display value from GetEncounterModel SQL — matches intended upload branch */
export const COMPLAINT_DISPLAY = 'Chief Complaint';
